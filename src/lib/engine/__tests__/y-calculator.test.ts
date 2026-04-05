import { describe, expect, it } from 'vitest';
import { calculateOperatingCF, calculateY } from '../y-calculator';
import type { YInput } from '../types';

// ---------------------------------------------------------------------------
// Helper: minimal valid YInput with all zeroes (override as needed)
// ---------------------------------------------------------------------------
function baseYInput(overrides: Partial<YInput> = {}): YInput {
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

// ===========================================================================
// calculateOperatingCF
// ===========================================================================
describe('calculateOperatingCF', () => {
  it('correctly computes operating cash flow from changes', () => {
    const input = baseYInput();
    const { cf, detail } = calculateOperatingCF(input);

    // CF = ordinaryProfit + depreciation - corporateTax
    //    + allowanceChange - receivableChange + payableChange
    //    - inventoryChange + advanceChange
    const allowanceChange = 1000 - 800;  // +200
    const receivableChange = 15000 - 14000; // +1000
    const payableChange = 8000 - 7500;   // +500
    const inventoryChange = 5000 - 4800; // +200
    const advanceChange = 2000 - 1800;   // +200

    const expected =
      10000 + 5000 - 3000 + 200 - 1000 + 500 - 200 + 200;
    expect(cf).toBe(expected);
    expect(detail.ordinaryProfit).toBe(10000);
    expect(detail.depreciation).toBe(5000);
    expect(detail.corporateTax).toBe(3000);
    expect(detail.allowanceChange).toBe(200);
    expect(detail.receivableChange).toBe(1000);
    expect(detail.payableChange).toBe(500);
    expect(detail.inventoryChange).toBe(200);
    expect(detail.advanceChange).toBe(200);
  });

  it('handles negative changes (decreases)', () => {
    const input = baseYInput({
      allowanceDoubtful: 500,
      notesAndAccountsReceivable: 12000,
      constructionPayable: 6000,
      prev: {
        totalCapital: 75000,
        operatingCF: 8000,
        allowanceDoubtful: 1000,
        notesAndAccountsReceivable: 14000,
        constructionPayable: 8000,
        inventoryAndMaterials: 4800,
        advanceReceived: 1800,
      },
    });
    const { detail } = calculateOperatingCF(input);
    expect(detail.allowanceChange).toBe(-500); // decreased
    expect(detail.receivableChange).toBe(-2000); // decreased
    expect(detail.payableChange).toBe(-2000); // decreased
  });

  it('returns zero CF when all values are zero', () => {
    const input = baseYInput({
      ordinaryProfit: 0,
      depreciation: 0,
      corporateTax: 0,
      allowanceDoubtful: 0,
      notesAndAccountsReceivable: 0,
      constructionPayable: 0,
      inventoryAndMaterials: 0,
      advanceReceived: 0,
      prev: {
        totalCapital: 0,
        operatingCF: 0,
        allowanceDoubtful: 0,
        notesAndAccountsReceivable: 0,
        constructionPayable: 0,
        inventoryAndMaterials: 0,
        advanceReceived: 0,
      },
    });
    const { cf } = calculateOperatingCF(input);
    expect(cf).toBe(0);
  });
});

// ===========================================================================
// calculateY — individual indicator (x1-x8) calculations
// ===========================================================================
describe('calculateY — individual indicators', () => {
  it('x1: net interest burden ratio', () => {
    const input = baseYInput({
      interestExpense: 1000,
      interestDividendIncome: 200,
      sales: 100000,
    });
    const result = calculateY(input);
    // raw x1 = (1000 - 200) / 100000 * 100 = 0.8
    expect(result.indicatorsRaw.x1).toBeCloseTo(0.8, 4);
  });

  it('x2: debt months ratio', () => {
    const input = baseYInput({
      currentLiabilities: 20000,
      fixedLiabilities: 10000,
      sales: 120000,
    });
    const result = calculateY(input);
    // raw x2 = (20000 + 10000) / (120000 / 12) = 30000 / 10000 = 3.0
    expect(result.indicatorsRaw.x2).toBeCloseTo(3.0, 4);
  });

  it('x3: gross profit to total capital ratio', () => {
    const input = baseYInput({
      grossProfit: 20000,
      totalCapital: 80000,
      prev: { ...baseYInput().prev, totalCapital: 80000 },
    });
    const result = calculateY(input);
    // totalCapAvg = max(30000, (80000 + 80000)/2) = 80000
    // raw x3 = 20000 / 80000 * 100 = 25.0
    expect(result.indicatorsRaw.x3).toBeCloseTo(25.0, 4);
  });

  it('x4: ordinary profit margin', () => {
    const input = baseYInput({
      ordinaryProfit: 5000,
      sales: 100000,
    });
    const result = calculateY(input);
    // raw x4 = 5000 / 100000 * 100 = 5.0
    expect(result.indicatorsRaw.x4).toBeCloseTo(5.0, 4);
  });

  it('x5: equity to fixed assets ratio', () => {
    const input = baseYInput({
      equity: 50000,
      fixedAssets: 25000,
    });
    const result = calculateY(input);
    // raw x5 = 50000 / 25000 * 100 = 200.0
    expect(result.indicatorsRaw.x5).toBeCloseTo(200.0, 4);
  });

  it('x6: equity ratio', () => {
    const input = baseYInput({
      equity: 40000,
      totalCapital: 100000,
    });
    const result = calculateY(input);
    // raw x6 = 40000 / 100000 * 100 = 40.0
    expect(result.indicatorsRaw.x6).toBeCloseTo(40.0, 4);
  });

  it('x7: operating CF average (2-period)', () => {
    const input = baseYInput();
    const { cf } = calculateOperatingCF(input);
    const result = calculateY(input);
    // raw x7 = (cf / 100000 + prev.operatingCF / 100000) / 2
    const expected = (cf / 100000 + input.prev.operatingCF / 100000) / 2;
    expect(result.indicatorsRaw.x7).toBeCloseTo(expected, 6);
  });

  it('x8: retained earnings', () => {
    const input = baseYInput({ retainedEarnings: 500000 });
    const result = calculateY(input);
    // raw x8 = 500000 / 100000 = 5.0
    expect(result.indicatorsRaw.x8).toBeCloseTo(5.0, 4);
  });
});

// ===========================================================================
// calculateY — clamping (indicator limits)
// ===========================================================================
describe('calculateY — clamping', () => {
  it('clamps x1 to [−0.3, 5.1]', () => {
    // Very high interest burden → raw x1 > 5.1
    const input = baseYInput({
      interestExpense: 10000,
      interestDividendIncome: 0,
      sales: 100000,
    });
    const result = calculateY(input);
    // raw x1 = 10000 / 100000 * 100 = 10.0 → clamped to 5.1
    expect(result.indicators.x1).toBe(5.1);
    expect(result.indicatorsRaw.x1).toBeCloseTo(10.0, 4);
  });

  it('clamps x1 lower bound when interest income exceeds expense', () => {
    const input = baseYInput({
      interestExpense: 0,
      interestDividendIncome: 500,
      sales: 100000,
    });
    const result = calculateY(input);
    // raw x1 = (0 - 500) / 100000 * 100 = -0.5 → clamped to -0.3
    expect(result.indicators.x1).toBe(-0.3);
  });

  it('clamps x5 upper bound at 350', () => {
    const input = baseYInput({
      equity: 500000,
      fixedAssets: 1000, // very small fixed assets
    });
    const result = calculateY(input);
    // raw x5 = 500000 / 1000 * 100 = 50000 → clamped to 350.0
    expect(result.indicators.x5).toBe(350.0);
  });

  it('clamps x6 lower bound when equity is negative', () => {
    const input = baseYInput({
      equity: -100000,
      totalCapital: 100000,
    });
    const result = calculateY(input);
    // raw x6 = -100000 / 100000 * 100 = -100 → clamped to -68.6
    expect(result.indicators.x6).toBe(-68.6);
  });
});

// ===========================================================================
// calculateY — edge cases
// ===========================================================================
describe('calculateY — edge cases', () => {
  it('uses safeSales=1 when sales is 0 (prevents division by zero)', () => {
    const input = baseYInput({ sales: 0 });
    const result = calculateY(input);
    // Should not throw; x1, x2, x4 use safeSales=1
    expect(result.Y).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(result.indicatorsRaw.x1)).toBe(true);
    expect(Number.isFinite(result.indicatorsRaw.x2)).toBe(true);
    expect(Number.isFinite(result.indicatorsRaw.x4)).toBe(true);
  });

  it('uses minimum 30,000 for totalCapAvg when both periods are small', () => {
    const input = baseYInput({
      totalCapital: 10000,
      grossProfit: 6000,
      prev: { ...baseYInput().prev, totalCapital: 10000 },
    });
    const result = calculateY(input);
    // totalCapAvg = max(30000, (10000+10000)/2) = 30000
    // x3 = 6000 / 30000 * 100 = 20.0
    expect(result.indicatorsRaw.x3).toBeCloseTo(20.0, 4);
  });

  it('handles zero fixed assets (x5 = Infinity → clamped)', () => {
    const input = baseYInput({
      equity: 50000,
      fixedAssets: 0,
    });
    const result = calculateY(input);
    // x5 = 50000 / 0 * 100 = Infinity → clamped to 350.0
    expect(result.indicators.x5).toBe(350.0);
  });

  it('handles negative equity', () => {
    const input = baseYInput({
      equity: -50000,
      totalCapital: 100000,
    });
    const result = calculateY(input);
    expect(result.indicatorsRaw.x6).toBeCloseTo(-50.0, 4);
    expect(result.indicators.x6).toBe(-50.0); // within [-68.6, 68.5]
  });

  it('handles negative ordinary profit', () => {
    const input = baseYInput({
      ordinaryProfit: -5000,
      sales: 100000,
    });
    const result = calculateY(input);
    expect(result.indicatorsRaw.x4).toBeCloseTo(-5.0, 4);
    expect(result.indicators.x4).toBe(-5.0); // within [-8.5, 5.1]
  });
});

