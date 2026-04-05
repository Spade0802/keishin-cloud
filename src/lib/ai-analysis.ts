/**
 * Gemini を使った経審P点分析
 *
 * 経験豊富な経審コンサルタントの視点で、P点向上のための
 * 合法的な見直し余地を分析するレポートを生成する。
 *
 * Vertex AI（無料）と Google AI Studio APIキー（有料）の両方に対応。
 */
import type { AnalysisInput, AnalysisResult } from './ai-analysis-types';
import { getAIConfig } from './settings';

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'jww-dxf-converter';
const LOCATION = 'asia-northeast1';
const DEFAULT_MODEL = 'gemini-2.5-flash';

/** Gemini にリクエストを送り、4セクションの分析レポートを取得する */
export async function generatePPointAnalysis(
  input: AnalysisInput,
): Promise<AnalysisResult> {
  const aiConfig = await getAIConfig();
  const modelName =
    aiConfig.model && aiConfig.model.startsWith('gemini')
      ? aiConfig.model
      : DEFAULT_MODEL;

  const prompt = buildPrompt(input);

  // リトライ付き生成（空レスポンス対策）
  let text = '';
  for (let attempt = 1; attempt <= 2; attempt++) {
    let responseText = '';

    if (aiConfig.provider === 'gemini-paid' && aiConfig.apiKey) {
      // ── Gemini Paid API（429時はVertex AIにフォールバック） ──
      try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(aiConfig.apiKey);
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            responseMimeType: 'application/json' as const,
            temperature: 0.3,
            maxOutputTokens: 65536,
          },
        });
        console.log(`[ai-analysis] Using Gemini Paid API (${modelName}), attempt ${attempt}`);
        const result = await model.generateContent(prompt);
        responseText = result.response.text() ?? '';
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        if (errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('Too Many Requests')) {
          console.warn(`[ai-analysis] Gemini Paid rate limited, falling back to Vertex AI: ${errMsg.slice(0, 200)}`);
          const { VertexAI } = await import('@google-cloud/vertexai');
          const vertexAI = new VertexAI({ project: PROJECT, location: LOCATION });
          const model = vertexAI.getGenerativeModel({
            model: modelName,
            generationConfig: { temperature: 0.3, maxOutputTokens: 65536, responseMimeType: 'application/json' },
          });
          console.log(`[ai-analysis] Retrying with Vertex AI (${modelName}), attempt ${attempt}`);
          const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
          });
          responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        } else {
          throw err;
        }
      }
    } else {
      // ── Vertex AI ──
      const { VertexAI } = await import('@google-cloud/vertexai');
      const vertexAI = new VertexAI({ project: PROJECT, location: LOCATION });
      const model = vertexAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 65536,
          responseMimeType: 'application/json',
        },
      });
      console.log(`[ai-analysis] Using Vertex AI (${modelName}), attempt ${attempt}`);
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });
      responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    }

    text = responseText;

    if (text) break;

    console.warn(`[ai-analysis] Attempt ${attempt}: empty response`);

    if (attempt === 2) {
      throw new Error('Gemini からの応答が空でした');
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

  // 新フィールドのデフォルト値（旧モデル出力との互換性）
  if (!parsed.impactRanking) parsed.impactRanking = [];
  if (!parsed.checklistItems) parsed.checklistItems = [];

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
以下の入力データのみに基づいて分析してください。

## ★最重要ルール
- **入力データに存在する数値だけを使ってください。**
- **入力データにない金額・件数・割合を推測・創作しないでください。**
- 具体的な金額や件数が不明な提案は「金額は要確認」「件数は要確認」と書いてください。
- 「例えば〇〇万円の振替が可能」のような具体的な架空の数値は絶対に書かないでください。
- 虚偽記載・粉飾を推奨してはなりません。
- 金額は千円単位です。

## 入力データ

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

## 分析内容

以下の6セクションをJSON形式で出力してください。
業種名は必ず次の名前を使用してください: ${JSON.stringify(industryNames)}

### 1. 再分類レビュー（reclassificationReview）
入力データを見て、P点向上の可能性がある項目を検討してください。
- **入力データから読み取れる事実のみ**を根拠にすること。
- 具体的な振替金額が入力データから算出できない場合は「要確認」と書く。
- 提案ごとに適法性の根拠と必要書類を明記する。
- **各項目に affectedFields を含めてください。** これは再分類を適用した場合のYInput各フィールドへの差分（千円）です。
  - 使用可能なフィールド: sales, grossProfit, ordinaryProfit, interestExpense, interestDividendIncome, currentLiabilities, fixedLiabilities, totalCapital, equity, fixedAssets, retainedEarnings, corporateTax, depreciation, allowanceDoubtful, notesAndAccountsReceivable, constructionPayable, inventoryAndMaterials, advanceReceived
  - 例: 雑収入12,000千円を完成工事高に振替 → { "sales": 12000, "grossProfit": 12000 }
  - 例: 60,000千円の資本性借入金認定 → { "equity": 60000, "fixedLiabilities": -60000 }
  - 金額が不明な場合は空オブジェクト {} を設定してください。

### 2. シミュレーション（simulationComparison）
3ケースを出力：
- Case A: 現状ベース（入力データのスコアをそのまま記載）
- Case B: 最適化ケース（見直し余地がある項目を全て適用した場合の上限値）
- Case C: 保守的ケース（確実に適用できる項目のみ）
※ Case Aのscoresは入力データの値を正確に使ってください。

### 3. 項目判定（itemAssessments）
入力データの各スコア（Y, X2, W各項目）について：
- confirmed: 現状で問題なし（そのまま確定してよい）
- reviewable: 見直し余地あり
- insufficientBasis: 判断材料不足（点数影響あるが根拠不足）
- shouldNotDo: 実施すべきでない（虚偽記載・粉飾に該当等）

### 4. リスク論点（riskPoints）
入力データから読み取れる異常値・注意点のみ指摘。

### 5. P点改善インパクト順ランキング（impactRanking）
再分類レビューの各項目を、P点への影響が大きい順にランキング。

### 6. 確認すべき事項チェックリスト（checklistItems）
経理担当・税理士・行政書士へ確認すべき具体的な事項の一覧。

## 出力JSON形式
{
  "reclassificationReview": [
    {
      "no": 1,
      "item": "項目名",
      "currentTreatment": "入力データから読み取れる現在の処理",
      "alternativePlan": "代替処理案",
      "legality": "適法性・根拠",
      "requiredDocuments": "必要証憑",
      "yImpact": "Y影響",
      "xImpact": "X影響",
      "zImpact": "Z影響",
      "wImpact": "W影響",
      "pImpact": "P影響",
      "assessment": "採用余地あり|要確認|非推奨",
      "risk": "リスク説明",
      "affectedFields": {"sales": 12000, "grossProfit": 12000}
    }
  ],
  "simulationComparison": [
    {
      "label": "Case A",
      "description": "現状ベース",
      "assumptions": {},
      "scores": {
        "y": ${input.Y},
        "x2": ${input.X2},
        "z": {${industryNames.map((n, i) => `"${n}": ${input.industries[i]?.Z ?? 0}`).join(', ')}},
        "w": ${input.W},
        "p": {${industryNames.map((n, i) => `"${n}": ${input.industries[i]?.P ?? 0}`).join(', ')}}
      }
    },
    {
      "label": "Case B",
      "description": "最適化",
      "assumptions": {"項目名": "変更内容"},
      "scores": {"y": 0, "x2": 0, "z": {}, "w": 0, "p": {}}
    },
    {
      "label": "Case C",
      "description": "保守的",
      "assumptions": {"項目名": "変更内容"},
      "scores": {"y": 0, "x2": 0, "z": {}, "w": 0, "p": {}}
    }
  ],
  "itemAssessments": [
    {
      "category": "confirmed|reviewable|insufficientBasis|shouldNotDo",
      "item": "項目名",
      "currentPImpact": "入力データの値",
      "revisedPImpact": "見直し後の見込み（不明なら「要確認」）",
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
  "impactRanking": [
    {
      "rank": 1,
      "item": "項目名",
      "pImpact": "P影響（概算）",
      "comment": "コメント"
    }
  ],
  "checklistItems": [
    {
      "item": "確認事項の具体的内容",
      "target": "確認先（経理・税理士・行政書士等）"
    }
  ],
  "summary": "入力データに基づく全体の分析サマリー（200文字程度）"
}

JSONのみを出力してください。`;
}
