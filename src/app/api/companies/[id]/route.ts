import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { companies } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

/** GET /api/companies/[id] — 企業詳細 */
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

  return NextResponse.json(company);
}

/** PUT /api/companies/[id] — 企業更新 */
export async function PUT(
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
  const body = await req.json();
  const { name, permitNumber, prefectureCode, targetIndustries } = body;

  // Verify ownership
  const [existing] = await db
    .select()
    .from(companies)
    .where(
      and(
        eq(companies.id, id),
        eq(companies.organizationId, session.user.organizationId)
      )
    );

  if (!existing) {
    return NextResponse.json({ error: '企業が見つかりません' }, { status: 404 });
  }

  const [updated] = await db
    .update(companies)
    .set({
      name: name?.trim() || existing.name,
      permitNumber: permitNumber !== undefined ? permitNumber : existing.permitNumber,
      prefectureCode: prefectureCode !== undefined ? prefectureCode : existing.prefectureCode,
      targetIndustries: targetIndustries !== undefined ? targetIndustries : existing.targetIndustries,
      updatedAt: new Date(),
    })
    .where(eq(companies.id, id))
    .returning();

  return NextResponse.json(updated);
}

/** DELETE /api/companies/[id] — 企業削除 */
export async function DELETE(
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

  // Verify ownership
  const [existing] = await db
    .select()
    .from(companies)
    .where(
      and(
        eq(companies.id, id),
        eq(companies.organizationId, session.user.organizationId)
      )
    );

  if (!existing) {
    return NextResponse.json({ error: '企業が見つかりません' }, { status: 404 });
  }

  await db.delete(companies).where(eq(companies.id, id));

  return NextResponse.json({ success: true });
}
