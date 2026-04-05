/**
 * 管理者試算履歴 API
 *
 * GET /api/admin/simulations - 試算一覧
 */
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { getSimulations } from '@/lib/admin/data';
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
// GET - 試算一覧
// ---------------------------------------------------------------------------

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }

  try {
    const simulationList = await getSimulations();
    return NextResponse.json({ simulations: simulationList });
  } catch (err) {
    logger.error('[admin/simulations] GET error:', err);
    return NextResponse.json(
      { error: '内部エラーが発生しました' },
      { status: 500 },
    );
  }
}
