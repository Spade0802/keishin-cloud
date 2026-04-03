/**
 * システム設定の読み取りヘルパー
 *
 * DB からシステム設定を取得し、インメモリキャッシュで高速化する。
 * キャッシュは TTL ベースで自動的に無効化される。
 */
import { eq } from 'drizzle-orm';
import { db } from './db';
import { systemSettings } from './db/schema';

// ---------------------------------------------------------------------------
// デフォルト値
// ---------------------------------------------------------------------------

const DEFAULTS: Record<string, string> = {
  ai_provider: 'gemini',
  gemini_api_key: '',
  openai_api_key: '',
  gemini_model: 'gemini-2.5-flash',
  openai_model: 'gpt-4o',
  ocr_provider: 'gemini',
  max_file_size_mb: '50',
  ai_analysis_enabled: 'true',
};

// ---------------------------------------------------------------------------
// キャッシュ
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 60_000; // 1 分
let cache: Map<string, { value: string; fetchedAt: number }> = new Map();

function getCached(key: string): string | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function setCache(key: string, value: string) {
  cache.set(key, { value, fetchedAt: Date.now() });
}

/** キャッシュをクリアする（設定更新後に呼ぶ） */
export function invalidateSettingsCache() {
  cache = new Map();
}

// ---------------------------------------------------------------------------
// 公開 API
// ---------------------------------------------------------------------------

/** 設定値を 1 件取得する。存在しなければデフォルト値を返す。 */
export async function getSetting(key: string): Promise<string | null> {
  const cached = getCached(key);
  if (cached !== undefined) return cached;

  const row = await db
    .select({ value: systemSettings.value })
    .from(systemSettings)
    .where(eq(systemSettings.key, key))
    .then((rows) => rows[0]);

  const value = row?.value ?? DEFAULTS[key] ?? null;
  if (value !== null) setCache(key, value);
  return value;
}

/** AI プロバイダー種別を取得 */
export async function getAIProvider(): Promise<
  'gemini' | 'openai' | 'gemini-paid'
> {
  const value = await getSetting('ai_provider');
  if (
    value === 'gemini' ||
    value === 'openai' ||
    value === 'gemini-paid'
  ) {
    return value;
  }
  return 'gemini';
}

/** AI 設定をまとめて取得 */
export async function getAIConfig(): Promise<{
  provider: string;
  apiKey?: string;
  model: string;
}> {
  const provider = await getAIProvider();

  if (provider === 'openai') {
    const apiKey = (await getSetting('openai_api_key')) || undefined;
    const model = (await getSetting('openai_model')) || 'gpt-4o';
    return { provider, apiKey, model };
  }

  // gemini or gemini-paid
  const apiKey =
    provider === 'gemini-paid'
      ? (await getSetting('gemini_api_key')) || undefined
      : undefined;
  const model =
    (await getSetting('gemini_model')) || 'gemini-2.5-flash';
  return { provider, apiKey, model };
}

/** 全設定をまとめて取得（管理画面用） */
export async function getAllSettings(): Promise<
  Record<string, { value: string; description: string | null; updatedAt: Date | null }>
> {
  const rows = await db.select().from(systemSettings);
  const result: Record<
    string,
    { value: string; description: string | null; updatedAt: Date | null }
  > = {};

  // デフォルト値を先に入れる
  for (const [key, value] of Object.entries(DEFAULTS)) {
    result[key] = { value, description: null, updatedAt: null };
  }

  // DB 値で上書き
  for (const row of rows) {
    result[row.key] = {
      value: row.value,
      description: row.description,
      updatedAt: row.updatedAt,
    };
  }

  return result;
}
