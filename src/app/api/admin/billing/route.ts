/**
 * 管理者課金管理 API
 *
 * GET  /api/admin/billing - 全法人の課金情報を取得
 * PUT  /api/admin/billing - 法人のプラン変更 (管理者による手動変更)
 */
import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { organizations, users } from '@/lib/db/schema';
import { isBillingBypassed, PLANS } from '@/lib/stripe';

// ---------------------------------------------------------------------------
// ヘルパー
// ---------------------------------------------------------------------------

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, session.user.id))
    .then((rows) => rows[0]);

  if (!user || user.role !== 'admin') return null;
  return session.user;
}

// ---------------------------------------------------------------------------
// GET - 全法人の課金情報
// ---------------------------------------------------------------------------

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }

  try {
    // 法人一覧 + ユーザー数
    const orgs = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        permitNumber: organizations.permitNumber,
        plan: organizations.plan,
        subscriptionStatus: organizations.subscriptionStatus,
        stripeCustomerId: organizations.stripeCustomerId,
        stripeSubscriptionId: organizations.stripeSubscriptionId,
        currentPeriodEnd: organizations.currentPeriodEnd,
        trialEndsAt: organizations.trialEndsAt,
        createdAt: organizations.createdAt,
      })
      .from(organizations)
      .orderBy(organizations.createdAt);

    // ユーザー数を取得
    const userCounts = await db
      .select({
        organizationId: users.organizationId,
        count: sql<number>`count(*)::int`,
      })
      .from(users)
      .where(sql`${users.organizationId} IS NOT NULL`)
      .groupBy(users.organizationId);

    const userCountMap = new Map<string, number>();
    for (const uc of userCounts) {
      if (uc.organizationId) userCountMap.set(uc.organizationId, uc.count);
    }

    const orgList = orgs.map((o) => ({
      ...o,
      currentPeriodEnd: o.currentPeriodEnd?.toISOString() || null,
      trialEndsAt: o.trialEndsAt?.toISOString() || null,
      createdAt: o.createdAt.toISOString(),
      userCount: userCountMap.get(o.id) || 0,
    }));

    // 統計
    const paidOrgs = orgs.filter(
      (o) => o.plan !== 'free' && ['active', 'trialing'].includes(o.subscriptionStatus)
    ).length;
    const trialingOrgs = orgs.filter((o) => o.subscriptionStatus === 'trialing').length;
    const freeOrgs = orgs.filter((o) => o.plan === 'free').length;

    // MRR (簡易計算: 有料プランの月額 × 有料法人数)
    let mrr = 0;
    for (const o of orgs) {
      if (o.plan !== 'free' && ['active', 'trialing'].includes(o.subscriptionStatus)) {
        const planConfig = PLANS[o.plan];
        if (planConfig) {
          mrr += planConfig.priceMonthly;
        }
      }
    }

    return NextResponse.json({
      organizations: orgList,
      stats: {
        totalOrgs: orgs.length,
        paidOrgs,
        trialingOrgs,
        freeOrgs,
        mrr,
        bypassed: isBillingBypassed(),
      },
    });
  } catch (error) {
    console.error('[Admin Billing] GET error:', error);
    return NextResponse.json({ error: '課金情報の取得に失敗しました' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT - プラン変更 (管理者による手動操作)
// ---------------------------------------------------------------------------

export async function PUT(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }

  let body: { organizationId: string; action: string; plan?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '不正なリクエスト' }, { status: 400 });
  }

  const { organizationId, action, plan } = body;

  if (!organizationId) {
    return NextResponse.json({ error: '法人IDが必要です' }, { status: 400 });
  }

  try {
    const org = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .then((r) => r[0]);

    if (!org) {
      return NextResponse.json({ error: '法人が見つかりません' }, { status: 404 });
    }

    switch (action) {
      case 'activate': {
        // 管理者による手動アクティベート (テスト用やサポート用)
        const targetPlan = plan || 'standard';
        if (!['standard', 'premium'].includes(targetPlan)) {
          return NextResponse.json({ error: '無効なプランです' }, { status: 400 });
        }
        await db
          .update(organizations)
          .set({
            plan: targetPlan as 'standard' | 'premium',
            subscriptionStatus: 'active',
            currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            updatedAt: new Date(),
          })
          .where(eq(organizations.id, organizationId));
        console.log(`[Admin Billing] Activated ${org.name} to ${targetPlan} by admin ${admin.id}`);
        break;
      }

      case 'change_plan': {
        if (!plan || !['free', 'standard', 'premium'].includes(plan)) {
          return NextResponse.json({ error: '無効なプランです' }, { status: 400 });
        }
        const newStatus = plan === 'free' ? 'none' : org.subscriptionStatus;
        await db
          .update(organizations)
          .set({
            plan: plan as 'free' | 'standard' | 'premium',
            subscriptionStatus: newStatus as 'active' | 'none' | 'trialing' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete',
            currentPeriodEnd: plan === 'free' ? null : org.currentPeriodEnd,
            updatedAt: new Date(),
          })
          .where(eq(organizations.id, organizationId));
        console.log(`[Admin Billing] Changed ${org.name} plan to ${plan} by admin ${admin.id}`);
        break;
      }

      default:
        return NextResponse.json({ error: '不明なアクションです' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Admin Billing] PUT error:', error);
    return NextResponse.json({ error: 'プラン変更に失敗しました' }, { status: 500 });
  }
}
