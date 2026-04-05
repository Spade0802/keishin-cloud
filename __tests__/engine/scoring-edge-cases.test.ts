import { describe, test, expect } from 'vitest';
import {
  calculateP,
  calculateX2,
  calculateZ,
  calculateX1WithAverage,
} from '@/lib/engine/p-calculator';
import {
  lookupScore,
  X1_TABLE,
  X21_TABLE,
  X22_TABLE,
  Z1_TABLE,
  Z2_TABLE,
} from '@/lib/engine/score-tables';

// ---------------------------------------------------------------------------
// calculateP: extreme inputs
// ---------------------------------------------------------------------------

describe('calculateP extreme inputs', () => {
  test('all zeros should clamp to minimum P=6', () => {
    const result = calculateP(0, 0, 0, 0, 0);
    expect(result).toBe(6);
  });

  test('all inputs at maximum realistic scores', () => {
    // X1 max=1998, X21 max=902, X22 max=938 => X2 max=920,
    // Y max ~1595, Z max ~1712, W max ~1750
    const result = calculateP(1998, 920, 1595, 1712, 1750);
    // 0.25*1998 + 0.15*920 + 0.20*1595 + 0.25*1712 + 0.15*1750
    // = 499.5 + 138 + 319 + 428 + 262.5 = 1647
    expect(result).toBe(1647);
  });

  test('result should be clamped to max 2160', () => {
    // Even with impossibly high inputs
    const result = calculateP(9999, 9999, 9999, 9999, 9999);
    expect(result).toBe(2160);
  });

  test('result should be clamped to min 6', () => {
    const result = calculateP(-1000, -1000, -1000, -1000, -1000);
    expect(result).toBe(6);
  });

  test('negative inputs should still produce valid range', () => {
    const result = calculateP(0, 0, 0, 0, -100);
    expect(result).toBeGreaterThanOrEqual(6);
    expect(result).toBeLessThanOrEqual(2160);
  });
});

// ---------------------------------------------------------------------------
// X1 table anomaly at 10M boundary
// ---------------------------------------------------------------------------

