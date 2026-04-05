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
