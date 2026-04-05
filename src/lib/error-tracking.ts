/**
 * エラートラッキング (スタブ)
 *
 * 現在はログ出力のみ。本番運用時は Sentry 等と統合する。
 *
 * TODO: Sentry SDK を導入し、captureException / captureMessage を接続する
 * TODO: ユーザーコンテキスト (userId, organizationId) を自動付与する
 * TODO: エラー発生率のアラート閾値を設定する
 */
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

type SeverityLevel = 'fatal' | 'error' | 'warning' | 'info' | 'debug';

interface ErrorContext {
  userId?: string;
  organizationId?: string;
  route?: string;
  action?: string;
  extra?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// エラートラッキング関数
// ---------------------------------------------------------------------------

/**
 * 例外をキャプチャする (スタブ)
 *
 * エラーバウンダリや API エラーハンドラーから呼び出す。
 */
export function captureException(error: unknown, context?: ErrorContext): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  logger.error('[ErrorTracking] captureException:', {
    message: errorMessage,
    stack,
    ...context,
  });

  // TODO: Sentry.captureException(error, { extra: context });
}

/**
 * メッセージをキャプチャする (スタブ)
 *
 * 例外ではないが注目すべきイベントを記録する。
 */
export function captureMessage(
  message: string,
  level: SeverityLevel = 'info',
  context?: ErrorContext,
): void {
  const logFn =
    level === 'fatal' || level === 'error'
      ? logger.error
      : level === 'warning'
        ? logger.warn
        : level === 'debug'
          ? logger.debug
          : logger.info;

  logFn('[ErrorTracking] captureMessage:', { message, level, ...context });

  // TODO: Sentry.captureMessage(message, { level, extra: context });
}