// ===========================================================================
// calculateY — A score and final Y score
// ===========================================================================
describe('calculateY — A and Y computation', () => {
  it('A score is computed from weighted indicators', () => {
    const input = baseYInput();
    const result = calculateY(input);

    const ind = result.indicators;
    const expectedA =
      -0.465 * ind.x1 -
      0.0508 * ind.x2 +
      0.0264 * ind.x3 +
      0.0277 * ind.x4 +
      0.0011 * ind.x5 +
      0.0089 * ind.x6 +
      0.0818 * ind.x7 +
      0.0172 * ind.x8 +
      0.1906;

    expect(result.A).toBeCloseTo(expectedA, 6);
  });

  it('Y = floor(167.3 * A + 583), clamped to [0, 1595]', () => {
    const input = baseYInput();
    const result = calculateY(input);
    const expectedY = Math.max(
      0,
      Math.min(1595, Math.floor(167.3 * result.A + 583))
    );
    expect(result.Y).toBe(expectedY);
  });

  it('Y is at least 0 even when A is very negative', () => {
    // Create a scenario with very poor financials
    const input = baseYInput({
      interestExpense: 10000,
      interestDividendIncome: 0,
      currentLiabilities: 500000,
      fixedLiabilities: 500000,
      sales: 50000,
      grossProfit: 0,
      ordinaryProfit: -50000,
      equity: -200000,
      fixedAssets: 100000,
      retainedEarnings: -300000,
    });
    const result = calculateY(input);
    expect(result.Y).toBeGreaterThanOrEqual(0);
  });

  it('Y is at most 1595', () => {
    // Ideal financials: low interest, low debt, high profit, high equity
    const input = baseYInput({
      interestExpense: 0,
      interestDividendIncome: 500,
      currentLiabilities: 1000,
      fixedLiabilities: 0,
      sales: 10000000,
      grossProfit: 5000000,
      ordinaryProfit: 5000000,
      totalCapital: 50000,
      equity: 5000000,
      fixedAssets: 1000,
      retainedEarnings: 100000000,
      prev: {
        ...baseYInput().prev,
        totalCapital: 50000,
        operatingCF: 100000000,
      },
    });
    const result = calculateY(input);
    expect(result.Y).toBeLessThanOrEqual(1595);
  });

  it('result includes operatingCF and detail', () => {
    const input = baseYInput();
    const result = calculateY(input);
    expect(result.operatingCF).toBe(calculateOperatingCF(input).cf);
    expect(result.operatingCFDetail).toBeDefined();
    expect(result.operatingCFDetail.ordinaryProfit).toBe(input.ordinaryProfit);
  });
});

