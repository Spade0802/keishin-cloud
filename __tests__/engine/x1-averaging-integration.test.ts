import { describe, test, expect } from 'vitest';
import { calculateX1WithAverage, calculateP, calculateW, calculateX2, calculateZ } from '@/lib/engine/p-calculator';
import { lookupScore, X1_TABLE, X21_TABLE, X22_TABLE, Z1_TABLE, Z2_TABLE } from '@/lib/engine/score-tables';
import { calculateY } from '@/lib/engine/y-calculator';
import type { YInput, SocialItems } from '@/lib/engine/types';

// ==========================================
// X1 averaging in full P calculation context
// ==========================================

/** Minimal social items for a basic company */
const baseSocialItems: SocialItems = {
  employmentInsurance: true,
  healthInsurance: true,
  pensionInsurance: true,
  constructionRetirementMutualAid: false,
  retirementSystem: false,
  nonStatutoryAccidentInsurance: false,
  youngTechContinuous: false,
  youngTechNew: false,
  techStaffCount: 10,
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
  businessYears: 20,
  civilRehabilitation: false,
  disasterAgreement: false,
  suspensionOrder: false,
  instructionOrder: false,
  auditStatus: 0,
  certifiedAccountants: 0,
  firstClassAccountants: 0,
  secondClassAccountants: 0,
  rdExpense2YearAvg: 0,
  constructionMachineCount: 0,
  iso9001: false,
  iso14001: false,
  ecoAction21: false,
};

const baseYInput: YInput = {
  sales: 300000,
  grossProfit: 45000,
  ordinaryProfit: 15000,
  interestExpense: 1800,
  interestDividendIncome: 200,
  currentLiabilities: 55000,
  fixedLiabilities: 30000,
  totalCapital: 180000,
  equity: 95000,
  fixedAssets: 50000,
  retainedEarnings: 70000,
  corporateTax: 5000,
  depreciation: 4000,
  allowanceDoubtful: 400,
  notesAndAccountsReceivable: 42000,
  constructionPayable: 32000,
  inventoryAndMaterials: 2000,
  advanceReceived: 1000,
  prev: {
    totalCapital: 170000,
    operatingCF: 18000,
    allowanceDoubtful: 380,
    notesAndAccountsReceivable: 40000,
    constructionPayable: 30000,
    inventoryAndMaterials: 2200,
    advanceReceived: 900,
  },
};

describe('X1 averaging helps when current year dropped', () => {
  // Company where current year completion dropped significantly from prev
  const currCompletion = 200000;   // 2億円 (dropped from 4億 prev)
  const prevCompletion = 400000;   // 4億円
  const prevPrevCompletion = 350000; // 3.5億円

  test('2-year average is higher than current year alone', () => {
    const adopted = calculateX1WithAverage(currCompletion, prevCompletion);
    // avg = floor((200000 + 400000) / 2) = 300000
    // max(200000, 300000) = 300000
    expect(adopted).toBe(300000);
    expect(adopted).toBeGreaterThan(currCompletion);
  });

  test('3-year average provides middle ground', () => {
    const adopted = calculateX1WithAverage(currCompletion, prevCompletion, prevPrevCompletion);
    // 2yr avg = 300000
    // 3yr avg = floor((200000 + 400000 + 350000) / 3) = floor(316666.67) = 316666
    // max(200000, 300000, 316666) = 316666
    expect(adopted).toBe(316666);
    expect(adopted).toBeGreaterThan(300000);
  });

  test('Averaging produces higher X1 score', () => {
    const x1Current = lookupScore(X1_TABLE, currCompletion);
    const x1Averaged = lookupScore(X1_TABLE, calculateX1WithAverage(currCompletion, prevCompletion, prevPrevCompletion));

    expect(x1Averaged).toBeGreaterThan(x1Current);
  });

  test('Higher X1 leads to higher P via full pipeline', () => {
    const yResult = calculateY(baseYInput);
    const x21 = lookupScore(X21_TABLE, baseYInput.equity);
    const x22 = lookupScore(X22_TABLE, 20600); // approx EBITDA
    const x2 = calculateX2(x21, x22);
    const z1 = lookupScore(Z1_TABLE, 15);
    const z2 = lookupScore(Z2_TABLE, 100000);
    const Z = calculateZ(z1, z2);
    const wResult = calculateW(baseSocialItems);

    const x1NoAvg = lookupScore(X1_TABLE, currCompletion);
    const x1WithAvg = lookupScore(X1_TABLE, calculateX1WithAverage(currCompletion, prevCompletion, prevPrevCompletion));

    const pNoAvg = calculateP(x1NoAvg, x2, yResult.Y, Z, wResult.W);
    const pWithAvg = calculateP(x1WithAvg, x2, yResult.Y, Z, wResult.W);

    expect(pWithAvg).toBeGreaterThan(pNoAvg);
    // The difference should be meaningful
    expect(pWithAvg - pNoAvg).toBeGreaterThanOrEqual(1);
  });
});

describe('X1 averaging when current year is best (no averaging benefit)', () => {
  const currCompletion = 500000;   // 5億 (growing)
  const prevCompletion = 350000;   // 3.5億
  const prevPrevCompletion = 300000; // 3億

  test('Current year is adopted when it is highest', () => {
    const adopted = calculateX1WithAverage(currCompletion, prevCompletion, prevPrevCompletion);
    expect(adopted).toBe(currCompletion);
  });

  test('P score is same regardless of averaging attempt', () => {
    const yResult = calculateY(baseYInput);
    const x21 = lookupScore(X21_TABLE, baseYInput.equity);
    const x22 = lookupScore(X22_TABLE, 20600);
    const x2 = calculateX2(x21, x22);
    const z1 = lookupScore(Z1_TABLE, 15);
    const z2 = lookupScore(Z2_TABLE, 100000);
    const Z = calculateZ(z1, z2);
    const wResult = calculateW(baseSocialItems);

    const x1Direct = lookupScore(X1_TABLE, currCompletion);
    const x1WithAvg = lookupScore(X1_TABLE, calculateX1WithAverage(currCompletion, prevCompletion, prevPrevCompletion));

    expect(x1Direct).toBe(x1WithAvg);

    const pDirect = calculateP(x1Direct, x2, yResult.Y, Z, wResult.W);
    const pWithAvg = calculateP(x1WithAvg, x2, yResult.Y, Z, wResult.W);

    expect(pDirect).toBe(pWithAvg);
  });
});

describe('X1 averaging with steep decline over 3 years', () => {
  // Company in significant decline
  const curr = 50000;     // 5000万 (current)
  const prev = 200000;    // 2億 (last year)
  const prevPrev = 500000; // 5億 (two years ago)

  test('3-year average provides significant uplift', () => {
    const adopted = calculateX1WithAverage(curr, prev, prevPrev);
    // 2yr = floor(250000/2) = 125000
    // 3yr = floor(750000/3) = 250000
    // max(50000, 125000, 250000) = 250000
    expect(adopted).toBe(250000);
    expect(adopted).toBe(5 * curr); // 5x the current year
  });

  test('X1 with 3-year average is much higher than current only', () => {
    const x1Curr = lookupScore(X1_TABLE, curr);
    const x1Avg = lookupScore(X1_TABLE, calculateX1WithAverage(curr, prev, prevPrev));
    // Should be a large difference
    expect(x1Avg - x1Curr).toBeGreaterThan(100);
  });
});
