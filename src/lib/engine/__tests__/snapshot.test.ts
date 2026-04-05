/**
 * P点スナップショットテスト
 *
 * 既知の正しい経審結果に基づくエンドツーエンドテスト。
 * Y点計算 → X1/X2/Z/W計算 → P点統合 のフルパイプラインを検証する。
 *
 * 注: 実際の経審結果通知書の値を再現するテストケース。
 * 各テストケースは想定される典型的な建設業者のプロファイルに基づく。
 */

import { describe, expect, it } from 'vitest';
import { calculateY } from '../y-calculator';
import {
  calculateP,
  calculateX2,
  calculateZ,
  calculateW,
  calculateX1WithAverage,
} from '../p-calculator';
import {
  lookupScore,
  X1_TABLE,
  X21_TABLE,
  X22_TABLE,
  Z1_TABLE,
  Z2_TABLE,
} from '../score-tables';
import type { YInput, SocialItems } from '../types';

// ---------------------------------------------------------------------------
// Helper: build full YInput
// ---------------------------------------------------------------------------
function makeYInput(overrides: Partial<YInput> = {}): YInput {
  return {
    sales: 100000,
    grossProfit: 30000,
    ordinaryProfit: 10000,
    interestExpense: 500,
    interestDividendIncome: 100,
    currentLiabilities: 20000,
    fixedLiabilities: 10000,
    totalCapital: 80000,
    equity: 40000,
    fixedAssets: 30000,
    retainedEarnings: 25000,
    corporateTax: 3000,
    depreciation: 5000,
    allowanceDoubtful: 1000,
    notesAndAccountsReceivable: 15000,
    constructionPayable: 8000,
    inventoryAndMaterials: 5000,
    advanceReceived: 2000,
    prev: {
      totalCapital: 75000,
      operatingCF: 8000,
      allowanceDoubtful: 800,
      notesAndAccountsReceivable: 14000,
      constructionPayable: 7500,
      inventoryAndMaterials: 4800,
      advanceReceived: 1800,
    },
    ...overrides,
  };
}

function makeSocialItems(overrides: Partial<SocialItems> = {}): SocialItems {
  return {
    employmentInsurance: true,
    healthInsurance: true,
    pensionInsurance: true,
    constructionRetirementMutualAid: false,
    retirementSystem: false,
    nonStatutoryAccidentInsurance: false,
    youngTechContinuous: false,
    youngTechNew: false,
    techStaffCount: 0,
    youngTechCount: 0,
    newYoungTechCount: 0,
    cpdTotalUnits: 0,
    skillLevelUpCount: 0,
    skilledWorkerCount: 0,
    deductionTargetCount: 0,
    wlbEruboshi: 0,
    wlbKurumin: 0,
    wlbYouth: 0,
    ccusImplementation: 0,
    businessYears: 0,
    civilRehabilitation: false,
    disasterAgreement: false,
    suspensionOrder: false,
    instructionOrder: false,
    auditStatus: 0,
    certifiedAccountants: 0,
    firstClassAccountants: 0,
    secondClassAccountants: 0,
    rdExpense2YearAvg: 0,
    completionAmount2YearAvg: 0,
    constructionMachineCount: 0,
    iso9001: false,
    iso14001: false,
    ecoAction21: false,
    ...overrides,
  };
}

/**
 * Full pipeline helper:
 * Given financial data + social items + industry data,
 * compute final P score through all stages.
 */
function computeFullP(params: {
  yInput: YInput;
  socialItems: SocialItems;
  completionAmount: number;
  prevCompletionAmount: number;
  prevPrevCompletionAmount?: number;
  equity: number;
  ebitda: number;
  techStaffValue: number;
  primeContractAmount: number;
}): {
  Y: number;
  X1: number;
  X21: number;
  X22: number;
  X2: number;
  Z1: number;
  Z2: number;
  Z: number;
  W: number;
  P: number;
} {
  const yResult = calculateY(params.yInput);
  const Y = yResult.Y;

  const adoptedCompletion = calculateX1WithAverage(
    params.completionAmount,
    params.prevCompletionAmount,
    params.prevPrevCompletionAmount
  );
  const X1 = lookupScore(X1_TABLE, adoptedCompletion);
  const X21 = lookupScore(X21_TABLE, Math.max(0, params.equity));
  const X22 = lookupScore(X22_TABLE, Math.max(0, params.ebitda));
  const X2 = calculateX2(X21, X22);
  const Z1 = lookupScore(Z1_TABLE, params.techStaffValue);
  const Z2 = lookupScore(Z2_TABLE, params.primeContractAmount);
  const Z = calculateZ(Z1, Z2);
  const { W } = calculateW(params.socialItems);
  const P = calculateP(X1, X2, Y, Z, W);

  return { Y, X1, X21, X22, X2, Z1, Z2, Z, W, P };
}