// ===========================================================================
// Real-world financial data: typical small/medium construction company
// ===========================================================================
describe('calculateY — real-world financial data', () => {
  it('small construction company (年商1億円規模)', () => {
    const input = baseYInput({
      sales: 100000,          // 1億円
      grossProfit: 25000,     // 粗利25%
      ordinaryProfit: 5000,   // 経常利益5%
      interestExpense: 800,
      interestDividendIncome: 50,
      currentLiabilities: 30000,
      fixedLiabilities: 15000,
      totalCapital: 60000,
      equity: 20000,
      fixedAssets: 18000,
      retainedEarnings: 15000,
      corporateTax: 1500,
      depreciation: 3000,
      allowanceDoubtful: 500,
      notesAndAccountsReceivable: 25000,
      constructionPayable: 12000,
      inventoryAndMaterials: 3000,
      advanceReceived: 5000,
      prev: {
        totalCapital: 55000,
        operatingCF: 6000,
        allowanceDoubtful: 400,
        notesAndAccountsReceivable: 22000,
        constructionPayable: 11000,
        inventoryAndMaterials: 2800,
        advanceReceived: 4500,
      },
    });
    const result = calculateY(input);
    // Y should be a reasonable score for a small company
    expect(result.Y).toBeGreaterThan(400);
    expect(result.Y).toBeLessThan(1200);
    // All indicators should be within their clamped ranges
    expect(result.indicators.x1).toBeGreaterThanOrEqual(-0.3);
    expect(result.indicators.x1).toBeLessThanOrEqual(5.1);
  });

  it('medium construction company (年商5億円規模)', () => {
    const input = baseYInput({
      sales: 500000,          // 5億円
      grossProfit: 100000,    // 粗利20%
      ordinaryProfit: 20000,  // 経常利益4%
      interestExpense: 3000,
      interestDividendIncome: 200,
      currentLiabilities: 120000,
      fixedLiabilities: 50000,
      totalCapital: 250000,
      equity: 80000,
      fixedAssets: 70000,
      retainedEarnings: 60000,
      corporateTax: 6000,
      depreciation: 10000,
      allowanceDoubtful: 2000,
      notesAndAccountsReceivable: 80000,
      constructionPayable: 40000,
      inventoryAndMaterials: 15000,
      advanceReceived: 20000,
      prev: {
        totalCapital: 230000,
        operatingCF: 25000,
        allowanceDoubtful: 1800,
        notesAndAccountsReceivable: 75000,
        constructionPayable: 38000,
        inventoryAndMaterials: 14000,
        advanceReceived: 18000,
      },
    });
    const result = calculateY(input);
    expect(result.Y).toBeGreaterThan(500);
    expect(result.Y).toBeLessThan(1400);
    // x3: grossProfit/totalCapAvg should be reasonable
    const totalCapAvg = (250000 + 230000) / 2;
    expect(result.indicatorsRaw.x3).toBeCloseTo(
      (100000 / totalCapAvg) * 100,
      2
    );
  });

  it('struggling company with losses (赤字企業)', () => {
    const input = baseYInput({
      sales: 80000,
      grossProfit: 5000,
      ordinaryProfit: -3000,
      interestExpense: 2000,
      interestDividendIncome: 10,
      currentLiabilities: 50000,
      fixedLiabilities: 30000,
      totalCapital: 70000,
      equity: -10000,    // 債務超過
      fixedAssets: 25000,
      retainedEarnings: -15000,
      corporateTax: 0,
      depreciation: 4000,
      allowanceDoubtful: 3000,
      notesAndAccountsReceivable: 20000,
      constructionPayable: 10000,
      inventoryAndMaterials: 8000,
      advanceReceived: 1000,
      prev: {
        totalCapital: 75000,
        operatingCF: -5000,
        allowanceDoubtful: 2500,
        notesAndAccountsReceivable: 18000,
        constructionPayable: 11000,
        inventoryAndMaterials: 7000,
        advanceReceived: 1500,
      },
    });
    const result = calculateY(input);
    // Poor financials → low Y score
    expect(result.Y).toBeGreaterThanOrEqual(0);
    expect(result.Y).toBeLessThan(600);
    // Negative equity ratio
    expect(result.indicatorsRaw.x6).toBeLessThan(0);
  });
});

