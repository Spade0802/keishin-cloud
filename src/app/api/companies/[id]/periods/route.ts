import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { companies, fiscalPeriods } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import type { PrevPeriodSnapshot } from '@/lib/engine/prev-period-snapshot';

/** GET /api/companies/[id]/periods — 決算期一覧（降順） */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  if (!session.user.organizationId) {
    return NextResponse.json({ error: '法人が登録されていません' }, { status: 404 });
  }

  const { id } = await params;

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

  const results = await db
    .select()
    .from(fiscalPeriods)
    .where(eq(fiscalPeriods.companyId, id))
    .orderBy(desc(fiscalPeriods.periodNumber));

  return NextResponse.json(results);
}

/** POST /api/companies/[id]/periods — 新規決算期作成 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  if (!session.user.organizationId) {
    return NextResponse.json({ error: '法人が登録されていません' }, { status: 404 });
  }

  const { id } = await params;

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

  const body = await req.json();
  const { periodNumber, startDate, endDate } = body;

  if (!periodNumber || typeof periodNumber !== 'number') {
    return NextResponse.json({ error: '期番号は必須です' }, { status: 400 });
  }

  // Look up the previous period's typed snapshot (auto-built by PUT handler)
  const [prevPeriod] = await db
    .select()
    .from(fiscalPeriods)
    .where(
      and(
        eq(fiscalPeriods.companyId, id),
        eq(fiscalPeriods.periodNumber, periodNumber - 1)
      )
    );

  const prevPeriodSnapshot: PrevPeriodSnapshot | null =
    prevPeriod?.prevPeriodSnapshot
      ? (prevPeriod.prevPeriodSnapshot as PrevPeriodSnapshot)
      : null;

  const [created] = await db
    .insert(fiscalPeriods)
    .values({
      companyId: id,
      periodNumber,
      startDate: startDate || null,
      endDate: endDate || null,
      prevPeriodSnapshot,
    })
    .returning();

  return NextResponse.json(
    { ...created, prevPeriodSnapshot },
    { status: 201 }
  );
}
