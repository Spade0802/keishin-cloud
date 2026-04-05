import { describe, test, expect } from 'vitest';
import {
  lookupScore,
  X1_TABLE,
  X21_TABLE,
  X22_TABLE,
  Z1_TABLE,
  Z2_TABLE,
} from '@/lib/engine/score-tables';
import { calculateY } from '@/lib/engine/y-calculator';
import { calculateP, calculateX2, calculateZ } from '@/lib/engine/p-calculator';
import type { YInput } from '@/lib/engine/types';

// ==========================================
// 第58期実績との完全一致テスト
// ==========================================
describe('第58期実績との完全一致テスト', () => {
  const FY58_Y_INPUT: YInput = {
    sales: 1668128,
    grossProfit: 270254,
    ordinaryProfit: 85784,
    interestExpense: 6042,
    interestDividendIncome: 844,
    currentLiabilities: 185776,
    fixedLiabilities: 227499,
    totalCapital: 749286,
    equity: 336010,
    fixedAssets: 236308,
    retainedEarnings: 299650,
    corporateTax: 29851,
    depreciation: 5985,
    allowanceDoubtful: 635,
    notesAndAccountsReceivable: 129271, // 21770 + 107501
    constructionPayable: 137521,
    inventoryAndMaterials: 4836, // 4787 + 49
    advanceReceived: 682,
    prev: {
      totalCapital: 827777,
      operatingCF: 78454,
      allowanceDoubtful: 1200,
      notesAndAccountsReceivable: 223124,
      constructionPayable: 224090,
      inventoryAndMaterials: 17836,
      advanceReceived: 1653,
    },
  };

  test('Y = 852', () => {
    const result = calculateY(FY58_Y_INPUT);
    expect(result.Y).toBe(852);
    expect(result.operatingCF).toBe(80666);
  });

  test('X21 = 810, X22 = 687, X2 = 748', () => {
    expect(lookupScore(X21_TABLE, 336010)).toBe(810);
    expect(lookupScore(X22_TABLE, 44332)).toBe(687);
    expect(calculateX2(810, 687)).toBe(748);
  });

  test('W = 1207', () => {
    expect(Math.floor((138 * 1750) / 200)).toBe(1207);
  });

  test('全業種X1一致', () => {
    expect(lookupScore(X1_TABLE, 1375760)).toBe(1067); // 電気
    expect(lookupScore(X1_TABLE, 1685)).toBe(419); // 管
    expect(lookupScore(X1_TABLE, 13876)).toBe(547); // 電気通信
    expect(lookupScore(X1_TABLE, 921)).toBe(409); // 消防施設
  });

  test('全業種Z一致', () => {
    // 電気: Z1(62) + Z2(688475)
    expect(
      calculateZ(lookupScore(Z1_TABLE, 62), lookupScore(Z2_TABLE, 688475))
    ).toBe(1028);
    // 管: Z1(20) + Z2(0)
    expect(
      calculateZ(lookupScore(Z1_TABLE, 20), lookupScore(Z2_TABLE, 0))
    ).toBe(656);
    // 電気通信: Z1(0) + Z2(13876)
    expect(
      calculateZ(lookupScore(Z1_TABLE, 0), lookupScore(Z2_TABLE, 13876))
    ).toBe(529);
    // 消防施設: Z1(0) + Z2(0)
    expect(
      calculateZ(lookupScore(Z1_TABLE, 0), lookupScore(Z2_TABLE, 0))
    ).toBe(456);
  });

  test('全業種P点一致', () => {
    expect(calculateP(1067, 748, 852, 1028, 1207)).toBe(987); // 電気
    expect(calculateP(419, 748, 852, 656, 1207)).toBe(732); // 管
    expect(calculateP(547, 748, 852, 529, 1207)).toBe(732); // 電気通信
    expect(calculateP(409, 748, 852, 456, 1207)).toBe(679); // 消防施設
  });
});

// ==========================================
// 第57期実績との完全一致テスト
// ==========================================
describe('第57期実績との完全一致テスト', () => {
  test('X21 = 795', () => {
    expect(lookupScore(X21_TABLE, 282007)).toBe(795);
  });

  test('全業種P点一致', () => {
    // 57期: Y=772, X2=723, W=1190
    expect(calculateP(998, 723, 772, 1002, 1190)).toBe(941); // 電気
    expect(calculateP(633, 723, 772, 763, 1190)).toBe(790); // 管
    expect(calculateP(436, 723, 772, 471, 1190)).toBe(668); // 電気通信
    expect(calculateP(402, 723, 772, 456, 1190)).toBe(655); // 消防施設
  });
});
