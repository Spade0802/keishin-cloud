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

// ==========================================
// Scenario: 2-year average is best
// ==========================================

describe('X1 averaging when 2-year average is best', () => {
  // Pattern: prev was high, prevPrev was low, so 3yr avg is dragged down
  const curr = 100000;      // 1億
  const prev = 400000;      // 4億 (peak year)
  const prevPrev = 80000;   // 8000万 (weak year before peak)

  test('2-year average beats both current and 3-year average', () => {
    const twoYearAvg = Math.floor((curr + prev) / 2); // 250000
    const threeYearAvg = Math.floor((curr + prev + prevPrev) / 3); // floor(580000/3) = 193333
    const adopted = calculateX1WithAverage(curr, prev, prevPrev);

    expect(twoYearAvg).toBe(250000);
    expect(threeYearAvg).toBe(193333);
    expect(adopted).toBe(250000); // 2yr avg wins
    expect(adopted).toBeGreaterThan(curr);
    expect(adopted).toBeGreaterThan(threeYearAvg);
  });

  test('2-year average also wins when prevPrev drags 3-year down significantly', () => {
    // Even more extreme: prevPrev was zero
    const adopted = calculateX1WithAverage(100000, 300000, 0);
    // 2yr = floor(400000/2) = 200000
    // 3yr = floor(400000/3) = 133333
    // max(100000, 200000, 133333) = 200000
    expect(adopted).toBe(200000);
  });

  test('Higher score from 2-year average flows through to P', () => {
    const yResult = calculateY(baseYInput);
    const x21 = lookupScore(X21_TABLE, baseYInput.equity);
    const x22 = lookupScore(X22_TABLE, 20600);
    const x2 = calculateX2(x21, x22);
    const z1 = lookupScore(Z1_TABLE, 15);
    const z2 = lookupScore(Z2_TABLE, 100000);
    const Z = calculateZ(z1, z2);
    const wResult = calculateW(baseSocialItems);

    const x1Current = lookupScore(X1_TABLE, curr);
    const x1WithAvg = lookupScore(X1_TABLE, calculateX1WithAverage(curr, prev, prevPrev));

    const pCurrent = calculateP(x1Current, x2, yResult.Y, Z, wResult.W);
    const pWithAvg = calculateP(x1WithAvg, x2, yResult.Y, Z, wResult.W);

    expect(pWithAvg).toBeGreaterThan(pCurrent);
  });
});

// ==========================================
// Scenario: 3-year average is best
// ==========================================

describe('X1 averaging when 3-year average is best', () => {
  // Pattern: prevPrev was highest, prev was moderate, current is lowest
  // but 3-year avg still beats 2-year avg because prevPrev pulls it up
  const curr = 100000;      // 1億
  const prev = 150000;      // 1.5億
  const prevPrev = 600000;  // 6億 (prevPrev is very high)

  test('3-year average is the adopted value', () => {
    const twoYearAvg = Math.floor((curr + prev) / 2); // 125000
    const threeYearAvg = Math.floor((curr + prev + prevPrev) / 3); // floor(850000/3) = 283333
    const adopted = calculateX1WithAverage(curr, prev, prevPrev);

    expect(twoYearAvg).toBe(125000);
    expect(threeYearAvg).toBe(283333);
    expect(adopted).toBe(283333); // 3yr avg wins
    expect(adopted).toBeGreaterThan(twoYearAvg);
    expect(adopted).toBeGreaterThan(curr);
  });

  test('Declining company with strong prevPrev benefits from 3-year', () => {
    // Sharp decline: 5億 → 3億 → 5000万
    const adopted = calculateX1WithAverage(50000, 300000, 500000);
    // 2yr = floor(350000/2) = 175000
    // 3yr = floor(850000/3) = 283333
    // max(50000, 175000, 283333) = 283333
    expect(adopted).toBe(283333);
  });

  test('Gradual decline still favors 3-year average', () => {
    // 3億 → 2億 → 1億
    const adopted = calculateX1WithAverage(100000, 200000, 300000);
    // 2yr = floor(300000/2) = 150000
    // 3yr = floor(600000/3) = 200000
    // max(100000, 150000, 200000) = 200000
    expect(adopted).toBe(200000);
  });
});