// ===========================================================================
// All 8 indicators at exact clamping boundaries
// ===========================================================================
describe('calculateY — all indicators at clamping boundaries', () => {
  it('x1 at exact lower bound -0.3', () => {
    // x1 = (expense - income) / sales * 100 = -0.3
    // => expense - income = -0.3 * sales / 100
    const input = baseYInput({
      interestExpense: 0,
      interestDividendIncome: 300,
      sales: 100000,
    });
    const result = calculateY(input);
    // raw = (0 - 300) / 100000 * 100 = -0.3 → exactly at lower bound
    expect(result.indicatorsRaw.x1).toBeCloseTo(-0.3, 6);
    expect(result.indicators.x1).toBeCloseTo(-0.3, 6);
  });

  it('x1 at exact upper bound 5.1', () => {
    const input = baseYInput({
      interestExpense: 5100,
      interestDividendIncome: 0,
      sales: 100000,
    });
    const result = calculateY(input);
    expect(result.indicatorsRaw.x1).toBeCloseTo(5.1, 6);
    expect(result.indicators.x1).toBeCloseTo(5.1, 6);
  });

  it('x2 at exact lower bound 0.9', () => {
    // x2 = (currentLiab + fixedLiab) / (sales / 12) = 0.9
    // => total liab = 0.9 * sales / 12
    const sales = 120000;
    const totalLiab = 0.9 * sales / 12; // = 9000
    const input = baseYInput({
      currentLiabilities: totalLiab,
      fixedLiabilities: 0,
      sales,
    });
    const result = calculateY(input);
    expect(result.indicatorsRaw.x2).toBeCloseTo(0.9, 6);
    expect(result.indicators.x2).toBeCloseTo(0.9, 6);
  });

  it('x2 at exact upper bound 18.0', () => {
    const sales = 120000;
    const totalLiab = 18.0 * sales / 12; // = 180000
    const input = baseYInput({
      currentLiabilities: totalLiab,
      fixedLiabilities: 0,
      sales,
    });
    const result = calculateY(input);
    expect(result.indicatorsRaw.x2).toBeCloseTo(18.0, 6);
    expect(result.indicators.x2).toBeCloseTo(18.0, 6);
  });

  it('x3 at lower bound 6.5', () => {
    // x3 = grossProfit / totalCapAvg * 100 = 6.5
    const totalCapAvg = 100000;
    const grossProfit = 6.5 * totalCapAvg / 100; // = 6500
    const input = baseYInput({
      grossProfit,
      totalCapital: totalCapAvg,
      prev: { ...baseYInput().prev, totalCapital: totalCapAvg },
    });
    const result = calculateY(input);
    expect(result.indicatorsRaw.x3).toBeCloseTo(6.5, 4);
    expect(result.indicators.x3).toBeCloseTo(6.5, 4);
  });

  it('x3 above upper bound 63.6 gets clamped', () => {
    const input = baseYInput({
      grossProfit: 70000,
      totalCapital: 100000,
      prev: { ...baseYInput().prev, totalCapital: 100000 },
    });
    const result = calculateY(input);
    // raw = 70000/100000*100 = 70 > 63.6
    expect(result.indicatorsRaw.x3).toBeCloseTo(70.0, 4);
    expect(result.indicators.x3).toBe(63.6);
  });

  it('x4 at lower bound -8.5', () => {
    // x4 = ordinaryProfit / sales * 100 = -8.5
    const input = baseYInput({
      ordinaryProfit: -8500,
      sales: 100000,
    });
    const result = calculateY(input);
    expect(result.indicatorsRaw.x4).toBeCloseTo(-8.5, 6);
    expect(result.indicators.x4).toBeCloseTo(-8.5, 6);
  });

  it('x4 at upper bound 5.1', () => {
    const input = baseYInput({
      ordinaryProfit: 5100,
      sales: 100000,
    });
    const result = calculateY(input);
    expect(result.indicatorsRaw.x4).toBeCloseTo(5.1, 6);
    expect(result.indicators.x4).toBeCloseTo(5.1, 6);
  });

  it('x5 at lower bound -76.5', () => {
    // x5 = equity / fixedAssets * 100 = -76.5
    const input = baseYInput({
      equity: -76500,
      fixedAssets: 100000,
    });
    const result = calculateY(input);
    expect(result.indicatorsRaw.x5).toBeCloseTo(-76.5, 6);
    expect(result.indicators.x5).toBeCloseTo(-76.5, 6);
  });

  it('x6 at lower bound -68.6', () => {
    const input = baseYInput({
      equity: -68600,
      totalCapital: 100000,
    });
    const result = calculateY(input);
    expect(result.indicatorsRaw.x6).toBeCloseTo(-68.6, 6);
    expect(result.indicators.x6).toBeCloseTo(-68.6, 6);
  });

  it('x6 at upper bound 68.5', () => {
    const input = baseYInput({
      equity: 68500,
      totalCapital: 100000,
    });
    const result = calculateY(input);
    expect(result.indicatorsRaw.x6).toBeCloseTo(68.5, 6);
    expect(result.indicators.x6).toBeCloseTo(68.5, 6);
  });

  it('x7 below lower bound -10.0 gets clamped', () => {
    // x7 = (cf/100000 + prev.operatingCF/100000) / 2
    // Need both to be very negative
    const input = baseYInput({
      ordinaryProfit: -2000000,
      depreciation: 0,
      corporateTax: 0,
      prev: {
        ...baseYInput().prev,
        operatingCF: -2000000,
      },
    });
    const result = calculateY(input);
    expect(result.indicators.x7).toBe(-10.0);
  });

  it('x8 at lower bound -3.0', () => {
    const input = baseYInput({
      retainedEarnings: -300000,
    });
    const result = calculateY(input);
    expect(result.indicatorsRaw.x8).toBeCloseTo(-3.0, 6);
    expect(result.indicators.x8).toBeCloseTo(-3.0, 6);
  });

  it('x8 at upper bound 100.0 gets clamped', () => {
    const input = baseYInput({
      retainedEarnings: 20000000, // 200億 → raw = 200
    });
    const result = calculateY(input);
    expect(result.indicatorsRaw.x8).toBeCloseTo(200.0, 4);
    expect(result.indicators.x8).toBe(100.0);
  });
});

