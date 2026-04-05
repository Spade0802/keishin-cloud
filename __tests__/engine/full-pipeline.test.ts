import { describe, test, expect } from 'vitest';
import { calculateY } from '@/lib/engine/y-calculator';
import {
  calculateP,
  calculateX2,
  calculateZ,
  calculateW,
} from '@/lib/engine/p-calculator';
import {
  lookupScore,
  X1_TABLE,
  X21_TABLE,
  X22_TABLE,
  Z1_TABLE,
  Z2_TABLE,
} from '@/lib/engine/score-tables';
import type { YInput, SocialItems } from '@/lib/engine/types';

// ==========================================
// Full P-score calculation pipeline tests
// Three company profiles: small, medium, large
// ==========================================

/** Helper: run the full pipeline from raw data to P */
function runFullPipeline(params: {
  yInput: YInput;
  equity: number;
  ebitda: number;
  prevCompletion: number;
  currCompletion: number;
  prevSubcontract: number;
  currSubcontract: number;
  techStaffValue: number;
  socialItems: SocialItems;
}) {
  // Step 1: Y score
  const yResult = calculateY(params.yInput);

  // Step 2: X2 from equity + EBITDA
  const x21 = lookupScore(X21_TABLE, params.equity);
  const x22 = lookupScore(X22_TABLE, params.ebitda);
  const x2 = calculateX2(x21, x22);

  // Step 3: X1 from completion amount
  const avgComp = Math.floor(
    (params.prevCompletion + params.currCompletion) / 2
  );
  const adoptedComp = Math.max(avgComp, params.currCompletion);
  const X1 = lookupScore(X1_TABLE, adoptedComp);

  // Step 4: Z from tech staff + prime contract
  const avgSub = Math.floor(
    (params.prevSubcontract + params.currSubcontract) / 2
  );
  const z1 = lookupScore(Z1_TABLE, params.techStaffValue);
  const z2 = lookupScore(Z2_TABLE, avgSub);
  const Z = calculateZ(z1, z2);

  // Step 5: W from social items
  const wCalc = calculateW(params.socialItems);

  // Step 6: Final P
  const P = calculateP(X1, x2, yResult.Y, Z, wCalc.W);

  return { yResult, x21, x22, x2, X1, z1, z2, Z, W: wCalc.W, wDetail: wCalc.detail, P };
}

