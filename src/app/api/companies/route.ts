import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { companies } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { sanitizeString } from '@/lib/security';

/** GET /api/companies — 法人の企業一覧 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  if (!session.user.organizationId) {
    return NextResponse.json({ error: '法人が登録されていません' }, { status: 404 });
  }

  const results = await db
    .select()
    .from(companies)
    .where(eq(companies.organizationId, session.user.organizationId))
    .orderBy(companies.createdAt);

  return NextResponse.json(results);
}

/** POST /api/companies — 企業を新規作成 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  if (!session.user.organizationId) {
    return NextResponse.json({ error: '法人が登録されていません' }, { status: 404 });
  }

  const body = await req.json();
  const name = sanitizeString(body.name, 200);
  const permitNumber = sanitizeString(body.permitNumber, 50);
  const prefectureCode = sanitizeString(body.prefectureCode, 10);
  const targetIndustries = Array.isArray(body.targetIndustries)
    ? body.targetIndustries
    : [];

  if (!name) {
    return NextResponse.json({ error: '企業名は必須です' }, { status: 400 });
  }

  const [created] = await db
    .insert(companies)
    .values({
      organizationId: session.user.organizationId,
      name,
      permitNumber: permitNumber || null,
      prefectureCode: prefectureCode || null,
      targetIndustries,
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
