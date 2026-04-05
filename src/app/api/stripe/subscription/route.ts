/**
 * サブスクリプション情報取得
 *
 * GET /api/stripe/subscription
 * 現在のプラン・ステータス・期限を返す
 */
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { organizations, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { isBillingBypassed, PLANS } from '@/lib/stripe';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    // 課金バイパスモード
    if (isBillingBypassed()) {
      return NextResponse.json({
        plan: 'premium',
        planConfig: PLANS.premium,
        subscriptionStatus: 'active',
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        bypassed: true,
      });
    }

    const user = await db
      .select({ organizationId: users.organizationId })
      .from(users)
      .where(eq(users.id, session.user.id))
      .then((r) => r[0]);

    if (!user?.organizationId) {
      return NextResponse.json({
        plan: 'free',
        planConfig: PLANS.free,
        subscriptionStatus: 'none',
        currentPeriodEnd: null,
      });
    }

    const org = await db
      .select({
        plan: organizations.plan,
        subscriptionStatus: organizations.subscriptionStatus,
        currentPeriodEnd: organizations.currentPeriodEnd,
        trialEndsAt: organizations.trialEndsAt,
        stripeCustomerId: organizations.stripeCustomerId,
        stripeSubscriptionId: organizations.stripeSubscriptionId,
      })
      .from(organizations)
      .where(eq(organizations.id, user.organizationId))
      .then((r) => r[0]);

    if (!org) {
      return NextResponse.json({
        plan: 'free',
        planConfig: PLANS.free,
        subscriptionStatus: 'none',
        currentPeriodEnd: null,
      });
    }

    return NextResponse.json({
      plan: org.plan,
      planConfig: PLANS[org.plan] || PLANS.free,
      subscriptionStatus: org.subscriptionStatus,
      currentPeriodEnd: org.currentPeriodEnd?.toISOString() || null,
      trialEndsAt: org.trialEndsAt?.toISOString() || null,
      hasStripeCustomer: !!org.stripeCustomerId,
      hasSubscription: !!org.stripeSubscriptionId,
    });
  } catch (error) {
    logger.error('[Stripe] Subscription query error:', error);
    return NextResponse.json(
      { error: 'サブスクリプション情報の取得に失敗しました' },
      { status: 500 }
    );
  }
}
