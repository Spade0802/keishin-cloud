import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { companies, fiscalPeriods } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { buildPrevPeriodSnapshot } from '@/lib/engine/prev-period-snapshot';
import type { KeishinBS } from '@/lib/engine/types';

/** GET /api/companies/[id]/periods/[periodId] — 決算期詳細 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; periodId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  if (!session.user.organizationId) {
    return NextResponse.json({ error: '法人が登録されていません' }, { status: 404 });
  }

  const { id, periodId } = await params;

  // Verify company ownership
  const [company] = await db
    .select()
    .from(companies)
    .where(
      and(
        eq(companies.id, id),
        eq(companies.organizationId, session.user.organizationId)
      )
    );

  if (!company) {
    return NextResponse.json({ error: '企業が見つかりません' }, { status: 404 });
  }

  const [period] = await db
    .select()
    .from(fiscalPeriods)
    .where(
      and(
        eq(fiscalPeriods.id, periodId),
        eq(fiscalPeriods.companyId, id)
      )
    );

  if (!period) {
    return NextResponse.json({ error: '決算期が見つかりません' }, { status: 404 });
  }

  return NextResponse.json(period);
}

/** PUT /api/companies/[id]/periods/[periodId] — 決算期更新 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; periodId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  if (!session.user.organizationId) {
    return NextResponse.json({ error: '法人が登録されていません' }, { status: 404 });
  }

  const { id, periodId } = await params;

  // Verify company ownership
  const [company] = await db
    .select()
    .from(companies)
    .where(
      and(
        eq(companies.id, id),
        eq(companies.organizationId, session.user.organizationId)
      )
    );

  if (!company) {
    return NextResponse.json({ error: '企業が見つかりません' }, { status: 404 });
  }

  // Verify period belongs to company
  const [existing] = await db
    .select()
    .from(fiscalPeriods)
    .where(
      and(
        eq(fiscalPeriods.id, periodId),
        eq(fiscalPeriods.companyId, id)
      )
    );

  if (!existing) {
    return NextResponse.json({ error: '決算期が見つかりません' }, { status: 404 });
  }

  const body = await req.json();
  const {
    startDate,
    endDate,
    status,
    rawFinancialData,
    keishinBs,
    keishinPl,
    yInput,
    socialItems,
    techStaff,
    industries,
    calculationResult,
  } = body;

  // Build prevPeriodSnapshot when calculationResult is being saved
  // so the next period can auto-populate prev fields
  let prevSnapshot = existing.prevPeriodSnapshot;
  const effectiveBs = keishinBs !== undefined ? keishinBs : existing.keishinBs;
  const effectiveResult = calculationResult !== undefined ? calculationResult : existing.calculationResult;

  if (effectiveBs && effectiveResult) {
    const operatingCF =
      typeof effectiveResult === 'object' &&
      effectiveResult !== null &&
      'yResult' in effectiveResult
        ? (effectiveResult as { yResult: { operatingCF: number } }).yResult
            .operatingCF
        : 0;
    prevSnapshot = buildPrevPeriodSnapshot(
      effectiveBs as KeishinBS,
      operatingCF
    );
  }

  const [updated] = await db
    .update(fiscalPeriods)
    .set({
      startDate: startDate !== undefined ? startDate : existing.startDate,
      endDate: endDate !== undefined ? endDate : existing.endDate,
      status: status !== undefined ? status : existing.status,
      rawFinancialData: rawFinancialData !== undefined ? rawFinancialData : existing.rawFinancialData,
      keishinBs: keishinBs !== undefined ? keishinBs : existing.keishinBs,
      keishinPl: keishinPl !== undefined ? keishinPl : existing.keishinPl,
      yInput: yInput !== undefined ? yInput : existing.yInput,
      socialItems: socialItems !== undefined ? socialItems : existing.socialItems,
      techStaff: techStaff !== undefined ? techStaff : existing.techStaff,
      industries: industries !== undefined ? industries : existing.industries,
      calculationResult: calculationResult !== undefined ? calculationResult : existing.calculationResult,
      prevPeriodSnapshot: prevSnapshot,
      updatedAt: new Date(),
    })
    .where(eq(fiscalPeriods.id, periodId))
    .returning();

  return NextResponse.json(updated);
}
