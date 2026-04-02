import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { organizations, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/** POST /api/organizations — 法人を作成してユーザーに紐づけ */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  // 既に法人に所属している場合はエラー
  if (session.user.organizationId) {
    return NextResponse.json(
      { error: '既に法人が登録されています' },
      { status: 400 }
    );
  }

  const body = await req.json();
  const { name, permitNumber } = body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json(
      { error: '法人名は必須です' },
      { status: 400 }
    );
  }

  // 法人作成 + ユーザー紐づけをトランザクションで実行
  const result = await db.transaction(async (tx) => {
    const [org] = await tx
      .insert(organizations)
      .values({
        name: name.trim(),
        permitNumber: permitNumber || null,
      })
      .returning();

    await tx
      .update(users)
      .set({
        organizationId: org.id,
        role: 'admin',
      })
      .where(eq(users.id, session.user.id));

    return org;
  });

  return NextResponse.json(result, { status: 201 });
}

/** GET /api/organizations — 自分の法人情報を取得 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  if (!session.user.organizationId) {
    return NextResponse.json({ error: '法人が登録されていません' }, { status: 404 });
  }

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, session.user.organizationId));

  if (!org) {
    return NextResponse.json({ error: '法人が見つかりません' }, { status: 404 });
  }

  return NextResponse.json(org);
}