// ===========================================================================
// Zero sales division safety
// ===========================================================================
describe('calculateY — zero sales safety', () => {
  it('zero sales: all sales-dependent indicators are finite', () => {
    const input = baseYInput({ sales: 0 });
    const result = calculateY(input);
    expect(Number.isFinite(result.indicatorsRaw.x1)).toBe(true);
    expect(Number.isFinite(result.indicatorsRaw.x2)).toBe(true);
    expect(Number.isFinite(result.indicatorsRaw.x4)).toBe(true);
    expect(Number.isFinite(result.Y)).toBe(true);
    expect(Number.isFinite(result.A)).toBe(true);
  });

  it('zero sales: x2 debt-months is extremely large but clamped', () => {
    const input = baseYInput({
      sales: 0,
      currentLiabilities: 50000,
      fixedLiabilities: 20000,
    });
    const result = calculateY(input);
    // safeSales=1, so x2 = 70000 / (1/12) = 840000 → clamped to 18.0
    expect(result.indicators.x2).toBe(18.0);
  });

  it('negative sales treated same as zero (safeSales=1)', () => {
    const input = baseYInput({ sales: -1000 });
    const result = calculateY(input);
    // sales <= 0 → safeSales = 1
    expect(Number.isFinite(result.Y)).toBe(true);
  });
});

