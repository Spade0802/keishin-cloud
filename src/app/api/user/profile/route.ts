import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users, organizations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/** GET /api/user/profile — 自分のプロフィール情報を取得 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      organizationId: users.organizationId,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, session.user.id));

  if (!user) {
    return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 });
  }

  let organizationName: string | null = null;
  if (user.organizationId) {
    const [org] = await db
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, user.organizationId));
    organizationName = org?.name ?? null;
  }

  return NextResponse.json({
    ...user,
    organizationName,
  });
}

/** PATCH /api/user/profile — 表示名を更新 */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  const body = await req.json();
  const { name } = body;

  if (typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: '表示名は必須です' }, { status: 400 });
  }

  if (name.trim().length > 100) {
    return NextResponse.json({ error: '表示名は100文字以内です' }, { status: 400 });
  }

  await db
    .update(users)
    .set({ name: name.trim() })
    .where(eq(users.id, session.user.id));

  return NextResponse.json({ success: true });
}
