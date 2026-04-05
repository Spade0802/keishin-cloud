import { describe, it, expect } from 'vitest';
import {
  buildPrevPeriodSnapshot,
  type PrevPeriodSnapshot,
} from '../prev-period-snapshot';
import type { KeishinBS } from '../types';

/** 全フィールドが 0 の KeishinBS を返すヘルパー */
function emptyBS(): KeishinBS {
  return {
    cashDeposits: 0,
    notesReceivable: 0,
    accountsReceivableConstruction: 0,
    securities: 0,
    wipConstruction: 0,
    materialInventory: 0,
    shortTermLoans: 0,
    prepaidExpenses: 0,
    deferredTaxAssetCurrent: 0,
    otherCurrent: 0,
    allowanceDoubtful: 0,
    currentAssetsTotal: 0,
    buildingsStructures: 0,
    machineryVehicles: 0,
    toolsEquipment: 0,
    land: 0,
    tangibleFixedTotal: 0,
    patent: 0,
    otherIntangible: 0,
    intangibleFixedTotal: 0,
    relatedCompanyShares: 0,
    longTermLoans: 0,
    insuranceReserve: 0,
    longTermPrepaid: 0,
    deferredTaxAssetFixed: 0,
    otherInvestments: 0,
    investmentsTotal: 0,
    fixedAssetsTotal: 0,
    deferredAssetsTotal: 0,
    totalAssets: 0,
    notesPayable: 0,
    constructionPayable: 0,
    shortTermBorrowing: 0,
    leaseDebt: 0,
    accountsPayable: 0,
    unpaidExpenses: 0,
    unpaidCorporateTax: 0,
    deferredTaxLiability: 0,
    advanceReceivedConstruction: 0,
    depositsReceived: 0,
    advanceRevenue: 0,
    provisions: 0,
    unpaidConsumptionTax: 0,
    currentLiabilitiesTotal: 0,
    longTermBorrowing: 0,
    fixedLiabilitiesTotal: 0,
    totalLiabilities: 0,
    capitalStock: 0,
    legalReserve: 0,
    otherRetainedEarnings: 0,
    specialReserve: 0,
    retainedEarningsCF: 0,
    retainedEarningsTotal: 0,
    treasuryStock: 0,
    shareholdersEquityTotal: 0,
    securitiesValuation: 0,
    evaluationTotal: 0,
    totalEquity: 0,
    totalLiabilitiesEquity: 0,
  };
}

/** 指定フィールドだけ上書きした KeishinBS を返す */
function makeBS(overrides: Partial<KeishinBS>): KeishinBS {
  return { ...emptyBS(), ...overrides };
}

