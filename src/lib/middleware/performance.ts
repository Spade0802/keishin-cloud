/**
 * パフォーマンス計測ミドルウェア
 *
 * API ルートハンドラーのリクエスト処理時間を計測し、
 * 遅いリクエスト (3秒超) をログに出力する。
 */
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

type RouteHandler = (req: NextRequest) => Promise<NextResponse>;

/** 遅延警告の閾値 (ミリ秒) */
const SLOW_REQUEST_THRESHOLD_MS = 3000;

/**
 * リクエスト処理時間を計測する Higher-Order Function
 *
 * @example
 * export const POST = withTiming(handler);
 */
export function withTiming(handler: RouteHandler): RouteHandler {
  return async (req: NextRequest) => {
    const start = performance.now();
    const method = req.method;
    const url = req.nextUrl.pathname;

    try {
      const response = await handler(req);
      const durationMs = performance.now() - start;

      response.headers.set('X-Response-Time', `${durationMs.toFixed(1)}ms`);

      if (durationMs > SLOW_REQUEST_THRESHOLD_MS) {
        logger.warn(
          `[Performance] Slow request: ${method} ${url} took ${durationMs.toFixed(1)}ms`,
        );
      } else {
        logger.debug(
          `[Performance] ${method} ${url} completed in ${durationMs.toFixed(1)}ms`,
        );
      }

      return response;
    } catch (error) {
      const durationMs = performance.now() - start;
      logger.error(
        `[Performance] ${method} ${url} failed after ${durationMs.toFixed(1)}ms`,
        error,
      );
      throw error;
    }
  };
}
