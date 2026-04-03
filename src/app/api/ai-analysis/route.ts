import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { generatePPointAnalysis } from '@/lib/ai-analysis';
import type { AnalysisInput } from '@/lib/ai-analysis-types';

// TODO: レート制限を追加する（1ユーザーあたり1日5回程度が目安）
// Redis/Upstash 等でカウント管理するか、DB に ai_analysis_logs テーブルを作る

/** POST /api/ai-analysis — AI分析レポートを生成 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: '認証が必要です。ログインしてください。' },
      { status: 401 },
    );
  }

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

  try {
    const result = await generatePPointAnalysis(body);
    return NextResponse.json(result);
  } catch (err) {
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
