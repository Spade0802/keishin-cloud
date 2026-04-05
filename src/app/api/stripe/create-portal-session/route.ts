/**
 * Stripe カスタマーポータルセッション作成
 *
 * POST /api/stripe/create-portal-session
 * サブスクリプション管理（プラン変更・解約・カード更新）
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { organizations, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { stripe, isBillingBypassed } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    if (isBillingBypassed()) {
      return NextResponse.json({
        bypassed: true,
        message: 'テストモード: Stripeポータルは利用できません',
      });
    }

    if (!stripe) {
      return NextResponse.json({ error: '決済システムが設定されていません。管理者にお問い合わせください。' }, { status: 500 });
    }

    // ユーザーの法人情報を取得
    const user = await db
      .select({ organizationId: users.organizationId })
      .from(users)
      .where(eq(users.id, session.user.id))
      .then((r) => r[0]);

    if (!user?.organizationId) {
      return NextResponse.json({ error: '法人登録が必要です' }, { status: 400 });
    }

    const org = await db
      .select({ stripeCustomerId: organizations.stripeCustomerId })
      .from(organizations)
      .where(eq(organizations.id, user.organizationId))
      .then((r) => r[0]);

    if (!org?.stripeCustomerId) {
      return NextResponse.json({ error: 'サブスクリプションが見つかりません' }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: `${baseUrl}/account/billing`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    console.error('[Stripe] Portal session error:', error);
    return NextResponse.json(
      { error: 'ポータルセッションの作成に失敗しました' },
      { status: 500 }
    );
  }
}
