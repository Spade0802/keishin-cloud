import { NextRequest, NextResponse } from 'next/server';
import { RateLimiter } from '@/lib/rate-limiter';

type RouteHandler = (req: NextRequest) => Promise<NextResponse>;
type KeyExtractor = (req: NextRequest) => string | null;

/**
 * レートリミット付きルートハンドラーを返すラッパー。
 *
 * @example
 * export const POST = withRateLimit(aiAnalysisLimiter, extractUserId)(handler);
 */
export function withRateLimit(limiter: RateLimiter, keyExtractor: KeyExtractor) {
  return (handler: RouteHandler): RouteHandler => {
    return async (req: NextRequest) => {
      const key = keyExtractor(req);

      // キーが取得できない場合（未認証など）はリミットをスキップせずブロック
      if (!key) {
        return NextResponse.json(
          { error: '認証が必要です。ログインしてください。' },
          { status: 401 },
        );
      }

      // 原子的にチェック＆消費（TOCTOU 防止）
      const consumeResult = limiter.consume(key);

      if (!consumeResult.allowed) {
        return NextResponse.json(
          { error: 'AI分析の利用制限に達しました。しばらくしてから再度お試しください。' },
          {
            status: 429,
            headers: {
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': consumeResult.resetAt.toISOString(),
              'Retry-After': String(Math.ceil((consumeResult.resetAt.getTime() - Date.now()) / 1000)),
            },
          },
        );
      }

      // 本来のハンドラーを実行し、レスポンスヘッダーを付与
      const response = await handler(req);

      response.headers.set('X-RateLimit-Remaining', String(consumeResult.remaining));
      response.headers.set('X-RateLimit-Reset', consumeResult.resetAt.toISOString());

      return response;
    };
  };
}