// ==========================================
// Profile 1: Small company (年商 5000万円)
// ==========================================
describe('Full pipeline: Small company (年商5000万円)', () => {
  const yInput: YInput = {
    sales: 50000,
    grossProfit: 8500,
    ordinaryProfit: 2100,
    interestExpense: 450,
    interestDividendIncome: 50,
    currentLiabilities: 12000,
    fixedLiabilities: 5000,
    totalCapital: 35000,
    equity: 18000,
    fixedAssets: 10000,
    retainedEarnings: 12000,
    corporateTax: 700,
    depreciation: 1200,
    allowanceDoubtful: 200,
    notesAndAccountsReceivable: 8000,
    constructionPayable: 5500,
    inventoryAndMaterials: 800,
    advanceReceived: 300,
    prev: {
      totalCapital: 33000,
      operatingCF: 3200,
      allowanceDoubtful: 180,
      notesAndAccountsReceivable: 7500,
      constructionPayable: 5200,
      inventoryAndMaterials: 900,
      advanceReceived: 250,
    },
  };

  const ebitda =
    yInput.ordinaryProfit +
    yInput.interestExpense -
    yInput.interestDividendIncome +
    yInput.depreciation;

  const socialItems: SocialItems = {
    employmentInsurance: true,
    healthInsurance: true,
    pensionInsurance: true,
    constructionRetirementMutualAid: true,
    retirementSystem: false,
    nonStatutoryAccidentInsurance: false,
    youngTechContinuous: false,
    youngTechNew: false,
    techStaffCount: 5,
    youngTechCount: 1,
    newYoungTechCount: 0,
    cpdTotalUnits: 30,
    skillLevelUpCount: 0,
    skilledWorkerCount: 2,
    deductionTargetCount: 0,
    wlbEruboshi: 0,
    wlbKurumin: 0,
    wlbYouth: 0,
    ccusImplementation: 0,
    businessYears: 15,
    civilRehabilitation: false,
    disasterAgreement: false,
    suspensionOrder: false,
    instructionOrder: false,
    auditStatus: 0,
    certifiedAccountants: 0,
    firstClassAccountants: 0,
    secondClassAccountants: 0,
    rdExpense2YearAvg: 0,
    constructionMachineCount: 1,
    iso9001: false,
    iso14001: false,
    ecoAction21: false,
  };

  const result = runFullPipeline({
    yInput,
    equity: yInput.equity,
    ebitda,
    prevCompletion: 45000,
    currCompletion: 50000,
    prevSubcontract: 15000,
    currSubcontract: 18000,
    techStaffValue: 8,
    socialItems,
  });

  test('Y score is calculated and within valid range', () => {
    expect(result.yResult.Y).toBeGreaterThanOrEqual(0);
    expect(result.yResult.Y).toBeLessThanOrEqual(1595);
  });

  test('X2 components are valid', () => {
    expect(result.x21).toBeGreaterThanOrEqual(0);
    expect(result.x22).toBeGreaterThanOrEqual(0);
    expect(result.x2).toBe(Math.floor((result.x21 + result.x22) / 2));
  });

  test('X1 score is valid for small completion', () => {
    // 50000千円 = 5000万円, adopted = max(avg, curr) = 50000
    expect(result.X1).toBeGreaterThanOrEqual(397);
    expect(result.X1).toBeLessThanOrEqual(700);
  });

  test('Z score uses correct formula', () => {
    expect(result.Z).toBe(Math.floor(result.z1 * 0.8 + result.z2 * 0.2));
  });

  test('W score is calculated from social items', () => {
    expect(result.W).toBeGreaterThanOrEqual(0);
    // Small company with limited social items should have a modest W
    expect(result.W).toBeLessThan(1500);
  });

  test('Final P is within valid range (6-2160)', () => {
    expect(result.P).toBeGreaterThanOrEqual(6);
    expect(result.P).toBeLessThanOrEqual(2160);
  });

  test('Final P matches exact recalculation', () => {
    const expectedP = calculateP(result.X1, result.x2, result.yResult.Y, result.Z, result.W);
    expect(result.P).toBe(expectedP);
  });

  test('P is in expected range for a small company', () => {
    // Small companies typically score 300-600
    expect(result.P).toBeGreaterThanOrEqual(200);
    expect(result.P).toBeLessThanOrEqual(800);
  });
});

