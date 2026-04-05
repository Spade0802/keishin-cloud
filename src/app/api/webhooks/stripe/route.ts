/**
 * Stripe Webhook ハンドラー
 *
 * POST /api/webhooks/stripe
 * Stripe Dashboard で Webhook Endpoint を設定:
 *   URL: https://your-domain.com/api/webhooks/stripe
 *   Events: checkout.session.completed, customer.subscription.*,
 *           invoice.payment_failed
 */
import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { db } from '@/lib/db';
import { organizations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type Stripe from 'stripe';
import {
  ERR_STRIPE_NOT_CONFIGURED,
  ERR_STRIPE_MISSING_SIGNATURE,
  ERR_STRIPE_INVALID_SIGNATURE,
  ERR_STRIPE_WEBHOOK_HANDLER,
} from '@/lib/error-messages';

export async function POST(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: ERR_STRIPE_NOT_CONFIGURED }, { status: 500 });
  }

  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: ERR_STRIPE_MISSING_SIGNATURE }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[Stripe Webhook] Signature verification failed:', err);
    return NextResponse.json({ error: ERR_STRIPE_INVALID_SIGNATURE }, { status: 400 });
  }

  console.log(`[Stripe Webhook] Received event: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error(`[Stripe Webhook] Error handling ${event.type}:`, error);
    return NextResponse.json({ error: ERR_STRIPE_WEBHOOK_HANDLER }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const organizationId = session.metadata?.organizationId;
  const plan = session.metadata?.plan || 'standard';

  if (!organizationId) {
    console.error('[Stripe Webhook] No organizationId in checkout session metadata');
    return;
  }

  const subscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id;

  await db
    .update(organizations)
    .set({
      stripeCustomerId: typeof session.customer === 'string' ? session.customer : session.customer?.id,
      stripeSubscriptionId: subscriptionId || null,
      plan: plan as 'standard' | 'premium',
      subscriptionStatus: 'active',
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, organizationId));

  console.log(`[Stripe Webhook] Checkout completed for org ${organizationId}, plan: ${plan}`);
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const organizationId = subscription.metadata?.organizationId;
  if (!organizationId) {
    // メタデータがない場合は customer ID で検索
    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer?.id;
    if (customerId) {
      const org = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.stripeCustomerId, customerId))
        .then((r) => r[0]);
      if (org) {
        await updateOrgSubscription(org.id, subscription);
        return;
      }
    }
    console.error('[Stripe Webhook] Cannot find org for subscription', subscription.id);
    return;
  }

  await updateOrgSubscription(organizationId, subscription);
}

async function updateOrgSubscription(orgId: string, subscription: Stripe.Subscription) {
  const plan = subscription.metadata?.plan || 'standard';
  const status = mapStripeStatus(subscription.status);

  // Stripe v2025: current_period_end is on subscription items, not subscription root
  // Fall back to items[0] or use cancel_at as approximate end date
  // Stripe v2025: current_period_end moved to subscription items
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subRaw = subscription as any;
  const rawPeriodEnd: number | undefined =
    subRaw.current_period_end ?? subRaw.items?.data?.[0]?.current_period_end;
  const periodEnd = rawPeriodEnd ? new Date(rawPeriodEnd * 1000) : null;

  const rawTrialEnd: number | null | undefined = subRaw.trial_end;
  const trialEnd = rawTrialEnd ? new Date(rawTrialEnd * 1000) : null;

  await db
    .update(organizations)
    .set({
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: status,
      plan: plan as 'standard' | 'premium',
      currentPeriodEnd: periodEnd,
      trialEndsAt: trialEnd,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, orgId));

  console.log(`[Stripe Webhook] Subscription updated for org ${orgId}: ${status}, plan: ${plan}`);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id;

  if (!customerId) return;

  const org = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.stripeCustomerId, customerId))
    .then((r) => r[0]);

  if (!org) return;

  await db
    .update(organizations)
    .set({
      subscriptionStatus: 'canceled',
      plan: 'free',
      stripeSubscriptionId: null,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, org.id));

  console.log(`[Stripe Webhook] Subscription canceled for org ${org.id}`);
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId =
    typeof invoice.customer === 'string'
      ? invoice.customer
      : invoice.customer?.id;

  if (!customerId) return;

  await db
    .update(organizations)
    .set({
      subscriptionStatus: 'past_due',
      updatedAt: new Date(),
    })
    .where(eq(organizations.stripeCustomerId, customerId));

  console.log(`[Stripe Webhook] Payment failed for customer ${customerId}`);
}

function mapStripeStatus(
  status: Stripe.Subscription.Status
): 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete' | 'none' {
  const map: Record<string, 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete'> = {
    trialing: 'trialing',
    active: 'active',
    past_due: 'past_due',
    canceled: 'canceled',
    unpaid: 'unpaid',
    incomplete: 'incomplete',
    incomplete_expired: 'canceled',
    paused: 'canceled',
  };
  return map[status] || 'none';
}
