/**
 * Gemini を使った経審P点分析
 *
 * 経験豊富な経審コンサルタントの視点で、P点向上のための
 * 合法的な見直し余地を分析するレポートを生成する。
 *
 * Vertex AI（無料）と Google AI Studio APIキー（有料）の両方に対応。
 */
import { z } from 'zod';
import type { AnalysisInput, AnalysisResult, ReclassificationItem } from './ai-analysis-types';
import { getGeminiModel, isRateLimitError } from './gemini-client';
import { logger } from './logger';
import { calculateY } from './engine/y-calculator';
import { calculateP, calculateX2 } from './engine/p-calculator';
import { lookupScore, X21_TABLE, X22_TABLE } from './engine/score-tables';

// ── Zod schema for AI response validation ──

const ReclassificationItemSchema = z.object({
  no: z.number(),
  item: z.string(),
  currentTreatment: z.string(),
  alternativePlan: z.string(),
  legality: z.string(),
  requiredDocuments: z.string(),
  yImpact: z.string(),
  xImpact: z.string(),
  zImpact: z.string(),
  wImpact: z.string(),
  pImpact: z.string(),
  assessment: z.enum(['採用余地あり', '要確認', '非推奨', '—']).catch('要確認'),
  risk: z.string(),
  affectedFields: z.record(z.string(), z.number()).optional().default({}),
}).passthrough();

const SimulationScoresSchema = z.object({
  y: z.number(),
  x2: z.number(),
  z: z.record(z.string(), z.number()),
  w: z.number(),
  p: z.record(z.string(), z.number()),
}).passthrough();

const SimulationCaseSchema = z.object({
  label: z.string(),
  description: z.string(),
  assumptions: z.record(z.string(), z.string()).catch({}),
  scores: SimulationScoresSchema,
}).passthrough();

const ItemAssessmentSchema = z.object({
  category: z.enum(['confirmed', 'reviewable', 'insufficientBasis', 'shouldNotDo']).catch('reviewable'),
  item: z.string(),
  currentPImpact: z.string(),
  revisedPImpact: z.string(),
  action: z.string(),
}).passthrough();

const RiskPointSchema = z.object({
  topic: z.string(),
  riskContent: z.string(),
  severity: z.enum(['高', '中', '低']).catch('中'),
  response: z.string(),
}).passthrough();

