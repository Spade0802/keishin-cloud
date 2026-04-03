/**
 * 管理者システム設定 API
 *
 * GET  /api/admin/settings - 全設定を取得（APIキーはマスク済み）
 * PUT  /api/admin/settings - 設定を一括更新
 */
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { systemSettings, users } from '@/lib/db/schema';
import { getAllSettings, invalidateSettingsCache } from '@/lib/settings';

// ---------------------------------------------------------------------------
// ヘルパー
// ---------------------------------------------------------------------------

/** 管理者チェック。管理者でなければ null を返す。 */
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

/** API キーをマスクする (末尾 4 文字だけ表示) */
function maskApiKey(value: string): string {
  if (!value || value.length <= 4) return value ? '****' : '';
  return '****' + value.slice(-4);
}

const API_KEY_FIELDS = ['gemini_api_key', 'openai_api_key'];

const VALID_KEYS = new Set([
  'ai_provider',
  'gemini_api_key',
  'openai_api_key',
  'gemini_model',
  'openai_model',
  'ocr_provider',
  'max_file_size_mb',
  'ai_analysis_enabled',
]);

const DESCRIPTIONS: Record<string, string> = {
  ai_provider: 'AI プロバイダー (gemini / openai / gemini-paid)',
  gemini_api_key: 'Google AI Studio API キー (有料 Gemini 用)',
  openai_api_key: 'OpenAI API キー',
  gemini_model: 'Gemini モデル名',
  openai_model: 'OpenAI モデル名',
  ocr_provider: 'OCR プロバイダー (gemini / document-ai / vision-api)',
  max_file_size_mb: '最大アップロードファイルサイズ (MB)',
  ai_analysis_enabled: 'AI 分析機能の有効/無効',
};

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }

  const settings = await getAllSettings();

  // API キーをマスク
  const masked: Record<string, { value: string; description: string | null; updatedAt: Date | null }> = {};
  for (const [key, entry] of Object.entries(settings)) {
    masked[key] = {
      ...entry,
      value: API_KEY_FIELDS.includes(key) ? maskApiKey(entry.value) : entry.value,
    };
  }

  return NextResponse.json({ settings: masked });
}

// ---------------------------------------------------------------------------
// PUT
// ---------------------------------------------------------------------------

export async function PUT(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }

  let body: Record<string, string>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '不正なリクエスト' }, { status: 400 });
  }

  // バリデーション
  const errors: string[] = [];
  for (const key of Object.keys(body)) {
    if (!VALID_KEYS.has(key)) {
      errors.push(`不明な設定キー: ${key}`);
    }
  }

  if (body.ai_provider && !['gemini', 'openai', 'gemini-paid'].includes(body.ai_provider)) {
    errors.push('ai_provider は gemini / openai / gemini-paid のいずれかです');
  }

  if (body.ocr_provider && !['gemini', 'document-ai', 'vision-api'].includes(body.ocr_provider)) {
    errors.push('ocr_provider は gemini / document-ai / vision-api のいずれかです');
  }

  if (body.max_file_size_mb) {
    const n = Number(body.max_file_size_mb);
    if (isNaN(n) || n < 1 || n > 500) {
      errors.push('max_file_size_mb は 1〜500 の数値です');
    }
  }

  if (body.ai_analysis_enabled && !['true', 'false'].includes(body.ai_analysis_enabled)) {
    errors.push('ai_analysis_enabled は true / false です');
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400 });
  }

  // 保存 (upsert)
  const now = new Date();
  for (const [key, value] of Object.entries(body)) {
    if (!VALID_KEYS.has(key)) continue;

    // APIキー: "****xxxx" のようなマスク値は更新しない
    if (API_KEY_FIELDS.includes(key) && value.startsWith('****')) {
      continue;
    }

    await db
      .insert(systemSettings)
      .values({
        key,
        value,
        description: DESCRIPTIONS[key] ?? null,
        updatedAt: now,
        updatedBy: admin.id,
      })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: {
          value,
          updatedAt: now,
          updatedBy: admin.id,
        },
      });
  }

  invalidateSettingsCache();

  return NextResponse.json({ success: true });
}
