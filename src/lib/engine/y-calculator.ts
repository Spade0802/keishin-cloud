/**
 * Y点計算エンジン
 *
 * 営業CF算出 → 8指標算出 → A算出 → Y算出
 *
 * ★重要ルール（実績検証済み）:
 * 1. 仕入債務 = 工事未払金（★未払経費を含めない）
 * 2. 法人税等は経審用PL上の千円値を使用
 * 3. x4の上限5.1でキャップ
 * 4. 総資本2期平均が3,000万円未満の場合は3,000万円とみなす
 */

import type { YInput, YResult } from './types';

const LIMITS = {
  x1: { min: -0.3, max: 5.1 },
  x2: { min: 0.9, max: 18.0 },
  x3: { min: 6.5, max: 63.6 },
  x4: { min: -8.5, max: 5.1 },
  x5: { min: -76.5, max: 350.0 },
  x6: { min: -68.6, max: 68.5 },
  x7: { min: -10.0, max: 15.0 },
  x8: { min: -3.0, max: 100.0 },
};

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * 営業CF算出
 */
export function calculateOperatingCF(input: YInput): {
  cf: number;
  detail: YResult['operatingCFDetail'];
} {
  const allowanceChange =
    input.allowanceDoubtful - input.prev.allowanceDoubtful;
  const receivableChange =
    input.notesAndAccountsReceivable - input.prev.notesAndAccountsReceivable;
  const payableChange =
    input.constructionPayable - input.prev.constructionPayable;
  const inventoryChange =
    input.inventoryAndMaterials - input.prev.inventoryAndMaterials;
  const advanceChange = input.advanceReceived - input.prev.advanceReceived;

  const cf =
    input.ordinaryProfit +
    input.depreciation -
    input.corporateTax +
    allowanceChange -
    receivableChange +
    payableChange -
    inventoryChange +
    advanceChange;

  return {
    cf,
    detail: {
      ordinaryProfit: input.ordinaryProfit,
      depreciation: input.depreciation,
      corporateTax: input.corporateTax,
      allowanceChange,
      receivableChange,
      payableChange,
      inventoryChange,
      advanceChange,
    },
  };
}

/**
 * Y点計算
 */
export function calculateY(input: YInput): YResult {
  const { cf, detail } = calculateOperatingCF(input);

  // 総資本2期平均（最低3,000万円=30,000千円）
  const totalCapAvg = Math.max(
    30000,
    (input.totalCapital + input.prev.totalCapital) / 2
  );

  // sales=0のガード（OCR失敗等で売上が0の場合NaN/Infinityを防止）
  const safeSales = input.sales > 0 ? input.sales : 1;

  const raw = {
    x1:
      ((input.interestExpense - input.interestDividendIncome) / safeSales) *
      100,
    x2: (input.currentLiabilities + input.fixedLiabilities) / (safeSales / 12),
    x3: (input.grossProfit / totalCapAvg) * 100,
    x4: (input.ordinaryProfit / safeSales) * 100,
    x5: (input.equity / input.fixedAssets) * 100,
    x6: (input.equity / input.totalCapital) * 100,
    x7: (cf / 100000 + input.prev.operatingCF / 100000) / 2,
    x8: input.retainedEarnings / 100000,
  };

  const ind = {
    x1: clamp(raw.x1, LIMITS.x1.min, LIMITS.x1.max),
    x2: clamp(raw.x2, LIMITS.x2.min, LIMITS.x2.max),
    x3: clamp(raw.x3, LIMITS.x3.min, LIMITS.x3.max),
    x4: clamp(raw.x4, LIMITS.x4.min, LIMITS.x4.max),
    x5: clamp(raw.x5, LIMITS.x5.min, LIMITS.x5.max),
    x6: clamp(raw.x6, LIMITS.x6.min, LIMITS.x6.max),
    x7: clamp(raw.x7, LIMITS.x7.min, LIMITS.x7.max),
    x8: clamp(raw.x8, LIMITS.x8.min, LIMITS.x8.max),
  };

  const A =
    -0.465 * ind.x1 -
    0.0508 * ind.x2 +
    0.0264 * ind.x3 +
    0.0277 * ind.x4 +
    0.0011 * ind.x5 +
    0.0089 * ind.x6 +
    0.0818 * ind.x7 +
    0.0172 * ind.x8 +
    0.1906;

  const Y = Math.max(0, Math.min(1595, Math.floor(167.3 * A + 583)));

  return {
    indicators: ind,
    indicatorsRaw: raw,
    A,
    Y,
    operatingCF: cf,
    operatingCFDetail: detail,
  };
}