describe('buildPrevPeriodSnapshot', () => {
  // -----------------------------------------------------------
  // 基本スナップショット作成
  // -----------------------------------------------------------
  describe('基本スナップショット作成', () => {
    it('全フィールドが正しくマッピングされる', () => {
      const bs = makeBS({
        totalAssets: 500_000,
        allowanceDoubtful: -3_000,
        notesReceivable: 10_000,
        accountsReceivableConstruction: 40_000,
        constructionPayable: 20_000,
        wipConstruction: 8_000,
        materialInventory: 2_000,
        advanceReceivedConstruction: 5_000,
      });

      const snapshot = buildPrevPeriodSnapshot(bs, 15_000);

      expect(snapshot).toEqual<PrevPeriodSnapshot>({
        totalCapital: 500_000,
        operatingCF: 15_000,
        allowanceDoubtful: 3_000, // 絶対値になる
        notesAndReceivable: 50_000, // 10000 + 40000
        constructionPayable: 20_000,
        inventoryAndMaterials: 10_000, // 8000 + 2000
        advanceReceived: 5_000,
      });
    });

    it('返却値のキーが過不足なくスナップショット定義と一致する', () => {
      const snapshot = buildPrevPeriodSnapshot(emptyBS(), 0);
      const keys = Object.keys(snapshot).sort();
      expect(keys).toEqual([
        'advanceReceived',
        'allowanceDoubtful',
        'constructionPayable',
        'inventoryAndMaterials',
        'notesAndReceivable',
        'operatingCF',
        'totalCapital',
      ]);
    });
  });

  // -----------------------------------------------------------
  // データマッピングの詳細
  // -----------------------------------------------------------
  describe('データマッピング', () => {
    it('totalCapital は bs.totalAssets をそのまま使う', () => {
      const bs = makeBS({ totalAssets: 123_456 });
      expect(buildPrevPeriodSnapshot(bs, 0).totalCapital).toBe(123_456);
    });

    it('operatingCF は引数をそのまま使う', () => {
      expect(buildPrevPeriodSnapshot(emptyBS(), 99_999).operatingCF).toBe(
        99_999,
      );
    });

    it('notesAndReceivable は notesReceivable + accountsReceivableConstruction の合算', () => {
      const bs = makeBS({
        notesReceivable: 7_000,
        accountsReceivableConstruction: 3_000,
      });
      expect(buildPrevPeriodSnapshot(bs, 0).notesAndReceivable).toBe(10_000);
    });

    it('inventoryAndMaterials は wipConstruction + materialInventory の合算', () => {
      const bs = makeBS({
        wipConstruction: 4_500,
        materialInventory: 500,
      });
      expect(buildPrevPeriodSnapshot(bs, 0).inventoryAndMaterials).toBe(5_000);
    });

    it('constructionPayable はそのまま転記', () => {
      const bs = makeBS({ constructionPayable: 33_333 });
      expect(buildPrevPeriodSnapshot(bs, 0).constructionPayable).toBe(33_333);
    });

    it('advanceReceived は advanceReceivedConstruction をそのまま転記', () => {
      const bs = makeBS({ advanceReceivedConstruction: 12_345 });
      expect(buildPrevPeriodSnapshot(bs, 0).advanceReceived).toBe(12_345);
    });
  });

  // -----------------------------------------------------------
  // allowanceDoubtful の絶対値変換
  // -----------------------------------------------------------
  describe('allowanceDoubtful の絶対値変換', () => {
    it('負値は正に変換される', () => {
      const bs = makeBS({ allowanceDoubtful: -5_000 });
      expect(buildPrevPeriodSnapshot(bs, 0).allowanceDoubtful).toBe(5_000);
    });

    it('正値はそのまま維持される', () => {
      const bs = makeBS({ allowanceDoubtful: 5_000 });
      expect(buildPrevPeriodSnapshot(bs, 0).allowanceDoubtful).toBe(5_000);
    });

    it('0 は 0 のまま', () => {
      const bs = makeBS({ allowanceDoubtful: 0 });
      expect(buildPrevPeriodSnapshot(bs, 0).allowanceDoubtful).toBe(0);
    });
  });

  // -----------------------------------------------------------
  // ゼロ・欠損フィールド
  // -----------------------------------------------------------
  describe('全フィールドゼロ', () => {
    it('全 BS がゼロ、CF がゼロの場合すべて 0 になる', () => {
      const snapshot = buildPrevPeriodSnapshot(emptyBS(), 0);
      for (const value of Object.values(snapshot)) {
        expect(value).toBe(0);
      }
    });
  });

  // -----------------------------------------------------------
  // エッジケース
  // -----------------------------------------------------------
  describe('エッジケース', () => {
    it('非常に大きい数値を正しく扱える', () => {
      const bs = makeBS({
        totalAssets: 999_999_999,
        notesReceivable: 500_000_000,
        accountsReceivableConstruction: 400_000_000,
      });
      const snapshot = buildPrevPeriodSnapshot(bs, 100_000_000);
      expect(snapshot.totalCapital).toBe(999_999_999);
      expect(snapshot.notesAndReceivable).toBe(900_000_000);
      expect(snapshot.operatingCF).toBe(100_000_000);
    });

    it('営業CFが負の値でも正しく格納される', () => {
      const snapshot = buildPrevPeriodSnapshot(emptyBS(), -50_000);
      expect(snapshot.operatingCF).toBe(-50_000);
    });

    it('小数を含む千円未満端数も保持される', () => {
      const bs = makeBS({
        totalAssets: 100_000.5,
        wipConstruction: 1_234.567,
        materialInventory: 0.433,
      });
      const snapshot = buildPrevPeriodSnapshot(bs, 0);
      expect(snapshot.totalCapital).toBeCloseTo(100_000.5);
      expect(snapshot.inventoryAndMaterials).toBeCloseTo(1_235);
    });

    it('片方だけゼロの合算フィールドでも正しく計算される', () => {
      const bs1 = makeBS({
        notesReceivable: 10_000,
        accountsReceivableConstruction: 0,
      });
      expect(buildPrevPeriodSnapshot(bs1, 0).notesAndReceivable).toBe(10_000);

      const bs2 = makeBS({
        notesReceivable: 0,
        accountsReceivableConstruction: 25_000,
      });
      expect(buildPrevPeriodSnapshot(bs2, 0).notesAndReceivable).toBe(25_000);
    });
  });
});
