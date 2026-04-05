import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { generatePPointAnalysis } from '@/lib/ai-analysis';
import type { AnalysisInput } from '@/lib/ai-analysis-types';
import {
  generateInputHash,
  getCachedAnalysis,
  setCachedAnalysis,
} from '@/lib/ai-cache';
import { aiAnalysisLimiter } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';

/** POST /api/ai-analysis — AI分析レポートを生成 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: '認証が必要です。ログインしてください。' },
      { status: 401 },
    );
  }

  const userId = session.user.id;

  let body: AnalysisInput;
  try {
    body = await req.json();
  } catch (error) {
    logger.warn('[ai-analysis] JSON parse error:', error);
    return NextResponse.json(
      { error: 'リクエストの形式が不正です' },
      { status: 400 },
    );
  }

  if (!body.industries?.length || !body.Y) {
    return NextResponse.json(
      { error: '分析に必要なデータが不足しています' },
      { status: 400 },
    );
  }

  // ── キャッシュチェック（トークン消費前） ──
  const inputHash = generateInputHash(body);
  const cached = getCachedAnalysis(inputHash);

  if (cached) {
    const afterCheck = aiAnalysisLimiter.check(userId);
    return NextResponse.json(
      { ...cached, cached: true },
      {
        headers: {
          'X-Cache': 'HIT',
          'X-RateLimit-Remaining': String(afterCheck.remaining),
          'X-RateLimit-Reset': afterCheck.resetAt.toISOString(),
        },
      },
    );
  }

  // レート制限チェック＋消費を原子的に実行（TOCTOU 防止）
  const consumeResult = aiAnalysisLimiter.consume(userId);
  if (!consumeResult.allowed) {
    return NextResponse.json(
      { error: 'AI分析の利用制限に達しました。しばらくしてから再度お試しください。' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': consumeResult.resetAt.toISOString(),
          'Retry-After': String(
            Math.ceil((consumeResult.resetAt.getTime() - Date.now()) / 1000),
          ),
        },
      },
    );
  }

  // ── Gemini 呼び出し ──
  try {
    const result = await generatePPointAnalysis(body);
    setCachedAnalysis(inputHash, result);
    return NextResponse.json(
      { ...result, cached: false },
      {
        headers: {
          'X-Cache': 'MISS',
          'X-RateLimit-Remaining': String(consumeResult.remaining),
          'X-RateLimit-Reset': consumeResult.resetAt.toISOString(),
        },
      },
    );
  } catch (err) {
    // エラーはキャッシュしない
    logger.error('[ai-analysis] Gemini error:', err);
    return NextResponse.json(
      {
        error:
          'AI分析の生成中にエラーが発生しました。しばらくしてから再度お試しください。',
      },
      { status: 500 },
    );
  }
}
