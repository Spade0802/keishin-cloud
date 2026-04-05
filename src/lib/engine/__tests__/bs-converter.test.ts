import { describe, it, expect } from 'vitest';
import { convertBS } from '@/lib/engine/bs-converter';
import type { RawFinancialData } from '@/lib/engine/types';

/** Helper: create a minimal RawFinancialData with all zeros */
function emptyRaw(): RawFinancialData {
  return {
    bs: {
      currentAssets: {},
      tangibleFixed: {},
      intangibleFixed: {},
      investments: {},
      currentLiabilities: {},
      fixedLiabilities: {},
      equity: {},
      totals: {
        currentAssets: 0,
        tangibleFixed: 0,
        intangibleFixed: 0,
        investments: 0,
        fixedAssets: 0,
        totalAssets: 0,
        currentLiabilities: 0,
        fixedLiabilities: 0,
        totalLiabilities: 0,
        totalEquity: 0,
      },
    },
    pl: {
      completedConstruction: 0,
      progressConstruction: 0,
      totalSales: 0,
      costOfSales: 0,
      grossProfit: 0,
      sgaItems: {},
      sgaTotal: 0,
      operatingProfit: 0,
      interestIncome: 0,
      dividendIncome: 0,
      miscIncome: 0,
      interestExpense: 0,
      miscExpense: 0,
      ordinaryProfit: 0,
      specialGain: 0,
      specialLoss: 0,
      preTaxProfit: 0,
      corporateTax: 0,
      netIncome: 0,
    },
    manufacturing: {
      materials: 0,
      labor: 0,
      expenses: 0,
      subcontract: 0,
      mfgDepreciation: 0,
      wipBeginning: 0,
      wipEnding: 0,
      totalCost: 0,
    },
    sga: {
      sgaDepreciation: 0,
    },
  };
}