// ==========================================
// Scenario: Current year is best (expanded)
// ==========================================

describe('X1 averaging when current year is best (growing company)', () => {
  test('Steady growth means no averaging benefit', () => {
    const adopted = calculateX1WithAverage(600000, 400000, 200000);
    expect(adopted).toBe(600000);
  });

  test('Explosive growth from near-zero', () => {
    const adopted = calculateX1WithAverage(1000000, 10000, 5000);
    expect(adopted).toBe(1000000);
  });

  test('All years equal means current year is adopted', () => {
    const adopted = calculateX1WithAverage(300000, 300000, 300000);
    expect(adopted).toBe(300000);
  });

  test('Current beats average even when prev years are close', () => {
    const adopted = calculateX1WithAverage(300000, 280000, 290000);
    // 2yr = floor(580000/2) = 290000
    // 3yr = floor(870000/3) = 290000
    // max(300000, 290000, 290000) = 300000
    expect(adopted).toBe(300000);
  });
});

// ==========================================
// Edge cases
// ==========================================

describe('X1 averaging edge cases', () => {
  test('all zero values', () => {
    const adopted = calculateX1WithAverage(0, 0, 0);
    expect(adopted).toBe(0);
  });

  test('current year is zero, previous years have values', () => {
    const adopted = calculateX1WithAverage(0, 200000, 300000);
    // 2yr = floor(200000/2) = 100000
    // 3yr = floor(500000/3) = 166666
    // max(0, 100000, 166666) = 166666
    expect(adopted).toBe(166666);
  });

  test('only current year is zero with 2-year calc', () => {
    const adopted = calculateX1WithAverage(0, 400000);
    // 2yr = floor(400000/2) = 200000
    // max(0, 200000) = 200000
    expect(adopted).toBe(200000);
  });

  test('previous year is zero', () => {
    const adopted = calculateX1WithAverage(300000, 0, 200000);
    // 2yr = floor(300000/2) = 150000
    // 3yr = floor(500000/3) = 166666
    // max(300000, 150000, 166666) = 300000
    expect(adopted).toBe(300000);
  });

  test('prevPrev is zero (bad year two years ago)', () => {
    const adopted = calculateX1WithAverage(200000, 300000, 0);
    // 2yr = floor(500000/2) = 250000
    // 3yr = floor(500000/3) = 166666
    // max(200000, 250000, 166666) = 250000
    expect(adopted).toBe(250000);
  });

  test('very small values (1千円 = smallest non-zero)', () => {
    const adopted = calculateX1WithAverage(1, 2, 3);
    // 2yr = floor(3/2) = 1
    // 3yr = floor(6/3) = 2
    // max(1, 1, 2) = 2
    expect(adopted).toBe(2);
  });

  test('very large values (1000億 = 100,000,000千円)', () => {
    const adopted = calculateX1WithAverage(100000000, 50000000, 80000000);
    // current is highest
    expect(adopted).toBe(100000000);
  });

  test('huge disparity between years', () => {
    const adopted = calculateX1WithAverage(1, 100000000, 1);
    // 2yr = floor(100000001/2) = 50000000
    // 3yr = floor(100000002/3) = 33333334
    // max(1, 50000000, 33333334) = 50000000
    expect(adopted).toBe(50000000);
  });

  test('2-year only (no prevPrev provided)', () => {
    const adopted = calculateX1WithAverage(100000, 300000);
    // 2yr = floor(400000/2) = 200000
    // max(100000, 200000) = 200000
    expect(adopted).toBe(200000);
  });

  test('2-year only when current is higher', () => {
    const adopted = calculateX1WithAverage(500000, 200000);
    expect(adopted).toBe(500000);
  });

  test('odd total for 2-year average truncates correctly', () => {
    const adopted = calculateX1WithAverage(100001, 100000);
    // 2yr = floor(200001/2) = floor(100000.5) = 100000
    // max(100001, 100000) = 100001
    expect(adopted).toBe(100001);
  });

  test('remainder in 3-year average truncates correctly', () => {
    const adopted = calculateX1WithAverage(100000, 100000, 100001);
    // 3yr = floor(300001/3) = floor(100000.333) = 100000
    // 2yr = floor(200000/2) = 100000
    // max(100000, 100000, 100000) = 100000
    expect(adopted).toBe(100000);
  });
});