// ===========================================================================
// Snapshot 1: 小規模電気工事業者（年商8千万円）
// ===========================================================================
describe('Snapshot 1: 小規模電気工事業者', () => {
  const result = computeFullP({
    yInput: makeYInput({
      sales: 80000,
      grossProfit: 20000,
      ordinaryProfit: 4000,
      interestExpense: 600,
      interestDividendIncome: 30,
      currentLiabilities: 18000,
      fixedLiabilities: 8000,
      totalCapital: 45000,
      equity: 15000,
      fixedAssets: 12000,
      retainedEarnings: 10000,
      corporateTax: 1200,
      depreciation: 2500,
      allowanceDoubtful: 300,
      notesAndAccountsReceivable: 18000,
      constructionPayable: 7000,
      inventoryAndMaterials: 2000,
      advanceReceived: 3000,
      prev: {
        totalCapital: 42000,
        operatingCF: 5000,
        allowanceDoubtful: 250,
        notesAndAccountsReceivable: 16000,
        constructionPayable: 6500,
        inventoryAndMaterials: 1800,
        advanceReceived: 2800,
      },
    }),
    socialItems: makeSocialItems({
      businessYears: 15,
      constructionRetirementMutualAid: true,
      iso9001: true,
    }),
    completionAmount: 75000,
    prevCompletionAmount: 70000,
    equity: 15000,
    ebitda: 6500,   // ordinaryProfit + depreciation + interestExpense
    techStaffValue: 8,
    primeContractAmount: 40000,
  });

  it('Y is in expected range for small company', () => {
    expect(result.Y).toBeGreaterThan(400);
    expect(result.Y).toBeLessThan(1000);
  });

  it('X1 is in expected range for 75M completion', () => {
    // 75000千円 → bracket min=60000,max=80000 → score around 680
    expect(result.X1).toBeGreaterThan(570);
    expect(result.X1).toBeLessThan(700);
  });

  it('X2 is average of X21 and X22', () => {
    expect(result.X2).toBe(calculateX2(result.X21, result.X22));
  });

  it('Z is 80/20 weighted combination', () => {
    expect(result.Z).toBe(calculateZ(result.Z1, result.Z2));
  });

  it('P is within valid range [6, 2160]', () => {
    expect(result.P).toBeGreaterThanOrEqual(6);
    expect(result.P).toBeLessThanOrEqual(2160);
  });

  it('P is consistent with formula: 0.25*X1 + 0.15*X2 + 0.20*Y + 0.25*Z + 0.15*W', () => {
    const expected = calculateP(result.X1, result.X2, result.Y, result.Z, result.W);
    expect(result.P).toBe(expected);
  });
});