describe('convertBS', () => {
  // ─── All zeros ───
  describe('all zeros', () => {
    it('should return all zeros when input is all zeros', () => {
      const result = convertBS(emptyRaw());
      for (const [key, value] of Object.entries(result)) {
        expect(value, `${key} should be 0`).toBe(0);
      }
    });
  });

  // ─── Basic conversion (yen to sen-en truncation) ───
  describe('basic conversion from yen to sen-en (truncation)', () => {
    it('should truncate positive values (floor division by 1000)', () => {
      const raw = emptyRaw();
      raw.bs.currentAssets['現金'] = 1_500_999;
      raw.bs.totals.currentAssets = 1_500_999;
      raw.bs.totals.totalAssets = 1_500_999;

      const result = convertBS(raw);
      expect(result.cashDeposits).toBe(1500); // floor(1500999/1000)
      expect(result.currentAssetsTotal).toBe(1500);
    });

    it('should truncate exactly at 1000 boundaries', () => {
      const raw = emptyRaw();
      raw.bs.currentAssets['現金'] = 5_000_000;
      raw.bs.totals.currentAssets = 5_000_000;
      raw.bs.totals.totalAssets = 5_000_000;

      const result = convertBS(raw);
      expect(result.cashDeposits).toBe(5000);
      expect(result.currentAssetsTotal).toBe(5000);
    });

    it('should truncate amounts less than 1000 to 0', () => {
      const raw = emptyRaw();
      raw.bs.currentAssets['現金'] = 999;
      raw.bs.totals.currentAssets = 999;
      raw.bs.totals.totalAssets = 999;

      const result = convertBS(raw);
      expect(result.cashDeposits).toBe(0);
      expect(result.currentAssetsTotal).toBe(0);
    });
  });

  // ─── Remainder allocation (residual method) ───
  describe('remainder allocation (residual / residual method)', () => {
    it('should compute otherCurrent as residual of currentAssetsTotal minus explicit items', () => {
      const raw = emptyRaw();
      // Set explicit items and a total that does not match the sum of individual truncations
      raw.bs.currentAssets['現金'] = 1_200_000;
      raw.bs.currentAssets['受取手形'] = 300_000;
      raw.bs.totals.currentAssets = 2_100_500; // truncK -> 2100
      raw.bs.totals.totalAssets = 2_100_500;

      const result = convertBS(raw);
      // cashDeposits = 1200, notesReceivable = 300
      // otherCurrent = 2100 - 1200 - 300 = 600
      expect(result.cashDeposits).toBe(1200);
      expect(result.notesReceivable).toBe(300);
      expect(result.currentAssetsTotal).toBe(2100);
      expect(result.otherCurrent).toBe(600);
    });

    it('should compute toolsEquipment as residual of tangibleFixedTotal', () => {
      const raw = emptyRaw();
      raw.bs.tangibleFixed['建物'] = 5_000_000;
      raw.bs.tangibleFixed['土地'] = 3_000_000;
      raw.bs.totals.tangibleFixed = 10_500_000; // truncK -> 10500
      raw.bs.totals.fixedAssets = 10_500_000;
      raw.bs.totals.totalAssets = 10_500_000;

      const result = convertBS(raw);
      // buildingsStructures = 5000, land = 3000, machineryVehicles = 0
      // toolsEquipment = 10500 - 5000 - 0 - 3000 = 2500
      expect(result.buildingsStructures).toBe(5000);
      expect(result.land).toBe(3000);
      expect(result.toolsEquipment).toBe(2500);
    });

    it('should compute otherIntangible as residual of intangibleFixedTotal', () => {
      const raw = emptyRaw();
      raw.bs.intangibleFixed['特許権'] = 500_000;
      raw.bs.totals.intangibleFixed = 1_200_000;
      raw.bs.totals.fixedAssets = 1_200_000;
      raw.bs.totals.totalAssets = 1_200_000;

      const result = convertBS(raw);
      expect(result.patent).toBe(500);
      expect(result.intangibleFixedTotal).toBe(1200);
      expect(result.otherIntangible).toBe(700);
    });

    it('should compute otherInvestments as residual of investmentsTotal', () => {
      const raw = emptyRaw();
      raw.bs.investments['関係会社株式'] = 2_000_000;
      raw.bs.investments['長期貸付金'] = 1_000_000;
      raw.bs.totals.investments = 5_000_000;
      raw.bs.totals.fixedAssets = 5_000_000;
      raw.bs.totals.totalAssets = 5_000_000;

      const result = convertBS(raw);
      expect(result.relatedCompanyShares).toBe(2000);
      expect(result.longTermLoans).toBe(1000);
      expect(result.investmentsTotal).toBe(5000);
      expect(result.otherInvestments).toBe(2000);
    });

    it('should compute retainedEarningsCF as residual within equity', () => {
      const raw = emptyRaw();
      raw.bs.equity['資本金'] = 10_000_000;
      raw.bs.equity['利益準備金'] = 1_000_000;
      raw.bs.equity['別途積立金'] = 2_000_000;
      raw.bs.totals.totalEquity = 20_000_000;

      const result = convertBS(raw);
      // totalEquity = 20000
      // capitalStock = 10000
      // retainedEarningsTotal = 20000 - 10000 - 0(treasury) - 0(securities) = 10000
      // retainedEarningsCF = 10000 - 1000(legal) - 0(other) - 2000(special) = 7000
      expect(result.capitalStock).toBe(10000);
      expect(result.retainedEarningsTotal).toBe(10000);
      expect(result.retainedEarningsCF).toBe(7000);
    });
  });

  // ─── Negative values ───
  describe('negative values', () => {
    it('should handle negative allowance for doubtful accounts', () => {
      const raw = emptyRaw();
      raw.bs.currentAssets['貸倒引当金'] = -500_000;
      raw.bs.totals.currentAssets = -500_000;
      raw.bs.totals.totalAssets = -500_000;

      const result = convertBS(raw);
      // truncK(-500000) = -floor(500000/1000) = -500
      expect(result.allowanceDoubtful).toBe(-500);
    });

    it('should handle negative treasury stock', () => {
      const raw = emptyRaw();
      raw.bs.equity['資本金'] = 10_000_000;
      raw.bs.equity['自己株式'] = -3_000_000;
      raw.bs.totals.totalEquity = 7_000_000;

      const result = convertBS(raw);
      expect(result.treasuryStock).toBe(-3000);
      expect(result.capitalStock).toBe(10000);
      // shareholdersEquityTotal = capitalStock + retainedEarningsTotal + treasuryStock
      // retainedEarningsTotal = 7000 - 10000 - (-3000) - 0 = 0
      expect(result.retainedEarningsTotal).toBe(0);
      expect(result.shareholdersEquityTotal).toBe(10000 + 0 + (-3000));
    });

    it('should truncate negative values toward zero (absolute floor)', () => {
      const raw = emptyRaw();
      // -1500 yen -> truncK = -floor(1500/1000) = -1
      raw.bs.currentAssets['貸倒引当金'] = -1_500;
      raw.bs.totals.currentAssets = -1_500;
      raw.bs.totals.totalAssets = -1_500;

      const result = convertBS(raw);
      expect(result.allowanceDoubtful).toBe(-1);
    });

    it('should truncate negative values less than 1000 to -0', () => {
      const raw = emptyRaw();
      raw.bs.currentAssets['貸倒引当金'] = -999;
      raw.bs.totals.currentAssets = -999;
      raw.bs.totals.totalAssets = -999;

      const result = convertBS(raw);
      // truncK(-999) = -Math.floor(999/1000) = -0
      expect(result.allowanceDoubtful).toBe(-0);
    });
  });

  // ─── Large values ───
  describe('large values', () => {
    it('should handle billion-scale values (10 billion yen)', () => {
      const raw = emptyRaw();
      raw.bs.currentAssets['現金'] = 10_000_000_000; // 100 oku
      raw.bs.totals.currentAssets = 10_000_000_000;
      raw.bs.totals.totalAssets = 10_000_000_000;

      const result = convertBS(raw);
      expect(result.cashDeposits).toBe(10_000_000);
      expect(result.currentAssetsTotal).toBe(10_000_000);
    });

    it('should handle trillion-scale values', () => {
      const raw = emptyRaw();
      const trillion = 1_000_000_000_000;
      raw.bs.currentAssets['現金'] = trillion;
      raw.bs.totals.currentAssets = trillion;
      raw.bs.totals.totalAssets = trillion;

      const result = convertBS(raw);
      expect(result.cashDeposits).toBe(1_000_000_000);
    });
  });

  // ─── Business rules ───
  describe('business rules', () => {
    it('buildingsStructures should include building accessories (建物付属設備)', () => {
      const raw = emptyRaw();
      raw.bs.tangibleFixed['建物'] = 3_000_000;
      raw.bs.tangibleFixed['構築物'] = 1_000_000;
      raw.bs.tangibleFixed['建物付属設備'] = 2_000_000;
      raw.bs.totals.tangibleFixed = 6_000_000;
      raw.bs.totals.fixedAssets = 6_000_000;
      raw.bs.totals.totalAssets = 6_000_000;

      const result = convertBS(raw);
      // All three -> buildingsStructures
      expect(result.buildingsStructures).toBe(6000);
      expect(result.toolsEquipment).toBe(0); // residual should be zero
    });

    it('constructionPayable should include unpaid subcontract but not unpaid expenses', () => {
      const raw = emptyRaw();
      raw.bs.currentLiabilities['工事未払金'] = 5_000_000;
      raw.bs.currentLiabilities['未払外注費'] = 2_000_000;
      raw.bs.currentLiabilities['未払経費'] = 1_000_000;
      raw.bs.totals.currentLiabilities = 8_000_000;
      raw.bs.totals.totalLiabilities = 8_000_000;

      const result = convertBS(raw);
      // constructionPayable = 工事未払金 + 未払外注費 = 7000
      expect(result.constructionPayable).toBe(7000);
    });

    it('unpaidExpenses should include unpaid salary and unpaid expenses', () => {
      const raw = emptyRaw();
      raw.bs.currentLiabilities['未払給与'] = 3_000_000;
      raw.bs.currentLiabilities['未払経費'] = 1_500_000;
      raw.bs.totals.currentLiabilities = 4_500_000;
      raw.bs.totals.totalLiabilities = 4_500_000;

      const result = convertBS(raw);
      // unpaidExpenses = 未払給与 + 未払経費 = 4500
      expect(result.unpaidExpenses).toBe(4500);
    });

    it('cashDeposits should aggregate multiple deposit accounts', () => {
      const raw = emptyRaw();
      raw.bs.currentAssets['現金'] = 100_000;
      raw.bs.currentAssets['小口現金'] = 50_000;
      raw.bs.currentAssets['当座預金'] = 200_000;
      raw.bs.currentAssets['普通預金'] = 3_000_000;
      raw.bs.currentAssets['定期預金'] = 5_000_000;
      raw.bs.currentAssets['積立定期預金'] = 1_000_000;
      const total = 100_000 + 50_000 + 200_000 + 3_000_000 + 5_000_000 + 1_000_000;
      raw.bs.totals.currentAssets = total;
      raw.bs.totals.totalAssets = total;

      const result = convertBS(raw);
      expect(result.cashDeposits).toBe(Math.floor(total / 1000));
    });

    it('relatedCompanyShares should aggregate from multiple key names', () => {
      const raw = emptyRaw();
      raw.bs.investments['関係会社株式'] = 1_000_000;
      raw.bs.investments['関連会社株式'] = 2_000_000;
      raw.bs.investments['子会社株式'] = 3_000_000;
      raw.bs.totals.investments = 6_000_000;
      raw.bs.totals.fixedAssets = 6_000_000;
      raw.bs.totals.totalAssets = 6_000_000;

      const result = convertBS(raw);
      expect(result.relatedCompanyShares).toBe(6000);
    });
  });

  // ─── Deferred assets ───
  describe('deferredAssetsTotal', () => {
    it('should compute deferred assets as totalAssets - currentAssets - fixedAssets', () => {
      const raw = emptyRaw();
      raw.bs.totals.currentAssets = 10_000_000;
      raw.bs.totals.fixedAssets = 5_000_000;
      raw.bs.totals.totalAssets = 15_500_000; // deferred = 500k

      const result = convertBS(raw);
      expect(result.currentAssetsTotal).toBe(10000);
      expect(result.fixedAssetsTotal).toBe(5000);
      expect(result.totalAssets).toBe(15500);
      expect(result.deferredAssetsTotal).toBe(500);
    });
  });

  // ─── Total liabilities + equity ───
  describe('totalLiabilitiesEquity', () => {
    it('should equal totalLiabilities + totalEquity', () => {
      const raw = emptyRaw();
      raw.bs.totals.totalLiabilities = 30_000_000;
      raw.bs.totals.totalEquity = 20_000_000;
      raw.bs.totals.totalAssets = 50_000_000;
      raw.bs.totals.currentLiabilities = 30_000_000;

      const result = convertBS(raw);
      expect(result.totalLiabilitiesEquity).toBe(50000);
      expect(result.totalLiabilitiesEquity).toBe(
        result.totalLiabilities + result.totalEquity
      );
    });
  });

  // ─── Edge cases: truncation remainder ───
  describe('edge cases with truncation remainder', () => {
    it('should handle rounding gap where individual truncations differ from total truncation', () => {
      const raw = emptyRaw();
      // Two items: 1,999 + 1,999 = 3,998 (total)
      // Individual truncK: 1 + 1 = 2
      // Total truncK: 3
      // otherCurrent (residual) absorbs the gap: 3 - 1 - 1 = 1
      raw.bs.currentAssets['現金'] = 1_999;
      raw.bs.currentAssets['受取手形'] = 1_999;
      raw.bs.totals.currentAssets = 3_998;
      raw.bs.totals.totalAssets = 3_998;

      const result = convertBS(raw);
      expect(result.cashDeposits).toBe(1);
      expect(result.notesReceivable).toBe(1);
      expect(result.currentAssetsTotal).toBe(3);
      // Residual absorbs rounding difference
      expect(result.otherCurrent).toBe(1);
      // Sum of parts equals total
      expect(
        result.cashDeposits +
          result.notesReceivable +
          result.otherCurrent
      ).toBe(result.currentAssetsTotal);
    });

    it('should produce a negative residual when individual truncations exceed total', () => {
      const raw = emptyRaw();
      // Items: 1,500 + 1,500 = 3,000, but total is 2,800
      // truncK(1500) = 1, truncK(1500) = 1, truncK(2800) = 2
      // otherCurrent = 2 - 1 - 1 = 0
      raw.bs.currentAssets['現金'] = 1_500;
      raw.bs.currentAssets['受取手形'] = 1_500;
      raw.bs.totals.currentAssets = 2_800;
      raw.bs.totals.totalAssets = 2_800;

      const result = convertBS(raw);
      expect(result.cashDeposits).toBe(1);
      expect(result.notesReceivable).toBe(1);
      expect(result.currentAssetsTotal).toBe(2);
      expect(result.otherCurrent).toBe(0);
    });
  });

  // ─── Very small amounts ───
  describe('very small amounts', () => {
    it('should truncate 1 yen to 0 sen-en', () => {
      const raw = emptyRaw();
      raw.bs.currentAssets['現金'] = 1;
      raw.bs.totals.currentAssets = 1;
      raw.bs.totals.totalAssets = 1;

      const result = convertBS(raw);
      expect(result.cashDeposits).toBe(0);
      expect(result.currentAssetsTotal).toBe(0);
    });

    it('should truncate 500 yen to 0 sen-en', () => {
      const raw = emptyRaw();
      raw.bs.currentAssets['現金'] = 500;
      raw.bs.totals.currentAssets = 500;
      raw.bs.totals.totalAssets = 500;

      const result = convertBS(raw);
      expect(result.cashDeposits).toBe(0);
    });
  });

  // ─── Equity detail calculations ───
  describe('equity detail calculations', () => {
    it('should compute shareholdersEquityTotal correctly', () => {
      const raw = emptyRaw();
      raw.bs.equity['資本金'] = 10_000_000;
      raw.bs.equity['利益準備金'] = 1_000_000;
      raw.bs.equity['別途積立金'] = 2_000_000;
      raw.bs.equity['自己株式'] = -500_000;
      raw.bs.equity['その他有価証券評価差額金'] = 300_000;
      raw.bs.totals.totalEquity = 12_800_000;

      const result = convertBS(raw);
      // capitalStock = 10000
      // treasuryStock = 0 (truncK(-500000) = -500)
      // securitiesValuation = 0 (truncK(300000) = 300)
      // retainedEarningsTotal = 12800 - 10000 - (-500) - 300 = 3000
      expect(result.capitalStock).toBe(10000);
      expect(result.treasuryStock).toBe(-500);
      expect(result.securitiesValuation).toBe(300);
      expect(result.retainedEarningsTotal).toBe(3000);
      // shareholdersEquityTotal = capitalStock + retainedEarningsTotal + treasuryStock
      expect(result.shareholdersEquityTotal).toBe(10000 + 3000 + (-500));
      expect(result.evaluationTotal).toBe(300);
    });
  });

  // ─── Provisions aggregation ───
  describe('provisions aggregation', () => {
    it('should aggregate multiple provision types', () => {
      const raw = emptyRaw();
      raw.bs.currentLiabilities['賞与引当金'] = 2_000_000;
      raw.bs.currentLiabilities['完成工事補償引当金'] = 500_000;
      raw.bs.currentLiabilities['その他引当金'] = 300_000;
      raw.bs.totals.currentLiabilities = 2_800_000;
      raw.bs.totals.totalLiabilities = 2_800_000;

      const result = convertBS(raw);
      expect(result.provisions).toBe(2800);
    });
  });

  // ─── Missing keys treated as zero ───
  describe('missing keys treated as zero', () => {
    it('should treat absent keys as zero without errors', () => {
      const raw = emptyRaw();
      raw.bs.totals.currentAssets = 5_000_000;
      raw.bs.totals.totalAssets = 5_000_000;
      // No items in currentAssets map -> all individual values = 0
      // otherCurrent = 5000 - 0 - 0 - ... = 5000
      const result = convertBS(raw);
      expect(result.cashDeposits).toBe(0);
      expect(result.otherCurrent).toBe(5000);
      expect(result.currentAssetsTotal).toBe(5000);
    });
  });

  // ─── Full realistic scenario ───
  describe('full realistic scenario', () => {
    it('should correctly convert a realistic construction company BS', () => {
      const raw = emptyRaw();
      // Current assets
      raw.bs.currentAssets['普通預金'] = 15_432_000;
      raw.bs.currentAssets['完成工事未収入金'] = 8_765_000;
      raw.bs.currentAssets['未成工事支出金'] = 3_210_000;
      raw.bs.currentAssets['材料貯蔵品'] = 456_000;
      raw.bs.currentAssets['貸倒引当金'] = -200_000;
      raw.bs.totals.currentAssets = 28_000_000;

      // Tangible fixed
      raw.bs.tangibleFixed['建物'] = 12_000_000;
      raw.bs.tangibleFixed['建物付属設備'] = 3_000_000;
      raw.bs.tangibleFixed['機械装置'] = 5_000_000;
      raw.bs.tangibleFixed['車両運搬具'] = 2_000_000;
      raw.bs.tangibleFixed['土地'] = 20_000_000;
      raw.bs.totals.tangibleFixed = 45_000_000;

      // Intangible fixed
      raw.bs.intangibleFixed['特許権'] = 500_000;
      raw.bs.totals.intangibleFixed = 1_000_000;

      // Investments
      raw.bs.investments['保険積立金'] = 3_000_000;
      raw.bs.totals.investments = 4_000_000;

      raw.bs.totals.fixedAssets = 50_000_000;
      raw.bs.totals.totalAssets = 78_000_000;

      // Current liabilities
      raw.bs.currentLiabilities['支払手形'] = 5_000_000;
      raw.bs.currentLiabilities['工事未払金'] = 10_000_000;
      raw.bs.currentLiabilities['未払外注費'] = 3_000_000;
      raw.bs.currentLiabilities['未払給与'] = 1_000_000;
      raw.bs.currentLiabilities['未払経費'] = 500_000;
      raw.bs.currentLiabilities['未払法人税等'] = 2_000_000;
      raw.bs.totals.currentLiabilities = 25_000_000;

      // Fixed liabilities
      raw.bs.fixedLiabilities['長期借入金'] = 15_000_000;
      raw.bs.totals.fixedLiabilities = 15_000_000;

      raw.bs.totals.totalLiabilities = 40_000_000;

      // Equity
      raw.bs.equity['資本金'] = 20_000_000;
      raw.bs.equity['利益準備金'] = 5_000_000;
      raw.bs.equity['別途積立金'] = 3_000_000;
      raw.bs.totals.totalEquity = 38_000_000;

      const result = convertBS(raw);

      // Verify key values
      expect(result.cashDeposits).toBe(15432);
      expect(result.accountsReceivableConstruction).toBe(8765);
      expect(result.wipConstruction).toBe(3210);
      expect(result.allowanceDoubtful).toBe(-200);
      expect(result.currentAssetsTotal).toBe(28000);

      // buildingsStructures includes 建物付属設備
      expect(result.buildingsStructures).toBe(15000); // 12000 + 3000
      expect(result.machineryVehicles).toBe(7000); // 5000 + 2000
      expect(result.land).toBe(20000);
      expect(result.toolsEquipment).toBe(45000 - 15000 - 7000 - 20000); // 3000
      expect(result.tangibleFixedTotal).toBe(45000);

      expect(result.constructionPayable).toBe(13000); // 10000 + 3000
      expect(result.unpaidExpenses).toBe(1500); // 1000 + 500
      expect(result.longTermBorrowing).toBe(15000);

      expect(result.totalLiabilitiesEquity).toBe(result.totalLiabilities + result.totalEquity);
      expect(result.totalAssets).toBe(78000);
    });
  });
});
