/**
 * Vertex AI Gemini を使った経審P点分析
 *
 * 経験豊富な経審コンサルタントの視点で、P点向上のための
 * 合法的な見直し余地を分析するレポートを生成する。
 */
import { VertexAI } from '@google-cloud/vertexai';
import type { AnalysisInput, AnalysisResult } from './ai-analysis-types';
import { getAIConfig } from './settings';

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'jww-dxf-converter';
const LOCATION = 'asia-northeast1';

/** Gemini にリクエストを送り、4セクションの分析レポートを取得する */
export async function generatePPointAnalysis(
  input: AnalysisInput,
): Promise<AnalysisResult> {
  // DB設定からモデル名を取得（Vertex AI は Gemini のみ対応）
  const DEFAULT_MODEL = 'gemini-2.5-flash';
  const aiConfig = await getAIConfig();
  let modelName = DEFAULT_MODEL;
  if (aiConfig.model && aiConfig.model.startsWith('gemini')) {
    modelName = aiConfig.model;
  } else if (aiConfig.model) {
    console.warn(`[ai-analysis] Ignoring non-Gemini model "${aiConfig.model}", using ${DEFAULT_MODEL}`);
  }

  const vertexAI = new VertexAI({ project: PROJECT, location: LOCATION });
  const model = vertexAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 65536,
      responseMimeType: 'application/json',
    },
  });

  const prompt = buildPrompt(input);

  // リトライ付き生成（空レスポンス対策）
  let text = '';
  for (let attempt = 1; attempt <= 2; attempt++) {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const response = result.response;
    text = response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    if (text) break;

    const finishReason = response.candidates?.[0]?.finishReason;
    console.warn(
      `[ai-analysis] Attempt ${attempt}: empty response, finishReason=${finishReason}`
    );

    if (attempt === 2) {
      throw new Error(
        `Gemini からの応答が空でした (finishReason=${finishReason})`
      );
    }
  }

  // JSON パース（マークダウンコードブロック対応）
  let jsonText = text;
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) jsonText = codeBlockMatch[1];
  else {
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      jsonText = text.slice(firstBrace, lastBrace + 1);
    }
  }

  const parsed = JSON.parse(jsonText) as AnalysisResult;

  // 免責事項を強制付与（モデルの出力に関わらず常に設定）
  parsed.disclaimer =
    '本レポートはAI（Gemini）による自動分析であり、専門家の助言ではありません。' +
    '経営事項審査の正式な申請にあたっては、必ず行政書士・公認会計士等の専門家にご相談ください。' +
    '虚偽記載・粉飾決算は建設業法違反であり、許可取消し等の厳しい処分の対象となります。';

  return parsed;
}

function buildPrompt(input: AnalysisInput): string {
  const industriesSummary = input.industries
    .map(
      (ind) =>
        `  - ${ind.name}: X1=${ind.X1}, Z=${ind.Z} (Z1=${ind.Z1}, Z2=${ind.Z2}), P=${ind.P}`,
    )
    .join('\n');

  const industryNames = input.industries.map((ind) => ind.name);

  return `あなたは経営事項審査（経審）の専門コンサルタントです。
以下の建設業者の財務データと経審結果を分析し、P点を向上させるための
合法的な見直し余地を専門家の視点で分析してください。

【重要な前提】
- 虚偽記載・粉飾を推奨してはなりません
- すべての提案は建設業会計基準・建設業法に準拠した適法な範囲に限定してください
- 各提案にはリスク評価を含めてください
- 根拠が不明確な場合は「要確認」と明記してください
- 金額は千円単位です

【会社情報】
会社名: ${input.companyName}
決算期: ${input.period}

【算出されたスコア】
Y点: ${input.Y}
X2: ${input.X2} (X21=${input.X21}, X22=${input.X22})
W点: ${input.W} (素点合計=${input.wTotal})

【Y点指標（生値）】
${JSON.stringify(input.yResult.indicatorsRaw, null, 2)}

【Y点指標（評点換算後）】
${JSON.stringify(input.yResult.indicators, null, 2)}

営業CF: ${input.yResult.operatingCF} 千円

【業種別スコア】
${industriesSummary}

${input.wDetail ? `【W点内訳】\nw1=${input.wDetail.w1}, w2=${input.wDetail.w2}, w3=${input.wDetail.w3}, w4=${input.wDetail.w4}, w5=${input.wDetail.w5}, w6=${input.wDetail.w6}, w7=${input.wDetail.w7}, w8=${input.wDetail.w8}` : ''}

${input.bs ? `【経審用BS（千円）】\n${JSON.stringify(input.bs, null, 2)}` : ''}

${input.pl ? `【経審用PL（千円）】\n${JSON.stringify(input.pl, null, 2)}` : ''}

以下の4セクションの分析結果をJSON形式で出力してください。
業種名は必ず次の名前を使用してください: ${JSON.stringify(industryNames)}

出力形式:
{
  "reclassificationReview": [
    {
      "no": 1,
      "item": "項目名",
      "currentTreatment": "現在の処理",
      "alternativePlan": "代替処理案",
      "legality": "適法性・根拠",
      "requiredDocuments": "必要証憑",
      "yImpact": "Y影響（例: +5〜10）",
      "xImpact": "X影響",
      "zImpact": "Z影響",
      "wImpact": "W影響",
      "pImpact": "P影響（例: +3〜5）",
      "assessment": "採用余地あり|要確認|非推奨|—",
      "risk": "リスク説明"
    }
  ],
  "simulationComparison": [
    {
      "label": "Case A",
      "description": "現状ベース",
      "assumptions": {"key": "value"},
      "scores": {
        "y": ${input.Y},
        "x2": ${input.X2},
        "z": {${industryNames.map((n) => `"${n}": 0`).join(', ')}},
        "w": ${input.W},
        "p": {${industryNames.map((n) => `"${n}": 0`).join(', ')}}
      }
    }
  ],
  "itemAssessments": [
    {
      "category": "confirmed|reviewable|insufficientBasis|shouldNotDo",
      "item": "項目名",
      "currentPImpact": "現状P影響",
      "revisedPImpact": "見直し後P影響",
      "action": "対応内容"
    }
  ],
  "riskPoints": [
    {
      "topic": "論点",
      "riskContent": "リスク内容",
      "severity": "高|中|低",
      "response": "対応方針"
    }
  ],
  "summary": "全体の分析サマリー（200文字程度）"
}

【分析の観点（必ず検討してください）】
1. 再分類レビュー:
   - 雑収入を完成工事高に振替できるか
   - 資本性借入金の認定可否
   - 支払利息から手形割引料を分離できるか
   - 減価償却費の網羅性（製造原価への配賦確認）
   - 技術職員の資格・講習確認
   - CPD/CCUS実績の確認
   - 各科目について6件以上の見直し項目を検討してください

2. シミュレーション:
   - Case A: 現状ベース（入力データそのまま）
   - Case B: 最適化ケース（全見直しを適用した場合）
   - Case C: 保守的ケース（確実に適用できるもののみ）
   - P点計算式: P = 0.25×X1 + 0.15×X2 + 0.20×Y + 0.25×Z + 0.15×W

3. 項目判定:
   - そのまま確定してよい（confirmed）
   - 見直し余地あり（reviewable）
   - 根拠不足（insufficientBasis）
   - 実施すべきでない（shouldNotDo）

4. リスク論点:
   - 異常値・要注意項目を指摘
   - 税務調査リスク
   - 審査機関での指摘リスク

JSONのみを出力し、それ以外の文字列は含めないでください。`;
}