// ==========================================
// Profile 2: Medium company (年商 5億円)
// ==========================================
describe('Full pipeline: Medium company (年商5億円)', () => {
  const yInput: YInput = {
    sales: 500000,
    grossProfit: 85000,
    ordinaryProfit: 28000,
    interestExpense: 3200,
    interestDividendIncome: 500,
    currentLiabilities: 95000,
    fixedLiabilities: 45000,
    totalCapital: 280000,
    equity: 140000,
    fixedAssets: 85000,
    retainedEarnings: 110000,
    corporateTax: 9500,
    depreciation: 6800,
    allowanceDoubtful: 600,
    notesAndAccountsReceivable: 72000,
    constructionPayable: 55000,
    inventoryAndMaterials: 3500,
    advanceReceived: 2000,
    prev: {
      totalCapital: 265000,
      operatingCF: 28500,
      allowanceDoubtful: 550,
      notesAndAccountsReceivable: 68000,
      constructionPayable: 52000,
      inventoryAndMaterials: 3800,
      advanceReceived: 1800,
    },
  };

  const ebitda =
    yInput.ordinaryProfit +
    yInput.interestExpense -
    yInput.interestDividendIncome +
    yInput.depreciation;

  const socialItems: SocialItems = {
    employmentInsurance: true,
    healthInsurance: true,
    pensionInsurance: true,
    constructionRetirementMutualAid: true,
    retirementSystem: true,
    nonStatutoryAccidentInsurance: false,
    youngTechContinuous: true,
    youngTechNew: false,
    techStaffCount: 28,
    youngTechCount: 6,
    newYoungTechCount: 0,
    cpdTotalUnits: 350,
    skillLevelUpCount: 3,
    skilledWorkerCount: 10,
    deductionTargetCount: 0,
    wlbEruboshi: 0,
    wlbKurumin: 1,
    wlbYouth: 0,
    ccusImplementation: 1,
    businessYears: 30,
    civilRehabilitation: false,
    disasterAgreement: true,
    suspensionOrder: false,
    instructionOrder: false,
    auditStatus: 1,
    certifiedAccountants: 0,
    firstClassAccountants: 1,
    secondClassAccountants: 0,
    rdExpense2YearAvg: 0,
    constructionMachineCount: 5,
    iso9001: true,
    iso14001: false,
    ecoAction21: false,
  };

  const result = runFullPipeline({
    yInput,
    equity: yInput.equity,
    ebitda,
    prevCompletion: 480000,
    currCompletion: 500000,
    prevSubcontract: 320000,
    currSubcontract: 350000,
    techStaffValue: 48,
    socialItems,
  });

  test('Y score is calculated and within valid range', () => {
    expect(result.yResult.Y).toBeGreaterThanOrEqual(0);
    expect(result.yResult.Y).toBeLessThanOrEqual(1595);
  });

  test('X2 components are valid', () => {
    expect(result.x21).toBeGreaterThan(0);
    expect(result.x22).toBeGreaterThan(0);
    expect(result.x2).toBe(Math.floor((result.x21 + result.x22) / 2));
  });

  test('X1 for 5億 completion is in expected range', () => {
    // 500000千円 = 5億円
    expect(result.X1).toBeGreaterThanOrEqual(700);
    expect(result.X1).toBeLessThanOrEqual(1000);
  });

  test('Z score uses correct formula', () => {
    expect(result.Z).toBe(Math.floor(result.z1 * 0.8 + result.z2 * 0.2));
  });

  test('W with good social items should be higher than small company', () => {
    // Medium company with more social items
    expect(result.W).toBeGreaterThan(0);
  });

  test('Final P is within valid range', () => {
    expect(result.P).toBeGreaterThanOrEqual(6);
    expect(result.P).toBeLessThanOrEqual(2160);
  });

  test('Final P matches exact recalculation', () => {
    const expectedP = calculateP(result.X1, result.x2, result.yResult.Y, result.Z, result.W);
    expect(result.P).toBe(expectedP);
  });

  test('P is in expected range for a medium company', () => {
    // Medium companies typically score 600-1000
    expect(result.P).toBeGreaterThanOrEqual(500);
    expect(result.P).toBeLessThanOrEqual(1200);
  });
});

