import { describe, test, expect } from 'vitest';
import { calculateY, calculateOperatingCF } from '@/lib/engine/y-calculator';
import type { YInput } from '@/lib/engine/types';

// 第58期の実データから構築したYInput
const FY58_Y_INPUT: YInput = {
  sales: 1668128,
  grossProfit: 270254,
  ordinaryProfit: 85784,
  interestExpense: 6042,
  interestDividendIncome: 844,
  currentLiabilities: 185776,
  fixedLiabilities: 227499,
  totalCapital: 749286, // totalAssets = totalCapital
  equity: 336010, // 純資産合計
  fixedAssets: 236308,
  retainedEarnings: 299650, // 利益剰余金合計
  corporateTax: 29851,
  depreciation: 5985,
  allowanceDoubtful: 635, // 絶対値
  notesAndAccountsReceivable: 21770 + 107501, // 受取手形 + 完成工事未収入金
  constructionPayable: 137521, // ★未払経費を含めない
  inventoryAndMaterials: 4787 + 49, // 未成工事支出金 + 材料貯蔵品
  advanceReceived: 682, // 未成工事受入金
  prev: {
    totalCapital: 827777,
    operatingCF: 78454,
    allowanceDoubtful: 1200,
    notesAndAccountsReceivable: 223124, // 25800+197324
    constructionPayable: 224090,
    inventoryAndMaterials: 17836, // 17780+56
    advanceReceived: 1653,
  },
};

describe('営業CF計算', () => {
  test('58期 営業CF = 80,666千円', () => {
    const { cf } = calculateOperatingCF(FY58_Y_INPUT);
    expect(cf).toBe(80666);
  });
});

describe('Y点計算', () => {
  test('58期 Y = 852', () => {
    const result = calculateY(FY58_Y_INPUT);
    expect(result.Y).toBe(852);
    expect(result.operatingCF).toBe(80666);
  });
});