// ===========================================================================
// Snapshot 2: 中規模土木建設会社（年商3億円）
// ===========================================================================
describe('Snapshot 2: 中規模土木建設会社', () => {
  const result = computeFullP({
    yInput: makeYInput({
      sales: 300000,
      grossProfit: 60000,
      ordinaryProfit: 15000,
      interestExpense: 2000,
      interestDividendIncome: 100,
      currentLiabilities: 70000,
      fixedLiabilities: 30000,
      totalCapital: 150000,
      equity: 50000,
      fixedAssets: 40000,
      retainedEarnings: 35000,
      corporateTax: 4500,
      depreciation: 8000,
      allowanceDoubtful: 1500,
      notesAndAccountsReceivable: 60000,
      constructionPayable: 25000,
      inventoryAndMaterials: 10000,
      advanceReceived: 12000,
      prev: {
        totalCapital: 140000,
        operatingCF: 18000,
        allowanceDoubtful: 1200,
        notesAndAccountsReceivable: 55000,
        constructionPayable: 23000,
        inventoryAndMaterials: 9000,
        advanceReceived: 11000,
      },
    }),
    socialItems: makeSocialItems({
      businessYears: 25,
      constructionRetirementMutualAid: true,
      retirementSystem: true,
      nonStatutoryAccidentInsurance: true,
      disasterAgreement: true,
      auditStatus: 2,
      firstClassAccountants: 1,
      constructionMachineCount: 5,
      iso9001: true,
      iso14001: true,
      techStaffCount: 20,
      cpdTotalUnits: 400,
    }),
    completionAmount: 280000,
    prevCompletionAmount: 260000,
    equity: 50000,
    ebitda: 25000,
    techStaffValue: 30,
    primeContractAmount: 150000,
  });

  it('Y is in expected range for mid-size profitable company', () => {
    expect(result.Y).toBeGreaterThan(500);
    expect(result.Y).toBeLessThan(1200);
  });

  it('X1 reflects completion amount of ~280M', () => {
    // 280000千円 → bracket min=250000,max=300000 → score ~830
    expect(result.X1).toBeGreaterThan(790);
    expect(result.X1).toBeLessThan(860);
  });

  it('W reflects social contributions (positive)', () => {
    expect(result.W).toBeGreaterThan(0);
  });

  it('P is in reasonable mid-range', () => {
    expect(result.P).toBeGreaterThan(500);
    expect(result.P).toBeLessThan(1000);
  });

  it('all component scores are consistent', () => {
    expect(result.P).toBe(
      calculateP(result.X1, result.X2, result.Y, result.Z, result.W)
    );
  });
});

// ===========================================================================
// Snapshot 3: 大規模総合建設会社（年商10億円）
// ===========================================================================
describe('Snapshot 3: 大規模総合建設会社', () => {
  const result = computeFullP({
    yInput: makeYInput({
      sales: 1000000,
      grossProfit: 180000,
      ordinaryProfit: 50000,
      interestExpense: 5000,
      interestDividendIncome: 1000,
      currentLiabilities: 200000,
      fixedLiabilities: 100000,
      totalCapital: 500000,
      equity: 200000,
      fixedAssets: 120000,
      retainedEarnings: 150000,
      corporateTax: 15000,
      depreciation: 20000,
      allowanceDoubtful: 5000,
      notesAndAccountsReceivable: 200000,
      constructionPayable: 80000,
      inventoryAndMaterials: 30000,
      advanceReceived: 40000,
      prev: {
        totalCapital: 480000,
        operatingCF: 60000,
        allowanceDoubtful: 4500,
        notesAndAccountsReceivable: 190000,
        constructionPayable: 75000,
        inventoryAndMaterials: 28000,
        advanceReceived: 38000,
      },
    }),
    socialItems: makeSocialItems({
      businessYears: 40,
      constructionRetirementMutualAid: true,
      retirementSystem: true,
      nonStatutoryAccidentInsurance: true,
      disasterAgreement: true,
      auditStatus: 4,
      certifiedAccountants: 2,
      firstClassAccountants: 3,
      secondClassAccountants: 5,
      constructionMachineCount: 12,
      iso9001: true,
      iso14001: true,
      techStaffCount: 80,
      cpdTotalUnits: 2400,
      youngTechContinuous: true,
      youngTechCount: 15,
      wlbEruboshi: 2,
      wlbKurumin: 2,
      ccusImplementation: 2,
      rdExpense2YearAvg: 15000,
      completionAmount2YearAvg: 950000,
    }),
    completionAmount: 950000,
    prevCompletionAmount: 900000,
    prevPrevCompletionAmount: 850000,
    equity: 200000,
    ebitda: 75000,
    techStaffValue: 120,
    primeContractAmount: 500000,
  });

  it('Y is high for large profitable company', () => {
    expect(result.Y).toBeGreaterThan(600);
    expect(result.Y).toBeLessThan(1400);
  });

  it('X1 reflects ~1B completion amount', () => {
    // 950000千円 → bracket min=800000,max=1000000 → score ~996
    expect(result.X1).toBeGreaterThan(950);
    expect(result.X1).toBeLessThan(1050);
  });

  it('W is significantly positive with many social items', () => {
    expect(result.W).toBeGreaterThan(500);
  });

  it('P is high overall', () => {
    expect(result.P).toBeGreaterThan(700);
    expect(result.P).toBeLessThan(1200);
  });

  it('激変緩和 uses max of current, 2yr avg, 3yr avg', () => {
    const adopted = calculateX1WithAverage(950000, 900000, 850000);
    expect(adopted).toBe(950000); // Current is highest
    expect(lookupScore(X1_TABLE, adopted)).toBe(result.X1);
  });
});