// ===========================================================================
// Operating CF with various balance sheet changes
// ===========================================================================
describe('calculateOperatingCF — various balance sheet changes', () => {
  it('large receivables increase reduces CF', () => {
    const input = baseYInput({
      ordinaryProfit: 10000,
      depreciation: 5000,
      corporateTax: 3000,
      notesAndAccountsReceivable: 50000,
      prev: {
        ...baseYInput().prev,
        notesAndAccountsReceivable: 20000,
      },
    });
    const { cf } = calculateOperatingCF(input);
    // receivableChange = 50000 - 20000 = +30000 (subtracted from CF)
    // This large increase should make CF significantly lower
    expect(cf).toBeLessThan(0);
  });

  it('large payables increase boosts CF', () => {
    const input = baseYInput({
      ordinaryProfit: 5000,
      depreciation: 2000,
      corporateTax: 1000,
      constructionPayable: 50000,
      prev: {
        ...baseYInput().prev,
        constructionPayable: 10000,
      },
    });
    const { cf } = calculateOperatingCF(input);
    // payableChange = 50000 - 10000 = +40000 (added to CF)
    expect(cf).toBeGreaterThan(40000);
  });

  it('inventory build-up reduces CF', () => {
    const input = baseYInput({
      ordinaryProfit: 10000,
      depreciation: 3000,
      corporateTax: 2000,
      inventoryAndMaterials: 30000,
      prev: {
        ...baseYInput().prev,
        inventoryAndMaterials: 5000,
      },
    });
    const { cf } = calculateOperatingCF(input);
    // inventoryChange = 30000 - 5000 = +25000 (subtracted from CF)
    expect(cf).toBeLessThan(0);
  });

  it('advance received increase boosts CF', () => {
    const input = baseYInput({
      ordinaryProfit: 1000,
      depreciation: 500,
      corporateTax: 300,
      advanceReceived: 20000,
      prev: {
        ...baseYInput().prev,
        advanceReceived: 1000,
      },
    });
    const { cf } = calculateOperatingCF(input);
    // advanceChange = 20000 - 1000 = +19000 (added to CF)
    expect(cf).toBeGreaterThan(19000);
  });

  it('all changes cancel out leaves base CF', () => {
    const base = baseYInput({
      ordinaryProfit: 10000,
      depreciation: 5000,
      corporateTax: 3000,
      // All BS items unchanged from prev
      allowanceDoubtful: 1000,
      notesAndAccountsReceivable: 15000,
      constructionPayable: 8000,
      inventoryAndMaterials: 5000,
      advanceReceived: 2000,
      prev: {
        totalCapital: 75000,
        operatingCF: 8000,
        allowanceDoubtful: 1000,
        notesAndAccountsReceivable: 15000,
        constructionPayable: 8000,
        inventoryAndMaterials: 5000,
        advanceReceived: 2000,
      },
    });
    const { cf } = calculateOperatingCF(base);
    // All changes are 0, so CF = ordinaryProfit + depreciation - corporateTax
    expect(cf).toBe(10000 + 5000 - 3000);
  });
});
