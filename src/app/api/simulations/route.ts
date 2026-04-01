import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { simulations } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

/** GET /api/simulations — ログインユーザーのシミュレーション一覧 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  const results = await db
    .select()
    .from(simulations)
    .where(eq(simulations.userId, session.user.id))
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
  const { name, inputData, resultData } = body;

  if (!inputData) {
    return NextResponse.json({ error: '入力データが必要です' }, { status: 400 });
  }

  const [created] = await db
    .insert(simulations)
    .values({
      userId: session.user.id,
      name: name || '無題のシミュレーション',
      inputData,
      resultData,
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
