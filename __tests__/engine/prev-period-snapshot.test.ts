import { describe, it, expect } from 'vitest';
import {
  buildPrevPeriodSnapshot,
  type PrevPeriodSnapshot,
} from '@/lib/engine/prev-period-snapshot';
import type { KeishinBS } from '@/lib/engine/types';

/** テスト用のKeishinBSを生成（必要なフィールドだけ上書き可能） */
function makeBs(overrides: Partial<KeishinBS> = {}): KeishinBS {
  const defaults: KeishinBS = {
    cashDeposits: 10000,
    notesReceivable: 5000,
    accountsReceivableConstruction: 8000,
    securities: 0,
    wipConstruction: 3000,
    materialInventory: 1000,
    shortTermLoans: 0,
    prepaidExpenses: 0,
    deferredTaxAssetCurrent: 0,
    otherCurrent: 0,
    allowanceDoubtful: -500,
    currentAssetsTotal: 26500,
    buildingsStructures: 10000,
    machineryVehicles: 5000,
    toolsEquipment: 2000,
    land: 20000,
    tangibleFixedTotal: 37000,
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
    fixedAssetsTotal: 37000,
    deferredAssetsTotal: 0,
    totalAssets: 63500,
    notesPayable: 2000,
    constructionPayable: 6000,
    shortTermBorrowing: 0,
    leaseDebt: 0,
    accountsPayable: 0,
    unpaidExpenses: 0,
    unpaidCorporateTax: 0,
    deferredTaxLiability: 0,
    advanceReceivedConstruction: 4000,
    depositsReceived: 0,
    advanceRevenue: 0,
    provisions: 0,
    unpaidConsumptionTax: 0,
    currentLiabilitiesTotal: 12000,
    longTermBorrowing: 0,
    fixedLiabilitiesTotal: 0,
    totalLiabilities: 12000,
    capitalStock: 10000,
    legalReserve: 0,
    otherRetainedEarnings: 0,
    specialReserve: 0,
    retainedEarningsCF: 41500,
    retainedEarningsTotal: 41500,
    treasuryStock: 0,
    shareholdersEquityTotal: 51500,
    securitiesValuation: 0,
    evaluationTotal: 0,
    totalEquity: 51500,
    totalLiabilitiesEquity: 63500,
  };
  return { ...defaults, ...overrides };
}

describe('buildPrevPeriodSnapshot', () => {
  it('should extract correct values from KeishinBS', () => {
    const bs = makeBs();
    const operatingCF = 12000;

    const snapshot = buildPrevPeriodSnapshot(bs, operatingCF);

    expect(snapshot).toEqual<PrevPeriodSnapshot>({
      totalCapital: 63500,
      operatingCF: 12000,
      allowanceDoubtful: 500, // abs(-500)
      notesAndReceivable: 13000, // 5000 + 8000
      constructionPayable: 6000,
      inventoryAndMaterials: 4000, // 3000 + 1000
      advanceReceived: 4000,
    });
  });

  it('should handle zero allowanceDoubtful', () => {
    const bs = makeBs({ allowanceDoubtful: 0 });
    const snapshot = buildPrevPeriodSnapshot(bs, 0);
    expect(snapshot.allowanceDoubtful).toBe(0);
  });

  it('should handle positive allowanceDoubtful (already absolute)', () => {
    const bs = makeBs({ allowanceDoubtful: 300 });
    const snapshot = buildPrevPeriodSnapshot(bs, 5000);
    expect(snapshot.allowanceDoubtful).toBe(300);
  });

  it('should handle negative operatingCF', () => {
    const bs = makeBs();
    const snapshot = buildPrevPeriodSnapshot(bs, -5000);
    expect(snapshot.operatingCF).toBe(-5000);
  });

  it('should sum notes and accounts receivable correctly', () => {
    const bs = makeBs({
      notesReceivable: 12345,
      accountsReceivableConstruction: 67890,
    });
    const snapshot = buildPrevPeriodSnapshot(bs, 0);
    expect(snapshot.notesAndReceivable).toBe(80235);
  });

  it('should sum inventory and materials correctly', () => {
    const bs = makeBs({
      wipConstruction: 7777,
      materialInventory: 3333,
    });
    const snapshot = buildPrevPeriodSnapshot(bs, 0);
    expect(snapshot.inventoryAndMaterials).toBe(11110);
  });
});