describe('X1 table 10M boundary anomaly', () => {
  test('score just below 10,000,000 (9,999,999)', () => {
    const below = lookupScore(X1_TABLE, 9_999_999);
    expect(typeof below).toBe('number');
  });

  test('score at exactly 10,000,000', () => {
    const at = lookupScore(X1_TABLE, 10_000_000);
    expect(typeof at).toBe('number');
  });

  test('score just above 10,000,000 (10,000,001)', () => {
    const above = lookupScore(X1_TABLE, 10_000_001);
    expect(typeof above).toBe('number');
  });

  test('jump at 10M boundary is documented anomaly (>1 point gap)', () => {
    // brackets[30]: 8M-10M uses a=64, b=2000000, c=1155
    // brackets[31]: 10M-12M uses a=51, b=2000000, c=1311
    // At 9,999,999: floor(64*9999999/2000000) + 1155
    // At 10,000,000: floor(51*10000000/2000000) + 1311
    const justBelow = lookupScore(X1_TABLE, 9_999_999);
    const atBoundary = lookupScore(X1_TABLE, 10_000_000);
    const gap = atBoundary - justBelow;
    // The documented anomaly says +92 point jump at 10M boundary
    expect(gap).toBeGreaterThan(1);
  });

  test('score at 30M boundary also has anomaly', () => {
    const justBelow = lookupScore(X1_TABLE, 29_999_999);
    const atBoundary = lookupScore(X1_TABLE, 30_000_000);
    const gap = atBoundary - justBelow;
    // Documented +77 point jump at 30M boundary
    expect(gap).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// Z calculation with edge values
// ---------------------------------------------------------------------------

describe('calculateZ edge values', () => {
  test('Z with both zero inputs', () => {
    expect(calculateZ(0, 0)).toBe(0);
  });

  test('Z with Z1 only (Z2=0)', () => {
    // Z = floor(1000 * 0.8 + 0 * 0.2) = 800
    expect(calculateZ(1000, 0)).toBe(800);
  });

  test('Z with Z2 only (Z1=0)', () => {
    // Z = floor(0 * 0.8 + 1000 * 0.2) = 200
    expect(calculateZ(0, 1000)).toBe(200);
  });

  test('Z weight distribution is 80/20', () => {
    // Same value for both should equal that value
    // Z = floor(500 * 0.8 + 500 * 0.2) = floor(400 + 100) = 500
    expect(calculateZ(500, 500)).toBe(500);
  });

  test('Z with large realistic values', () => {
    // Z1 max from table = 1712, Z2 max from table = 1341
    const z = calculateZ(1712, 1341);
    // floor(1712*0.8 + 1341*0.2) = floor(1369.6 + 268.2) = floor(1637.8) = 1637
    expect(z).toBe(1637);
  });

  test('Z truncates fractional part correctly', () => {
    // Z = floor(101 * 0.8 + 101 * 0.2) = floor(80.8 + 20.2) = floor(101.0) = 101
    expect(calculateZ(101, 101)).toBe(101);
    // Z = floor(1 * 0.8 + 0 * 0.2) = floor(0.8) = 0
    expect(calculateZ(1, 0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Z1/Z2 table lookups at boundaries
// ---------------------------------------------------------------------------

describe('Z1 table edge values', () => {
  test('Z1 at 0', () => {
    expect(lookupScore(Z1_TABLE, 0)).toBe(510);
  });

  test('Z1 at max bracket (1100+)', () => {
    expect(lookupScore(Z1_TABLE, 1100)).toBe(1712);
    expect(lookupScore(Z1_TABLE, 99999)).toBe(1712);
  });
});

describe('Z2 table edge values', () => {
  test('Z2 at 0', () => {
    expect(lookupScore(Z2_TABLE, 0)).toBe(241);
  });

  test('Z2 at max bracket (2,000,000+)', () => {
    expect(lookupScore(Z2_TABLE, 2_000_000)).toBe(1341);
    expect(lookupScore(Z2_TABLE, 99_999_999)).toBe(1341);
  });
});

// ---------------------------------------------------------------------------
// calculateX2 edge values
// ---------------------------------------------------------------------------

describe('calculateX2 edge values', () => {
  test('both zero', () => {
    expect(calculateX2(0, 0)).toBe(0);
  });

  test('odd sum truncates correctly', () => {
    // floor((101 + 100) / 2) = floor(100.5) = 100
    expect(calculateX2(101, 100)).toBe(100);
  });

  test('max table values', () => {
    // X21 max=902, X22 max=938
    expect(calculateX2(902, 938)).toBe(920);
  });
});

// ---------------------------------------------------------------------------
// X21/X22 tables with negative values (debt)
// ---------------------------------------------------------------------------

describe('X21/X22 tables handle negative values', () => {
  test('X21 with large negative (debt) returns 0', () => {
    expect(lookupScore(X21_TABLE, -999_999)).toBe(0);
  });

  test('X22 with large negative (loss) returns 0', () => {
    expect(lookupScore(X22_TABLE, -999_999)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculateX1WithAverage edge cases
// ---------------------------------------------------------------------------

describe('calculateX1WithAverage edge cases', () => {
  test('all zeros', () => {
    expect(calculateX1WithAverage(0, 0, 0)).toBe(0);
  });

  test('current period is best', () => {
    expect(calculateX1WithAverage(100, 50, 30)).toBe(100);
  });

  test('two-year average is best', () => {
    // curr=50, prev=150 => 2yr avg = 100
    expect(calculateX1WithAverage(50, 150)).toBe(100);
  });

  test('three-year average is best', () => {
    // curr=10, prev=10, prevPrev=280 => 3yr avg = 100
    expect(calculateX1WithAverage(10, 10, 280)).toBe(100);
  });

  test('without prevPrev only compares curr and 2yr avg', () => {
    expect(calculateX1WithAverage(80, 120)).toBe(100);
  });
});
