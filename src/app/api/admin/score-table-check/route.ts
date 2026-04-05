/**
 * 評点換算テーブル整合性チェック API
 *
 * GET  /api/admin/score-table-check
 *   → 現行テーブルのバージョンとハッシュ、最終検証日時を返す
 *
 * POST /api/admin/score-table-check
 *   → 参照テーブル JSON を受け取り、現行テーブルとの差異レポートを返す
 *
 * 管理者のみアクセス可能。
 */
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { systemSettings, users } from '@/lib/db/schema';
import {
  runFullCheck,
  generateTableVersionHash,
  CURRENT_TABLE_VERSION,
  type ReferenceTables,
} from '@/lib/score-table-checker';
import type { Bracket } from '@/lib/engine/score-tables';

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

const SETTING_KEY_LAST_VERIFIED = 'score_table_last_verified';

// ---------------------------------------------------------------------------
// GET - 現行バージョン情報
// ---------------------------------------------------------------------------

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }

  // system_settings から最終検証日時を取得（存在しない場合は null）
  let lastVerified: string | null = null;
  try {
    const row = await db
      .select({ value: systemSettings.value })
      .from(systemSettings)
      .where(eq(systemSettings.key, SETTING_KEY_LAST_VERIFIED))
      .then((rows) => rows[0]);
    lastVerified = row?.value ?? null;
  } catch {
    // テーブルが存在しない場合など — 無視して null を返す
  }

  return NextResponse.json({
    currentVersion: CURRENT_TABLE_VERSION,
    tableHash: generateTableVersionHash(),
    lastVerified,
  });
}

// ---------------------------------------------------------------------------
// POST - 参照テーブルとの比較
// ---------------------------------------------------------------------------

/**
 * リクエストボディのブラケット配列をバリデーションする。
 * Infinity / -Infinity は JSON で表現できないため文字列 "Infinity" / "-Infinity" を許容する。
 */
function parseBrackets(raw: unknown): Bracket[] | null {
  if (!Array.isArray(raw)) return null;

  const brackets: Bracket[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) return null;

    const obj = item as Record<string, unknown>;
    const min = parseNumericField(obj.min);
    const max = parseNumericField(obj.max);
    const a = typeof obj.a === 'number' ? obj.a : null;
    const b = typeof obj.b === 'number' ? obj.b : null;
    const c = typeof obj.c === 'number' ? obj.c : null;

    if (min === null || max === null || a === null || b === null || c === null) {
      return null;
    }

    brackets.push({ min, max, a, b, c });
  }

  return brackets;
}

function parseNumericField(v: unknown): number | null {
  if (typeof v === 'number') return v;
  if (v === 'Infinity') return Infinity;
  if (v === '-Infinity') return -Infinity;
  return null;
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: '不正なリクエスト: JSON パースエラー' },
      { status: 400 }
    );
  }

  // 参照テーブルをパース
  const validTableNames = ['X1', 'X21', 'X22', 'Z1', 'Z2'] as const;
  const referenceTables: ReferenceTables = {};
  const parseErrors: string[] = [];

  for (const name of validTableNames) {
    if (name in body) {
      const brackets = parseBrackets(body[name]);
      if (!brackets) {
        parseErrors.push(
          `${name}: ブラケット配列が不正です。各要素に min, max, a, b, c が必要です。`
        );
      } else {
        referenceTables[name] = brackets;
      }
    }
  }

  if (parseErrors.length > 0) {
    return NextResponse.json(
      { error: parseErrors.join(' ') },
      { status: 400 }
    );
  }

  if (Object.keys(referenceTables).length === 0) {
    return NextResponse.json(
      {
        error:
          '少なくとも1つのテーブル (X1, X21, X22, Z1, Z2) を指定してください。',
      },
      { status: 400 }
    );
  }

  // 比較実行
  const result = runFullCheck(referenceTables);

  // 最終検証日時を system_settings に記録
  try {
    const now = new Date().toISOString();
    await db
      .insert(systemSettings)
      .values({
        key: SETTING_KEY_LAST_VERIFIED,
        value: now,
        description: '評点換算テーブルの最終整合性チェック日時',
        updatedAt: new Date(),
        updatedBy: admin.id,
      })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: {
          value: now,
          updatedAt: new Date(),
          updatedBy: admin.id,
        },
      });
  } catch {
    // 記録失敗は致命的ではない — レスポンスは返す
  }

  return NextResponse.json(result);
}
