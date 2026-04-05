import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { simulations } from '@/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';

/** GET /api/simulations — 法人のシミュレーション一覧（法人未設定ならユーザー個人） */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  const orgId = session.user.organizationId;

  // 法人IDがあれば法人単位、なければユーザー単位でフィルタ
  const condition = orgId
    ? eq(simulations.organizationId, orgId)
    : and(
        eq(simulations.userId, session.user.id),
      );

  const results = await db
    .select()
    .from(simulations)
    .where(condition)
    .orderBy(desc(simulations.updatedAt))
    .limit(50);

  return NextResponse.json(results);
}

/** POST /api/simulations — シミュレーション保存 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  const body = await req.json();
  const { name, inputData, resultData, period } = body;

  if (!inputData) {
    return NextResponse.json({ error: '入力データが必要です' }, { status: 400 });
  }

  const [created] = await db
    .insert(simulations)
    .values({
      organizationId: session.user.organizationId ?? null,
      userId: session.user.id,
      name: name || '無題のシミュレーション',
      period: period || null,
      inputData,
      resultData,
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
}

/** PUT /api/simulations — 既存シミュレーション更新 */
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  const body = await req.json();
  const { id, name, inputData, resultData, period } = body;

  if (!id) {
    return NextResponse.json({ error: 'IDが必要です' }, { status: 400 });
  }

  if (!inputData) {
    return NextResponse.json({ error: '入力データが必要です' }, { status: 400 });
  }

  // Verify ownership
  const [existing] = await db
    .select({ userId: simulations.userId, organizationId: simulations.organizationId })
    .from(simulations)
    .where(eq(simulations.id, id));

  if (!existing) {
    return NextResponse.json({ error: 'シミュレーションが見つかりません' }, { status: 404 });
  }

  const orgId = session.user.organizationId;
  const isOwner =
    existing.userId === session.user.id ||
    (orgId && existing.organizationId === orgId);

  if (!isOwner) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }

  const [updated] = await db
    .update(simulations)
    .set({
      name: name || undefined,
      period: period || undefined,
      inputData,
      resultData,
      updatedAt: new Date(),
    })
    .where(eq(simulations.id, id))
    .returning();

  return NextResponse.json(updated);
}
