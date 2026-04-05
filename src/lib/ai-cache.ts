/**
 * AI分析結果のハッシュベースキャッシュ
 *
 * 同一入力データに対する Gemini API の重複呼び出しを防ぐ。
 * インメモリ Map + TTL で実装（シングルインスタンス前提）。
 * オプションで DB (systemSettings) にも永続化できる。
 */
import { createHash } from 'crypto';
import type { AnalysisInput, AnalysisResult } from './ai-analysis-types';
import { logger } from './logger';

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

interface CacheEntry {
  result: AnalysisResult;
  createdAt: number;
  ttlMs: number;
}

export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: string;
}

// ---------------------------------------------------------------------------
// インメモリキャッシュ
// ---------------------------------------------------------------------------

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 時間
const MAX_ENTRIES = 100;
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10 分

let cache = new Map<string, CacheEntry>();
let stats = { hits: 0, misses: 0 };

// 定期的に期限切れエントリを掃除する
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now - entry.createdAt > entry.ttlMs) {
      cache.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS);

// Node.js プロセスの終了をブロックしない
if (typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
  cleanupTimer.unref();
}

// ---------------------------------------------------------------------------
// ハッシュ生成
// ---------------------------------------------------------------------------

/**
 * AnalysisInput から決定論的な SHA-256 ハッシュを生成する。
 * キーの順序を安定させるため、JSON.stringify の replacer でソートする。
 */
export function generateInputHash(data: AnalysisInput): string {
  const stable = JSON.stringify(data, sortedReplacer);
  return createHash('sha256').update(stable).digest('hex');
}

/** オブジェクトキーをソートして安定した JSON を生成するための replacer */
function sortedReplacer(_key: string, value: unknown): unknown {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(value).sort()) {
      sorted[k] = (value as Record<string, unknown>)[k];
    }
    return sorted;
  }
  return value;
}

// ---------------------------------------------------------------------------
// キャッシュ読み書き
// ---------------------------------------------------------------------------

/**
 * キャッシュから分析結果を取得する。
 * TTL 超過していれば削除して undefined を返す。
 */
export function getCachedAnalysis(
  inputHash: string,
): AnalysisResult | undefined {
  const entry = cache.get(inputHash);

  if (!entry) {
    stats.misses++;
    logger.debug(`[ai-cache] MISS hash=${inputHash.slice(0, 12)}...`);
    return undefined;
  }

  if (Date.now() - entry.createdAt > entry.ttlMs) {
    cache.delete(inputHash);
    stats.misses++;
    logger.debug(
      `[ai-cache] EXPIRED hash=${inputHash.slice(0, 12)}...`,
    );
    return undefined;
  }

  stats.hits++;
  logger.debug(`[ai-cache] HIT hash=${inputHash.slice(0, 12)}...`);
  return entry.result;
}

/**
 * 分析結果をキャッシュに保存する。
 */
export function setCachedAnalysis(
  inputHash: string,
  result: AnalysisResult,
  ttlMs: number = DEFAULT_TTL_MS,
): void {
  // MAX_ENTRIES を超える場合、最も古いエントリ（Map の挿入順先頭）を削除
  if (cache.size >= MAX_ENTRIES && !cache.has(inputHash)) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) {
      cache.delete(oldestKey);
      logger.debug(`[ai-cache] EVICTED oldest entry hash=${oldestKey.slice(0, 12)}... (size was ${cache.size + 1})`);
    }
  }
  cache.set(inputHash, {
    result,
    createdAt: Date.now(),
    ttlMs,
  });
  logger.debug(
    `[ai-cache] STORED hash=${inputHash.slice(0, 12)}... ttl=${ttlMs}ms`,
  );
}

// ---------------------------------------------------------------------------
// キャッシュ管理
// ---------------------------------------------------------------------------

/** キャッシュの統計情報を取得する */
export function getCacheStats(): CacheStats {
  // 期限切れエントリを先に掃除
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now - entry.createdAt > entry.ttlMs) {
      cache.delete(key);
    }
  }

  const total = stats.hits + stats.misses;
  return {
    size: cache.size,
    hits: stats.hits,
    misses: stats.misses,
    hitRate: total > 0 ? `${((stats.hits / total) * 100).toFixed(1)}%` : '0%',
  };
}

/** キャッシュを全クリアする */
export function clearAnalysisCache(): void {
  const prevSize = cache.size;
  cache = new Map();
  stats = { hits: 0, misses: 0 };
  logger.debug(`[ai-cache] CLEARED ${prevSize} entries`);
}
