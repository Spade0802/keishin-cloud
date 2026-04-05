/**
 * Stripe Checkout セッション作成
 *
 * POST /api/stripe/create-checkout-session
 * body: { plan: "standard" | "premium", interval: "month" | "year" }
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { organizations, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { stripe, isBillingBypassed, getStripePriceId } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  try {
    // CSRF protection: verify Origin header
    const origin = req.headers.get('origin');
    const allowedOrigin = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
    if (origin && !allowedOrigin.startsWith(origin) && origin !== allowedOrigin) {
      return NextResponse.json({ error: '不正なリクエスト元です' }, { status: 403 });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const body = await req.json();
    const { plan, interval = 'year' } = body as {
      plan: string;
      interval?: 'month' | 'year';
    };

    if (!['standard', 'premium'].includes(plan)) {
      return NextResponse.json({ error: '無効なプランです' }, { status: 400 });
    }

    // 課金バイパスモード: 即座にアクティブにする
    if (isBillingBypassed()) {
      const user = await db
        .select({ organizationId: users.organizationId })
        .from(users)
        .where(eq(users.id, session.user.id))
        .then((r) => r[0]);

      if (user?.organizationId) {
        await db
          .update(organizations)
          .set({
            plan: plan as 'standard' | 'premium',
            subscriptionStatus: 'active',
            currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            updatedAt: new Date(),
          })
          .where(eq(organizations.id, user.organizationId));
      }

      return NextResponse.json({
        bypassed: true,
        message: 'テストモード: プランを即座にアクティブ化しました',
      });
    }

    if (!stripe) {
      return NextResponse.json({ error: '決済システムが設定されていません。管理者にお問い合わせください。' }, { status: 500 });
    }

    // Price ID を取得
    const priceId = getStripePriceId(plan, interval);
    if (!priceId) {
      return NextResponse.json(
        { error: `${plan}プランの${interval}価格が設定されていません。管理者にお問い合わせください。` },
        { status: 500 }
      );
    }

    // ユーザーの法人情報を取得
    const user = await db
      .select({
        organizationId: users.organizationId,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, session.user.id))
      .then((r) => r[0]);

    if (!user?.organizationId) {
      return NextResponse.json({ error: '法人登録が必要です' }, { status: 400 });
    }

    // 既存の Stripe Customer を取得 or 作成
    const org = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, user.organizationId))
      .then((r) => r[0]);

    let customerId = org?.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        metadata: {
          organizationId: user.organizationId,
          userId: session.user.id,
        },
      });
      customerId = customer.id;
      await db
        .update(organizations)
        .set({ stripeCustomerId: customerId, updatedAt: new Date() })
        .where(eq(organizations.id, user.organizationId));
    }

    // Checkout Session 作成
    const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/account/billing?success=true`,
      cancel_url: `${baseUrl}/pricing?canceled=true`,
      subscription_data: {
        metadata: {
          organizationId: user.organizationId,
          plan,
        },
      },
      metadata: {
        organizationId: user.organizationId,
        plan,
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error('[Stripe] Checkout session error:', error);
    return NextResponse.json(
      { error: 'チェックアウトセッションの作成に失敗しました' },
      { status: 500 }
    );
  }
}