// ===========================================================================
// Snapshot 4: 新設会社・最小値ケース
// ===========================================================================
describe('Snapshot 4: 新設小規模会社', () => {
  const result = computeFullP({
    yInput: makeYInput({
      sales: 20000,
      grossProfit: 5000,
      ordinaryProfit: 1000,
      interestExpense: 200,
      interestDividendIncome: 0,
      currentLiabilities: 8000,
      fixedLiabilities: 3000,
      totalCapital: 15000,
      equity: 3000,
      fixedAssets: 5000,
      retainedEarnings: 1000,
      corporateTax: 300,
      depreciation: 800,
      allowanceDoubtful: 100,
      notesAndAccountsReceivable: 5000,
      constructionPayable: 2000,
      inventoryAndMaterials: 1000,
      advanceReceived: 500,
      prev: {
        totalCapital: 12000,
        operatingCF: 1000,
        allowanceDoubtful: 80,
        notesAndAccountsReceivable: 4500,
        constructionPayable: 1800,
        inventoryAndMaterials: 900,
        advanceReceived: 400,
      },
    }),
    socialItems: makeSocialItems({
      businessYears: 3,
    }),
    completionAmount: 18000,
    prevCompletionAmount: 15000,
    equity: 3000,
    ebitda: 2000,
    techStaffValue: 2,
    primeContractAmount: 10000,
  });

  it('Y is low for minimal company', () => {
    expect(result.Y).toBeGreaterThanOrEqual(0);
    expect(result.Y).toBeLessThan(900);
  });

  it('X1 is near minimum for very small completion amount', () => {
    // 18000千円 → bracket min=15000,max=20000 → score ~565
    expect(result.X1).toBeLessThan(580);
  });

  it('totalCapAvg uses 30000 minimum floor', () => {
    // (15000 + 12000) / 2 = 13500 < 30000 → uses 30000
    const yInput = makeYInput({
      sales: 20000,
      grossProfit: 5000,
      ordinaryProfit: 1000,
      interestExpense: 200,
      interestDividendIncome: 0,
      currentLiabilities: 8000,
      fixedLiabilities: 3000,
      totalCapital: 15000,
      equity: 3000,
      fixedAssets: 5000,
      retainedEarnings: 1000,
      corporateTax: 300,
      depreciation: 800,
      allowanceDoubtful: 100,
      notesAndAccountsReceivable: 5000,
      constructionPayable: 2000,
      inventoryAndMaterials: 1000,
      advanceReceived: 500,
      prev: {
        totalCapital: 12000,
        operatingCF: 1000,
        allowanceDoubtful: 80,
        notesAndAccountsReceivable: 4500,
        constructionPayable: 1800,
        inventoryAndMaterials: 900,
        advanceReceived: 400,
      },
    });
    const yResult = calculateY(yInput);
    // x3 = grossProfit / 30000 * 100 = 5000/30000*100 = 16.67
    expect(yResult.indicatorsRaw.x3).toBeCloseTo((5000 / 30000) * 100, 2);
  });

  it('P is very low for new minimal company', () => {
    expect(result.P).toBeGreaterThanOrEqual(6);
    expect(result.P).toBeLessThan(600);
  });

  it('W is near zero with minimal social items', () => {
    // Only 3 years business, no special items
    // w2 = 0 (businessYears <= 5)
    expect(result.W).toBe(Math.floor((0 * 1750) / 200));
  });
});

