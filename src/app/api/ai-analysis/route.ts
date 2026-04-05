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

/** POST /api/ai-analysis — AI分析レポートを生成 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: '認証が必要です。ログインしてください。' },
      { status: 401 },
    );
  }

  // レート制限チェック（1 ユーザーあたり 1 時間 10 リクエスト）
  const userId = session.user.id;
  const rateLimitCheck = aiAnalysisLimiter.check(userId);

  if (!rateLimitCheck.allowed) {
    return NextResponse.json(
      { error: 'AI分析の利用制限に達しました。しばらくしてから再度お試しください。' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': rateLimitCheck.resetAt.toISOString(),
          'Retry-After': String(
            Math.ceil((rateLimitCheck.resetAt.getTime() - Date.now()) / 1000),
          ),
        },
      },
    );
  }

  aiAnalysisLimiter.consume(userId);

  let body: AnalysisInput;
  try {
    body = await req.json();
  } catch {
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

  // ── キャッシュチェック ──
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

  // ── Gemini 呼び出し ──
  try {
    const result = await generatePPointAnalysis(body);
    setCachedAnalysis(inputHash, result);
    const afterCheck = aiAnalysisLimiter.check(userId);
    return NextResponse.json(
      { ...result, cached: false },
      {
        headers: {
          'X-Cache': 'MISS',
          'X-RateLimit-Remaining': String(afterCheck.remaining),
          'X-RateLimit-Reset': afterCheck.resetAt.toISOString(),
        },
      },
    );
  } catch (err) {
    // エラーはキャッシュしない
    console.error('[ai-analysis] Gemini error:', err);
    return NextResponse.json(
      {
        error:
          'AI分析の生成中にエラーが発生しました。しばらくしてから再度お試しください。',
      },
      { status: 500 },
    );
  }
}