// ==========================================
// Multiple industries with different averaging results
// ==========================================

describe('X1 averaging across multiple industries (different company profiles)', () => {
  // Helper to compute full P with given completion amounts
  function computeP(adoptedCompletion: number): number {
    const yResult = calculateY(baseYInput);
    const x21 = lookupScore(X21_TABLE, baseYInput.equity);
    const x22 = lookupScore(X22_TABLE, 20600);
    const x2 = calculateX2(x21, x22);
    const z1 = lookupScore(Z1_TABLE, 15);
    const z2 = lookupScore(Z2_TABLE, 100000);
    const Z = calculateZ(z1, z2);
    const wResult = calculateW(baseSocialItems);
    const x1 = lookupScore(X1_TABLE, adoptedCompletion);
    return calculateP(x1, x2, yResult.Y, Z, wResult.W);
  }

  test('土木 (civil engineering): sharp recession, 3yr avg best', () => {
    // Typical pattern: public works budget cuts hit hard
    const curr = 80000;      // 8000万
    const prev = 250000;     // 2.5億
    const prevPrev = 400000; // 4億
    const adopted = calculateX1WithAverage(curr, prev, prevPrev);
    // 2yr = floor(330000/2) = 165000
    // 3yr = floor(730000/3) = 243333
    expect(adopted).toBe(243333);

    const pCurr = computeP(curr);
    const pAvg = computeP(adopted);
    expect(pAvg).toBeGreaterThan(pCurr);
  });

  test('建築 (architecture): steady growth, current year best', () => {
    // Housing boom, each year is better
    const curr = 500000;     // 5億
    const prev = 400000;     // 4億
    const prevPrev = 350000; // 3.5億
    const adopted = calculateX1WithAverage(curr, prev, prevPrev);
    expect(adopted).toBe(curr);

    const pCurr = computeP(curr);
    const pAvg = computeP(adopted);
    expect(pCurr).toBe(pAvg); // no benefit from averaging
  });

  test('電気 (electrical): one big project last year, 2yr avg best', () => {
    // Large project completed prev year, nothing this year, prevPrev was quiet
    const curr = 30000;      // 3000万
    const prev = 600000;     // 6億 (big project)
    const prevPrev = 40000;  // 4000万
    const adopted = calculateX1WithAverage(curr, prev, prevPrev);
    // 2yr = floor(630000/2) = 315000
    // 3yr = floor(670000/3) = 223333
    // max(30000, 315000, 223333) = 315000
    expect(adopted).toBe(315000);
  });

  test('管 (plumbing): flat business, averaging makes no difference', () => {
    const curr = 150000;
    const prev = 150000;
    const prevPrev = 150000;
    const adopted = calculateX1WithAverage(curr, prev, prevPrev);
    expect(adopted).toBe(150000);
  });

  test('舗装 (paving): volatile, each scenario possible', () => {
    // Year-to-year swings common for paving companies
    // Scenario A: current dip
    const adoptedA = calculateX1WithAverage(50000, 200000, 150000);
    // 2yr = 125000, 3yr = 133333 → 3yr wins
    expect(adoptedA).toBe(133333);

    // Scenario B: prev was peak
    const adoptedB = calculateX1WithAverage(100000, 300000, 50000);
    // 2yr = 200000, 3yr = 150000 → 2yr wins
    expect(adoptedB).toBe(200000);

    // Scenario C: strong recovery
    const adoptedC = calculateX1WithAverage(250000, 100000, 80000);
    // 2yr = 175000, 3yr = 143333 → current wins
    expect(adoptedC).toBe(250000);
  });

  test('大規模 (large-scale): big numbers, small relative differences still matter for P', () => {
    const curr = 5000000;     // 50億
    const prev = 6000000;     // 60億
    const prevPrev = 5500000; // 55億
    const adopted = calculateX1WithAverage(curr, prev, prevPrev);
    // 2yr = 5500000, 3yr = 5500000
    // max(5000000, 5500000, 5500000) = 5500000
    expect(adopted).toBe(5500000);

    const pCurr = computeP(curr);
    const pAvg = computeP(adopted);
    expect(pAvg).toBeGreaterThanOrEqual(pCurr);
  });
});