const ImpactRankingItemSchema = z.object({
  rank: z.number(),
  item: z.string(),
  pImpact: z.string(),
  comment: z.string(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional().default('medium'),
  difficultyLabel: z.string().optional(),
}).passthrough();

const ChecklistItemSchema = z.object({
  item: z.string(),
  target: z.string(),
}).passthrough();

const AccountMappingSuggestionSchema = z.object({
  accountName: z.string(),
  currentMapping: z.string(),
  suggestedMapping: z.string(),
  rationale: z.string(),
  pImpact: z.string(),
  yImpact: z.string(),
  risk: z.enum(['low', 'medium', 'high']).catch('medium'),
  assessment: z.enum(['採用余地あり', '要確認', '非推奨']).catch('要確認'),
}).passthrough();

const TrendInsightsSchema = z.object({
  overallTrend: z.string(),
  keyChanges: z.array(z.string()),
  riskFromTrend: z.string(),
}).passthrough();

export const AnalysisResultSchema = z.object({
  reclassificationReview: z.array(ReclassificationItemSchema).catch([]),
  simulationComparison: z.array(SimulationCaseSchema).catch([]),
  itemAssessments: z.array(ItemAssessmentSchema).catch([]),
  riskPoints: z.array(RiskPointSchema).catch([]),
  impactRanking: z.array(ImpactRankingItemSchema).optional().default([]),
  checklistItems: z.array(ChecklistItemSchema).optional().default([]),
  accountMappingSuggestions: z.array(AccountMappingSuggestionSchema).optional().default([]),
  trendInsights: TrendInsightsSchema.optional(),
  summary: z.string().catch('（サマリーの生成に失敗しました）'),
  disclaimer: z.string().optional().default(''),
}).passthrough();

/** Gemini にリクエストを送り、4セクションの分析レポートを取得する */
export async function generatePPointAnalysis(
  input: AnalysisInput,
): Promise<AnalysisResult> {
  const { provider, modelName, model, getVertexModel } = await getGeminiModel();

  const prompt = buildPrompt(input);

  // リトライ付き生成（空レスポンス対策）
  let text = '';
  for (let attempt = 1; attempt <= 2; attempt++) {
    let responseText = '';

    if (provider === 'gemini-paid') {
      // ── Gemini Paid API（429時はVertex AIにフォールバック） ──
      try {
        logger.info(`[ai-analysis] Using Gemini Paid API (${modelName}), attempt ${attempt}`);
        const result = await model.generateContent(prompt);
        responseText = result.response.text() ?? '';
      } catch (err: unknown) {
        if (isRateLimitError(err)) {
          const errMsg = err instanceof Error ? err.message : String(err);
          logger.warn(`[ai-analysis] Gemini Paid rate limited, falling back to Vertex AI: ${errMsg.slice(0, 200)}`);
          const vertexModel = getVertexModel();
          logger.info(`[ai-analysis] Retrying with Vertex AI (${modelName}), attempt ${attempt}`);
          const result = await vertexModel.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
          });
          responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        } else {
          throw err;
        }
      }
    } else {
      // ── Vertex AI ──
      logger.info(`[ai-analysis] Using Vertex AI (${modelName}), attempt ${attempt}`);
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });
      responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    }

    text = responseText;

    if (text) break;

    logger.warn(`[ai-analysis] Attempt ${attempt}: empty response`);

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

  let rawParsed: unknown;
  try {
    rawParsed = JSON.parse(jsonText);
  } catch (e) {
    logger.error('[ai-analysis] JSON parse failed:', (e as Error).message);
    logger.error('[ai-analysis] Raw text (first 500 chars):', jsonText.slice(0, 500));
    throw new Error('Gemini の応答を JSON としてパースできませんでした');
  }

  const validationResult = AnalysisResultSchema.safeParse(rawParsed);
  if (!validationResult.success) {
    logger.error('[ai-analysis] Zod validation failed:', JSON.stringify(validationResult.error.issues, null, 2));
    throw new Error(
      `Gemini の応答が期待する形式と一致しません: ${validationResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
    );
  }

  const parsed = validationResult.data as AnalysisResult;

  // impactRanking の difficultyLabel デフォルト値
  for (const item of parsed.impactRanking) {
    if (!item.difficultyLabel) {
      item.difficultyLabel = item.difficulty === 'easy' ? '簡単' : item.difficulty === 'hard' ? '困難' : '普通';
    }
  }

  // ── シミュレーション Case A/B/C のスコアをサーバー側で再計算 ──
  // AIは計算が苦手なので、reclassificationReview の affectedFields を使って
  // 実際のエンジンで再計算する
  recalculateSimulationScores(parsed, input);

  // 免責事項を強制付与（モデルの出力に関わらず常に設定）
  parsed.disclaimer =
    '本レポートはAI（Gemini）による自動分析であり、専門家の助言ではありません。' +
    '経営事項審査の正式な申請にあたっては、必ず行政書士・公認会計士等の専門家にご相談ください。' +
    '虚偽記載・粉飾決算は建設業法違反であり、許可取消し等の厳しい処分の対象となります。';

  return parsed;
}

// ─── シミュレーションスコアのサーバー側再計算 ───

/**
 * reclassificationReview の affectedFields を集約して YInput に適用し、
 * Y → X2 → P を再計算する。
 *
 * Case A: 現状そのまま（入力値を正確に設定）
 * Case B: 全ての「採用余地あり」+「要確認」項目を適用（上限シナリオ）
 * Case C: 「採用余地あり」のみ適用（保守的シナリオ）
 */
function recalculateSimulationScores(
  result: AnalysisResult,
  input: AnalysisInput,
): void {
  if (!input.yInput || result.simulationComparison.length < 3) return;

  const review = result.reclassificationReview ?? [];

  // affectedFields が有効（非空オブジェクト）な項目のみ対象
  const hasFields = (item: ReclassificationItem) =>
    item.affectedFields && Object.keys(item.affectedFields).length > 0;

  // affectedFields が空の項目を警告
  const emptyItems = review.filter((r) => r.assessment !== '非推奨' && !hasFields(r));
  if (emptyItems.length > 0) {
    logger.warn(`[ai-analysis] ${emptyItems.length}件の再分類項目で affectedFields が空: ${emptyItems.map((r) => r.item).join(', ')}`);
  }

  // Case B: 非推奨以外の全項目
  const caseBItems = review.filter(
    (r) => r.assessment !== '非推奨' && hasFields(r),
  );
  // Case C: 採用余地ありのみ
  const caseCItems = review.filter(
    (r) => r.assessment === '採用余地あり' && hasFields(r),
  );

  logger.info(`[ai-analysis] Reclassification items: total=${review.length}, withFields(B)=${caseBItems.length}, withFields(C)=${caseCItems.length}`);

  // affectedFields を合算してデルタを作る
  function mergeDeltas(items: ReclassificationItem[]): Record<string, number> {
    const delta: Record<string, number> = {};
    for (const item of items) {
      for (const [key, val] of Object.entries(item.affectedFields ?? {})) {
        delta[key] = (delta[key] ?? 0) + val;
      }
    }
    return delta;
  }

  // YInput にデルタを適用して新しい YInput を作成
  function applyDelta(delta: Record<string, number>) {
    const base = input.yInput!;
    return {
      ...base,
      sales: base.sales + (delta.sales ?? 0),
      grossProfit: base.grossProfit + (delta.grossProfit ?? 0),
      ordinaryProfit: base.ordinaryProfit + (delta.ordinaryProfit ?? 0),
      interestExpense: base.interestExpense + (delta.interestExpense ?? 0),
      interestDividendIncome: base.interestDividendIncome + (delta.interestDividendIncome ?? 0),
      currentLiabilities: base.currentLiabilities + (delta.currentLiabilities ?? 0),
      fixedLiabilities: base.fixedLiabilities + (delta.fixedLiabilities ?? 0),
      totalCapital: base.totalCapital + (delta.totalCapital ?? 0),
      equity: base.equity + (delta.equity ?? 0),
      fixedAssets: base.fixedAssets + (delta.fixedAssets ?? 0),
      retainedEarnings: base.retainedEarnings + (delta.retainedEarnings ?? 0),
      corporateTax: base.corporateTax + (delta.corporateTax ?? 0),
      depreciation: base.depreciation + (delta.depreciation ?? 0),
      allowanceDoubtful: base.allowanceDoubtful + (delta.allowanceDoubtful ?? 0),
      notesAndAccountsReceivable: base.notesAndAccountsReceivable + (delta.notesAndAccountsReceivable ?? 0),
      constructionPayable: base.constructionPayable + (delta.constructionPayable ?? 0),
      inventoryAndMaterials: base.inventoryAndMaterials + (delta.inventoryAndMaterials ?? 0),
      advanceReceived: base.advanceReceived + (delta.advanceReceived ?? 0),
    };
  }

  // スコア計算
  function calcScores(delta: Record<string, number>) {
    const modifiedInput = applyDelta(delta);
    const yResult = calculateY(modifiedInput);
    const newY = yResult.Y;

    // X2: equity/ebitda が変わった場合は再計算
    const newEquity = input.yInput!.equity + (delta.equity ?? 0);
    const newEbitda = (input.ebitda ?? 0) +
      (delta.ordinaryProfit ?? 0) +
      (delta.depreciation ?? 0) -
      (delta.interestDividendIncome ?? 0);

    let newX2 = input.X2;
    try {
      const x21 = lookupScore(X21_TABLE, newEquity);
      const x22 = lookupScore(X22_TABLE, newEbitda);
      newX2 = calculateX2(x21, x22);
    } catch {
      // テーブル外の値の場合は現状維持
    }

    // W, Z は再分類では基本変わらない
    const newW = input.W;

    // 業種別P点
    const zMap: Record<string, number> = {};
    const pMap: Record<string, number> = {};
    for (const ind of input.industries) {
      zMap[ind.name] = ind.Z;
      pMap[ind.name] = calculateP(ind.X1, newX2, newY, ind.Z, newW);
    }

    return { y: newY, x2: newX2, z: zMap, w: newW, p: pMap };
  }

  // Case A: 入力データの値を正確に反映（AIの計算を信用しない）
  const caseA = result.simulationComparison[0];
  caseA.scores.y = input.Y;
  caseA.scores.x2 = input.X2;
  caseA.scores.w = input.W;
  for (const ind of input.industries) {
    caseA.scores.z[ind.name] = ind.Z;
    caseA.scores.p[ind.name] = ind.P;
  }

  // Case B: 最適化
  const deltaBItems = mergeDeltas(caseBItems);
  if (Object.keys(deltaBItems).length > 0) {
    const scoresB = calcScores(deltaBItems);
    result.simulationComparison[1].scores = scoresB;
    logger.info(`[ai-analysis] Recalculated Case B: Y=${scoresB.y}, X2=${scoresB.x2}, P=${JSON.stringify(scoresB.p)}`);
  } else {
    // affectedFields がない場合は現状と同じ値にする
    result.simulationComparison[1].scores = { ...caseA.scores };
    logger.info('[ai-analysis] Case B: no affectedFields, using Case A scores');
  }

  // Case C: 保守的
  const deltaCItems = mergeDeltas(caseCItems);
  if (Object.keys(deltaCItems).length > 0) {
    const scoresC = calcScores(deltaCItems);
    result.simulationComparison[2].scores = scoresC;
    logger.info(`[ai-analysis] Recalculated Case C: Y=${scoresC.y}, X2=${scoresC.x2}, P=${JSON.stringify(scoresC.p)}`);
  } else {
    result.simulationComparison[2].scores = { ...caseA.scores };
    logger.info('[ai-analysis] Case C: no affectedFields, using Case A scores');
  }
}

function buildPrompt(input: AnalysisInput): string {
  const industriesSummary = input.industries
    .map(
      (ind) =>
        `  - ${ind.name}: X1=${ind.X1}, Z=${ind.Z} (Z1=${ind.Z1}, Z2=${ind.Z2}), P=${ind.P}`,
    )
    .join('\n');

  const industryNames = input.industries.map((ind) => ind.name);

  // Y計算に使うフィールド値をプロンプトに含める（AIが具体的な差分を計算するため）
  const yInputSummary = input.yInput ? `
【Y点計算の入力値（千円）】
完成工事高(sales): ${input.yInput.sales}
完成工事総利益(grossProfit): ${input.yInput.grossProfit}
経常利益(ordinaryProfit): ${input.yInput.ordinaryProfit}
支払利息(interestExpense): ${input.yInput.interestExpense}
受取利息配当(interestDividendIncome): ${input.yInput.interestDividendIncome}
流動負債(currentLiabilities): ${input.yInput.currentLiabilities}
固定負債(fixedLiabilities): ${input.yInput.fixedLiabilities}
総資本(totalCapital): ${input.yInput.totalCapital}
自己資本(equity): ${input.yInput.equity}
固定資産(fixedAssets): ${input.yInput.fixedAssets}
利益剰余金(retainedEarnings): ${input.yInput.retainedEarnings}
法人税等(corporateTax): ${input.yInput.corporateTax}
減価償却(depreciation): ${input.yInput.depreciation}
貸倒引当金(allowanceDoubtful): ${input.yInput.allowanceDoubtful}
受取手形+完成未収(notesAndAccountsReceivable): ${input.yInput.notesAndAccountsReceivable}
工事未払金(constructionPayable): ${input.yInput.constructionPayable}
未成工事支出金+材料(inventoryAndMaterials): ${input.yInput.inventoryAndMaterials}
未成工事受入金(advanceReceived): ${input.yInput.advanceReceived}

EBITDA: ${input.ebitda ?? '不明'}
` : '';

  return `あなたは経営事項審査（経審）の専門コンサルタントです。
以下の入力データに基づいて分析してください。

## ★最重要ルール
- **入力データに存在する数値を使って、具体的な金額で提案してください。**
- BSやPLに記載されている金額を根拠に、振替金額を具体的に算出してください。
- 虚偽記載・粉飾を推奨してはなりません。
- 金額は千円単位です。

## P点計算式（分析の基礎知識）
P = 0.25×X1 + 0.15×X2 + 0.20×Y + 0.25×Z + 0.15×W
- X1: 完成工事高から算出（再分類では変わらない）
- X2 = floor((X21+X22)/2)  X21=自己資本額テーブル  X22=EBITDAテーブル
- Y: 8つの経営指標から算出（BSやPLの振替で変動する）
- Z: 技術力（再分類では変わらない）
- W = floor(素点合計×1750/200)  社会性等

**Y点に影響する主な操作:**
- 売上高(sales)変動 → x1(純支払利息比率), x2(負債回転期間), x3(売上総利益率), x4(売上高経常利益率)
- 自己資本(equity)変動 → x5(自己資本対固定資産比率), x6(自己資本比率)
- 固定負債→自己資本への振替（資本性借入金認定） → equity増, fixedLiabilities減 → x5, x6改善
- 兼業売上→完成工事高への振替 → sales増, grossProfit増 → x1〜x4改善

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
${yInputSummary}
【業種別スコア】
${industriesSummary}

${input.wDetail ? `【W点内訳】\nw1=${input.wDetail.w1}, w2=${input.wDetail.w2}, w3=${input.wDetail.w3}, w4=${input.wDetail.w4}, w5=${input.wDetail.w5}, w6=${input.wDetail.w6}, w7=${input.wDetail.w7}, w8=${input.wDetail.w8}` : ''}

${input.bs ? `【経審用BS（千円）】\n${JSON.stringify(input.bs, null, 2)}` : ''}

${input.pl ? `【経審用PL（千円）】\n${JSON.stringify(input.pl, null, 2)}` : ''}

${input.rawBsData ? `【BS生データ（変換前・円）】\n${JSON.stringify(input.rawBsData, null, 2)}` : ''}

${input.previousPeriodData ? `【前期データ】
決算期: ${input.previousPeriodData.period}
Y点: ${input.previousPeriodData.Y}
X2: ${input.previousPeriodData.X2}
W点: ${input.previousPeriodData.W}
業種別スコア:
${input.previousPeriodData.industries.map((ind) => `  - ${ind.name}: X1=${ind.X1}, Z=${ind.Z}, P=${ind.P}`).join('\n')}
${input.previousPeriodData.yResult ? `前期Y点指標（生値）:\n${JSON.stringify(input.previousPeriodData.yResult.indicatorsRaw, null, 2)}` : ''}` : ''}

## 分析内容

以下のセクションをJSON形式で出力してください（前期データがある場合は8セクション、ない場合は7セクション）。
業種名は必ず次の名前を使用してください: ${JSON.stringify(industryNames)}

### 1. 再分類レビュー（reclassificationReview）
入力データのBS・PLを見て、P点向上の可能性がある再分類を検討してください。

★★★ affectedFields が最重要です ★★★
- **各項目に必ず affectedFields（千円単位の差分）を設定してください。**
- BSやPLの具体的な金額を使って差分を計算してください。
- 金額が部分的にしか振替できない場合は、保守的に見積もった金額で設定してください。
- **空オブジェクト {} は禁止です。** 差分が算出できない項目は提案しないでください。

affectedFields のフィールド一覧と意味:
- sales: 完成工事高の増減
- grossProfit: 完成工事総利益の増減
- ordinaryProfit: 経常利益の増減
- interestExpense: 支払利息の増減
- interestDividendIncome: 受取利息配当の増減
- currentLiabilities: 流動負債の増減
- fixedLiabilities: 固定負債の増減
- totalCapital: 総資本の増減
- equity: 自己資本の増減
- fixedAssets: 固定資産の増減
- retainedEarnings: 利益剰余金の増減
- corporateTax: 法人税等の増減
- depreciation: 減価償却実施額の増減
- allowanceDoubtful: 貸倒引当金の増減
- notesAndAccountsReceivable: 受取手形+完成工事未収入金の増減
- constructionPayable: 工事未払金の増減
- inventoryAndMaterials: 未成工事支出金+材料の増減
- advanceReceived: 未成工事受入金の増減

典型的な再分類パターン:
1. 兼業事業売上高→完成工事高振替: { "sales": 金額, "grossProfit": 金額 }
2. 資本性借入金認定: { "equity": 金額, "fixedLiabilities": -金額 }
3. 流動資産→固定資産の区分変更: { "fixedAssets": 金額 }（流動から固定へ）
4. 長期前払費用の流動資産化: { "fixedAssets": -金額 }（固定から流動へ）
5. 特別利益の売上振替: { "sales": 金額, "grossProfit": 金額 }

### 2. シミュレーション（simulationComparison）
3ケースを出力：
- Case A: 現状ベース（入力データのスコアをそのまま記載）
- Case B: 最適化ケース（再分類レビューの全項目を適用）
- Case C: 保守的ケース（「採用余地あり」の項目のみ適用）
※ scores の数値はシステムが再計算するので 0 で構いません。assumptions にどの項目を適用したか記載してください。

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
各項目に実現難易度（difficulty）を評価してください：
- "easy"（簡単）: 書類準備のみで対応可能、専門家判断不要
- "medium"（普通）: 専門家との確認が必要、一定の準備期間が必要
- "hard"（困難）: 大幅な体制変更や長期間の準備が必要、リスクが高い
difficultyLabel には日本語ラベル（簡単/普通/困難）を設定してください。

### 6. 確認すべき事項チェックリスト（checklistItems）
経理担当・税理士・行政書士へ確認すべき具体的な事項の一覧。

### 7. 勘定科目マッピング提案（accountMappingSuggestions）
決算書の勘定科目の経審用分類について、P点を改善できる可能性のある代替マッピングを提案してください。

以下の観点で分析:
- 有価証券の流動/固定区分変更の影響
- 長期前払費用の内容による区分変更
- 建物付属設備の区分
- 繰延税金資産の処理
- その他、会計基準上認められる範囲での再分類

各提案について:
- accountName: 対象科目名
- currentMapping: 現在の区分
- suggestedMapping: 提案する区分
- rationale: 会計上の根拠
- pImpact: P点への影響（具体的な点数変動）
- yImpact: Y点指標への影響
- risk: リスクレベル (low/medium/high)
- assessment: 評価 (採用余地あり/要確認/非推奨)

※ BS生データがある場合はそれを参照して具体的な科目・金額に基づく提案を行ってください。
※ 提案は会計基準上認められる範囲に限定し、虚偽記載に該当するものは含めないでください。

${input.previousPeriodData ? `### 8. 期間推移分析（trendInsights）
前期データと当期データを比較して、以下を分析してください：
- overallTrend: 全体的な推移傾向（改善/悪化/横ばいなど、200文字程度で具体的に）
- keyChanges: 主要な変化点（各指標の増減とその要因の推察、3〜5項目）
- riskFromTrend: 推移から読み取れるリスク（今後の経審で注意すべき点）` : ''}

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
      "affectedFields": {"equity": 60000, "fixedLiabilities": -60000}
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
      "description": "最適化（全項目適用）",
      "assumptions": {"適用する再分類項目のno": "適用内容を記載"},
      "scores": {"y": 0, "x2": 0, "z": {}, "w": 0, "p": {}}
    },
    {
      "label": "Case C",
      "description": "保守的（採用余地あり項目のみ）",
      "assumptions": {"適用する再分類項目のno": "適用内容を記載"},
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
      "comment": "コメント",
      "difficulty": "easy|medium|hard",
      "difficultyLabel": "簡単|普通|困難"
    }
  ],
  "checklistItems": [
    {
      "item": "確認事項の具体的内容",
      "target": "確認先（経理・税理士・行政書士等）"
    }
  ],
  "accountMappingSuggestions": [
    {
      "accountName": "科目名",
      "currentMapping": "現在の区分",
      "suggestedMapping": "提案する区分",
      "rationale": "会計上の根拠",
      "pImpact": "P点への影響",
      "yImpact": "Y点指標への影響",
      "risk": "low|medium|high",
      "assessment": "採用余地あり|要確認|非推奨"
    }
  ],
  ${input.previousPeriodData ? `"trendInsights": {
    "overallTrend": "全体的な推移傾向の分析",
    "keyChanges": ["変化点1", "変化点2", "変化点3"],
    "riskFromTrend": "推移から読み取れるリスク"
  },` : ''}
  "summary": "入力データに基づく全体の分析サマリー（200文字程度）"
}

JSONのみを出力してください。`;
}
