/**
 * 管理者ユーザー管理 API
 *
 * GET   /api/admin/users          - ユーザー一覧
 * PATCH /api/admin/users          - ロール変更・有効/無効切替
 */
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { getUsers } from '@/lib/admin/data';
import { logger } from '@/lib/logger';

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
// GET - ユーザー一覧
// ---------------------------------------------------------------------------

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }

  try {
    const userList = await getUsers();
    return NextResponse.json({ users: userList });
  } catch (err) {
    logger.error('[admin/users] GET error:', err);
    return NextResponse.json({ error: '内部エラーが発生しました' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH - ロール変更 / 無効化切替
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { userId, action, role } = body as {
      userId: string;
      action: 'changeRole' | 'toggleDisabled';
      role?: 'admin' | 'member';
    };

    if (!userId) {
      return NextResponse.json({ error: 'userId は必須です' }, { status: 400 });
    }

    // 自分自身の変更を防止
    if (userId === admin.id) {
      return NextResponse.json({ error: '自分自身のロールや状態は変更できません' }, { status: 400 });
    }

    // ユーザー存在チェック
    const target = await db
      .select({ id: users.id, role: users.role, disabledAt: users.disabledAt })
      .from(users)
      .where(eq(users.id, userId))
      .then((rows) => rows[0]);

    if (!target) {
      return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 });
    }

    if (action === 'changeRole') {
      if (!role || !['admin', 'member'].includes(role)) {
        return NextResponse.json({ error: '無効なロールです' }, { status: 400 });
      }
      await db.update(users).set({ role }).where(eq(users.id, userId));
      return NextResponse.json({ ok: true, role });
    }

    if (action === 'toggleDisabled') {
      const newDisabledAt = target.disabledAt ? null : new Date();
      await db.update(users).set({ disabledAt: newDisabledAt }).where(eq(users.id, userId));
      return NextResponse.json({ ok: true, disabledAt: newDisabledAt?.toISOString() ?? null });
    }

    return NextResponse.json({ error: '不明なアクションです' }, { status: 400 });
  } catch (err) {
    logger.error('[admin/users] PATCH error:', err);
    return NextResponse.json({ error: '内部エラーが発生しました' }, { status: 500 });
  }
}