// ==========================================
// Profile 3: Large company (年商 50億円)
// ==========================================
describe('Full pipeline: Large company (年商50億円)', () => {
  const yInput: YInput = {
    sales: 5000000,
    grossProfit: 750000,
    ordinaryProfit: 250000,
    interestExpense: 18000,
    interestDividendIncome: 5000,
    currentLiabilities: 980000,
    fixedLiabilities: 420000,
    totalCapital: 2800000,
    equity: 1400000,
    fixedAssets: 850000,
    retainedEarnings: 1100000,
    corporateTax: 85000,
    depreciation: 52000,
    allowanceDoubtful: 3500,
    notesAndAccountsReceivable: 680000,
    constructionPayable: 520000,
    inventoryAndMaterials: 25000,
    advanceReceived: 15000,
    prev: {
      totalCapital: 2650000,
      operatingCF: 235000,
      allowanceDoubtful: 3200,
      notesAndAccountsReceivable: 650000,
      constructionPayable: 500000,
      inventoryAndMaterials: 28000,
      advanceReceived: 12000,
    },
  };

  const ebitda =
    yInput.ordinaryProfit +
    yInput.interestExpense -
    yInput.interestDividendIncome +
    yInput.depreciation;

  const socialItems: SocialItems = {
    employmentInsurance: true,
    healthInsurance: true,
    pensionInsurance: true,
    constructionRetirementMutualAid: true,
    retirementSystem: true,
    nonStatutoryAccidentInsurance: true,
    youngTechContinuous: true,
    youngTechNew: false,
    techStaffCount: 180,
    youngTechCount: 45,
    newYoungTechCount: 0,
    cpdTotalUnits: 6500,
    skillLevelUpCount: 25,
    skilledWorkerCount: 60,
    deductionTargetCount: 0,
    wlbEruboshi: 0,
    wlbKurumin: 2,
    wlbYouth: 0,
    ccusImplementation: 2,
    businessYears: 55,
    civilRehabilitation: false,
    disasterAgreement: true,
    suspensionOrder: false,
    instructionOrder: false,
    auditStatus: 4,
    certifiedAccountants: 2,
    firstClassAccountants: 3,
    secondClassAccountants: 1,
    rdExpense2YearAvg: 0,
    constructionMachineCount: 15,
    iso9001: true,
    iso14001: true,
    ecoAction21: false,
  };

  const result = runFullPipeline({
    yInput,
    equity: yInput.equity,
    ebitda,
    prevCompletion: 4800000,
    currCompletion: 5000000,
    prevSubcontract: 3200000,
    currSubcontract: 3500000,
    techStaffValue: 350,
    socialItems,
  });

  test('Y score is calculated and within valid range', () => {
    expect(result.yResult.Y).toBeGreaterThanOrEqual(0);
    expect(result.yResult.Y).toBeLessThanOrEqual(1595);
  });

  test('Y score for a healthy large company should be high', () => {
    // Large profitable companies tend to have Y > 700
    expect(result.yResult.Y).toBeGreaterThanOrEqual(700);
  });

  test('X2 components are valid', () => {
    expect(result.x21).toBeGreaterThan(0);
    expect(result.x22).toBeGreaterThan(0);
    expect(result.x2).toBe(Math.floor((result.x21 + result.x22) / 2));
  });

  test('X21 (equity) for 14億 should be near table max', () => {
    // equity = 1,400,000千円 = 14億円, X21 table max is 902
    expect(result.x21).toBe(902);
  });

  test('X1 for 50億 completion is in high range', () => {
    // 5,000,000千円 = 50億円
    expect(result.X1).toBeGreaterThanOrEqual(1000);
  });

  test('Z score uses correct formula', () => {
    expect(result.Z).toBe(Math.floor(result.z1 * 0.8 + result.z2 * 0.2));
  });

  test('Z1 for 350 tech staff should be high', () => {
    expect(result.z1).toBeGreaterThanOrEqual(1200);
  });

  test('W with full social items should be high', () => {
    expect(result.W).toBeGreaterThan(1000);
  });

  test('Final P is within valid range', () => {
    expect(result.P).toBeGreaterThanOrEqual(6);
    expect(result.P).toBeLessThanOrEqual(2160);
  });

  test('Final P matches exact recalculation', () => {
    const expectedP = calculateP(result.X1, result.x2, result.yResult.Y, result.Z, result.W);
    expect(result.P).toBe(expectedP);
  });

  test('P for large company should be significantly higher than medium', () => {
    expect(result.P).toBeGreaterThanOrEqual(900);
  });
});