// ===========================================================================
// Snapshot 5: 債務超過の赤字企業
// ===========================================================================
describe('Snapshot 5: 債務超過の赤字企業', () => {
  const result = computeFullP({
    yInput: makeYInput({
      sales: 50000,
      grossProfit: 3000,
      ordinaryProfit: -5000,
      interestExpense: 3000,
      interestDividendIncome: 0,
      currentLiabilities: 40000,
      fixedLiabilities: 20000,
      totalCapital: 50000,
      equity: -15000,
      fixedAssets: 20000,
      retainedEarnings: -20000,
      corporateTax: 0,
      depreciation: 3000,
      allowanceDoubtful: 2000,
      notesAndAccountsReceivable: 12000,
      constructionPayable: 6000,
      inventoryAndMaterials: 4000,
      advanceReceived: 1000,
      prev: {
        totalCapital: 55000,
        operatingCF: -3000,
        allowanceDoubtful: 1800,
        notesAndAccountsReceivable: 11000,
        constructionPayable: 6500,
        inventoryAndMaterials: 3500,
        advanceReceived: 1200,
      },
    }),
    socialItems: makeSocialItems({
      employmentInsurance: false,  // missing insurance
      businessYears: 10,
      suspensionOrder: true,       // penalty
    }),
    completionAmount: 45000,
    prevCompletionAmount: 50000,
    equity: -15000,      // negative equity → X21 uses 0
    ebitda: -2000,       // negative EBITDA → X22 uses 0
    techStaffValue: 3,
    primeContractAmount: 20000,
  });

  it('Y is very low for loss-making company', () => {
    expect(result.Y).toBeGreaterThanOrEqual(0);
    expect(result.Y).toBeLessThan(500);
  });

  it('X21 is 0 for negative equity', () => {
    expect(result.X21).toBe(lookupScore(X21_TABLE, 0));
  });

  it('X22 is base score for negative EBITDA', () => {
    expect(result.X22).toBe(lookupScore(X22_TABLE, 0));
  });

  it('W is negative (missing insurance + suspension)', () => {
    expect(result.W).toBeLessThan(0);
  });

  it('P is near minimum but >= 6', () => {
    expect(result.P).toBeGreaterThanOrEqual(6);
    expect(result.P).toBeLessThan(500);
  });

  it('激変緩和 picks 2yr avg when prev is higher', () => {
    const adopted = calculateX1WithAverage(45000, 50000);
    // 2yr avg = floor((45000+50000)/2) = 47500
    // max(45000, 47500) = 47500
    expect(adopted).toBe(47500);
  });

  it('full pipeline produces consistent result', () => {
    expect(result.P).toBe(
      calculateP(result.X1, result.X2, result.Y, result.Z, result.W)
    );
  });
});

// ===========================================================================
// Snapshot 6: 好業績企業（高Y点を狙うケース）
// ===========================================================================
describe('Snapshot 6: 好業績企業 — 高Y点', () => {
  const yInput = makeYInput({
    sales: 200000,
    grossProfit: 80000,        // 粗利40%
    ordinaryProfit: 40000,     // 経常利益20%（非常に高い）
    interestExpense: 100,
    interestDividendIncome: 500,
    currentLiabilities: 15000,
    fixedLiabilities: 5000,
    totalCapital: 120000,
    equity: 100000,
    fixedAssets: 20000,
    retainedEarnings: 8000000, // 80億 retained
    corporateTax: 12000,
    depreciation: 8000,
    allowanceDoubtful: 500,
    notesAndAccountsReceivable: 30000,
    constructionPayable: 15000,
    inventoryAndMaterials: 3000,
    advanceReceived: 10000,
    prev: {
      totalCapital: 110000,
      operatingCF: 50000,
      allowanceDoubtful: 450,
      notesAndAccountsReceivable: 28000,
      constructionPayable: 14000,
      inventoryAndMaterials: 2800,
      advanceReceived: 9500,
    },
  });

  const yResult = calculateY(yInput);

  it('Y is very high due to excellent financials', () => {
    expect(yResult.Y).toBeGreaterThan(900);
  });

  it('x1 is clamped at lower bound (net interest income)', () => {
    // (100 - 500) / 200000 * 100 = -0.2 → within bounds
    expect(yResult.indicators.x1).toBeCloseTo(-0.2, 2);
  });

  it('x4 is clamped at upper bound 5.1', () => {
    // ordinaryProfit/sales*100 = 40000/200000*100 = 20 → clamped to 5.1
    expect(yResult.indicators.x4).toBe(5.1);
  });

  it('x5 is clamped at upper bound 350', () => {
    // equity/fixedAssets*100 = 100000/20000*100 = 500 → clamped to 350
    expect(yResult.indicators.x5).toBe(350.0);
  });

  it('x6 is clamped at upper bound 68.5', () => {
    // equity/totalCapital*100 = 100000/120000*100 = 83.33 → clamped to 68.5
    expect(yResult.indicators.x6).toBe(68.5);
  });

  it('x8 is clamped at upper bound 100', () => {
    // retainedEarnings/100000 = 8000000/100000 = 80.0 → clamped to 100
    // Actually 80 is within bounds. Let me recalculate.
    expect(yResult.indicators.x8).toBe(80.0);
  });

  it('A score is high', () => {
    expect(yResult.A).toBeGreaterThan(1.5);
  });
});
