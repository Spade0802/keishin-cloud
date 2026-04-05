/**
 * 管理者監査ログ API
 *
 * GET /api/admin/audit-logs - ページネーション付き監査ログ一覧
 */
import { NextRequest, NextResponse } from 'next/server';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { auditLogs, users } from '@/lib/db/schema';
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
// GET - 監査ログ一覧 (ページネーション + フィルター)
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }

  try {
    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = 20;
    const offset = (page - 1) * limit;

    // フィルター
    const actionFilter = searchParams.get('action') || null;
    const userIdFilter = searchParams.get('userId') || null;
    const organizationIdFilter = searchParams.get('organizationId') || null;
    const fromDate = searchParams.get('from') || null;
    const toDate = searchParams.get('to') || null;

    // 条件組み立て
    const conditions = [];
    if (actionFilter) {
      conditions.push(eq(auditLogs.action, actionFilter));
    }
    if (userIdFilter) {
      conditions.push(eq(auditLogs.userId, userIdFilter));
    }
    if (organizationIdFilter) {
      conditions.push(eq(auditLogs.organizationId, organizationIdFilter));
    }
    if (fromDate) {
      conditions.push(gte(auditLogs.createdAt, new Date(fromDate)));
    }
    if (toDate) {
      conditions.push(lte(auditLogs.createdAt, new Date(toDate)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // データ取得 (ユーザー名を結合)
    const logs = await db
      .select({
        id: auditLogs.id,
        userId: auditLogs.userId,
        userName: users.name,
        userEmail: users.email,
        organizationId: auditLogs.organizationId,
        action: auditLogs.action,
        resource: auditLogs.resource,
        resourceId: auditLogs.resourceId,
        details: auditLogs.details,
        ipAddress: auditLogs.ipAddress,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    // 総件数
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLogs)
      .where(whereClause)
      .then((rows) => rows[0]);

    const totalCount = countResult?.count ?? 0;
    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      logs: logs.map((log) => ({
        ...log,
        createdAt: log.createdAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
      },
    });
  } catch (error) {
    logger.error('[Admin AuditLogs] GET error:', error);
    return NextResponse.json({ error: '監査ログの取得に失敗しました' }, { status: 500 });
  }
}
