/**
 * アプリケーション共通ロガー
 *
 * 環境変数 LOG_LEVEL（debug | info | warn | error）でレベルを制御する。
 * 未設定時は本番環境で warn、開発環境で debug をデフォルトとする。
 *
 * 使い方:
 * ```ts
 * import { logger } from '@/lib/logger';
 * logger.info('ジョブ開始', { jobId });
 * ```
 */

const LOG_LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'warn' : 'debug');
const levels = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel = levels[LOG_LEVEL as keyof typeof levels] ?? 1;

/**
 * 構造化ロガーオブジェクト。
 *
 * - `logger.debug(...)` — 開発時の詳細情報（LOG_LEVEL=debug のみ出力）
 * - `logger.info(...)`  — 通常の処理ログ
 * - `logger.warn(...)`  — 警告（非致命的な異常）
 * - `logger.error(...)` — エラー（常に出力）
 */
export const logger = {
  debug: (...args: unknown[]) => currentLevel <= 0 && console.log('[DEBUG]', ...args),
  info: (...args: unknown[]) => currentLevel <= 1 && console.log('[INFO]', ...args),
  warn: (...args: unknown[]) => currentLevel <= 2 && console.warn('[WARN]', ...args),
  error: (...args: unknown[]) => currentLevel <= 3 && console.error('[ERROR]', ...args),
};