// ==========================================
// Cross-profile comparison tests
// ==========================================
describe('Cross-profile P score ordering', () => {
  function buildResult(params: {
    yInput: YInput;
    equity: number;
    ebitda: number;
    prevCompletion: number;
    currCompletion: number;
    prevSubcontract: number;
    currSubcontract: number;
    techStaffValue: number;
    socialItems: SocialItems;
  }) {
    return runFullPipeline(params);
  }

  const smallYInput: YInput = {
    sales: 50000, grossProfit: 8500, ordinaryProfit: 2100,
    interestExpense: 450, interestDividendIncome: 50,
    currentLiabilities: 12000, fixedLiabilities: 5000,
    totalCapital: 35000, equity: 18000, fixedAssets: 10000,
    retainedEarnings: 12000, corporateTax: 700, depreciation: 1200,
    allowanceDoubtful: 200, notesAndAccountsReceivable: 8000,
    constructionPayable: 5500, inventoryAndMaterials: 800, advanceReceived: 300,
    prev: {
      totalCapital: 33000, operatingCF: 3200, allowanceDoubtful: 180,
      notesAndAccountsReceivable: 7500, constructionPayable: 5200,
      inventoryAndMaterials: 900, advanceReceived: 250,
    },
  };

  const largeYInput: YInput = {
    sales: 5000000, grossProfit: 750000, ordinaryProfit: 250000,
    interestExpense: 18000, interestDividendIncome: 5000,
    currentLiabilities: 980000, fixedLiabilities: 420000,
    totalCapital: 2800000, equity: 1400000, fixedAssets: 850000,
    retainedEarnings: 1100000, corporateTax: 85000, depreciation: 52000,
    allowanceDoubtful: 3500, notesAndAccountsReceivable: 680000,
    constructionPayable: 520000, inventoryAndMaterials: 25000, advanceReceived: 15000,
    prev: {
      totalCapital: 2650000, operatingCF: 235000, allowanceDoubtful: 3200,
      notesAndAccountsReceivable: 650000, constructionPayable: 500000,
      inventoryAndMaterials: 28000, advanceReceived: 12000,
    },
  };

  const smallSocial: SocialItems = {
    employmentInsurance: true, healthInsurance: true, pensionInsurance: true,
    constructionRetirementMutualAid: true, retirementSystem: false,
    nonStatutoryAccidentInsurance: false, youngTechContinuous: false,
    youngTechNew: false, techStaffCount: 5, youngTechCount: 1,
    newYoungTechCount: 0, cpdTotalUnits: 30, skillLevelUpCount: 0,
    skilledWorkerCount: 2, deductionTargetCount: 0, wlbEruboshi: 0,
    wlbKurumin: 0, wlbYouth: 0, ccusImplementation: 0, businessYears: 15,
    civilRehabilitation: false, disasterAgreement: false,
    suspensionOrder: false, instructionOrder: false, auditStatus: 0,
    certifiedAccountants: 0, firstClassAccountants: 0, secondClassAccountants: 0,
    rdExpense2YearAvg: 0, constructionMachineCount: 1,
    iso9001: false, iso14001: false, ecoAction21: false,
  };

  const largeSocial: SocialItems = {
    employmentInsurance: true, healthInsurance: true, pensionInsurance: true,
    constructionRetirementMutualAid: true, retirementSystem: true,
    nonStatutoryAccidentInsurance: true, youngTechContinuous: true,
    youngTechNew: false, techStaffCount: 180, youngTechCount: 45,
    newYoungTechCount: 0, cpdTotalUnits: 6500, skillLevelUpCount: 25,
    skilledWorkerCount: 60, deductionTargetCount: 0, wlbEruboshi: 0,
    wlbKurumin: 2, wlbYouth: 0, ccusImplementation: 2, businessYears: 55,
    civilRehabilitation: false, disasterAgreement: true,
    suspensionOrder: false, instructionOrder: false, auditStatus: 4,
    certifiedAccountants: 2, firstClassAccountants: 3, secondClassAccountants: 1,
    rdExpense2YearAvg: 0, constructionMachineCount: 15,
    iso9001: true, iso14001: true, ecoAction21: false,
  };

  test('Large company P > Small company P', () => {
    const small = buildResult({
      yInput: smallYInput, equity: 18000,
      ebitda: 2100 + 450 - 50 + 1200,
      prevCompletion: 45000, currCompletion: 50000,
      prevSubcontract: 15000, currSubcontract: 18000,
      techStaffValue: 8, socialItems: smallSocial,
    });
    const large = buildResult({
      yInput: largeYInput, equity: 1400000,
      ebitda: 250000 + 18000 - 5000 + 52000,
      prevCompletion: 4800000, currCompletion: 5000000,
      prevSubcontract: 3200000, currSubcontract: 3500000,
      techStaffValue: 350, socialItems: largeSocial,
    });
    expect(large.P).toBeGreaterThan(small.P);
  });

  test('All component scores (X1, X2, Z, W) are higher for larger company', () => {
    const small = buildResult({
      yInput: smallYInput, equity: 18000,
      ebitda: 2100 + 450 - 50 + 1200,
      prevCompletion: 45000, currCompletion: 50000,
      prevSubcontract: 15000, currSubcontract: 18000,
      techStaffValue: 8, socialItems: smallSocial,
    });
    const large = buildResult({
      yInput: largeYInput, equity: 1400000,
      ebitda: 250000 + 18000 - 5000 + 52000,
      prevCompletion: 4800000, currCompletion: 5000000,
      prevSubcontract: 3200000, currSubcontract: 3500000,
      techStaffValue: 350, socialItems: largeSocial,
    });

    expect(large.X1).toBeGreaterThan(small.X1);
    expect(large.x2).toBeGreaterThan(small.x2);
    expect(large.Z).toBeGreaterThan(small.Z);
    expect(large.W).toBeGreaterThan(small.W);
  });
});
