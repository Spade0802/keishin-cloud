import { describe, it, expect } from 'vitest';
import { convertPL } from '@/lib/engine/pl-converter';
import type { RawFinancialData } from '@/lib/engine/types';

/** Helper: create a minimal RawFinancialData with sensible defaults. */
function makeRaw(overrides: {
  pl?: Partial<RawFinancialData['pl']>;
  manufacturing?: Partial<RawFinancialData['manufacturing']>;
  sga?: Partial<RawFinancialData['sga']>;
} = {}): RawFinancialData {
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
      ...overrides.pl,
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
      ...overrides.manufacturing,
    },
    sga: {
      sgaDepreciation: 0,
      ...overrides.sga,
    },
  };
}

describe('convertPL', () => {
  // ---------------------------------------------------------------
  // Basic P&L conversion
  // ---------------------------------------------------------------
  describe('basic P&L conversion', () => {
    it('converts a typical construction company P&L to千円 (truncated)', () => {
      const raw = makeRaw({
        pl: {
          completedConstruction: 50_000_000,
          progressConstruction: 10_000_000,
          totalSales: 60_000_000,
          costOfSales: 40_000_000,
          sgaItems: { salary: 5_000_000, rent: 2_000_000 },
          interestIncome: 100_000,
          dividendIncome: 50_000,
          miscIncome: 30_000,
          interestExpense: 200_000,
          miscExpense: 80_000,
          specialGain: 500_000,
          specialLoss: 300_000,
          corporateTax: 3_000_000,
        },
        manufacturing: {
          materials: 10_000_000,
          labor: 8_000_000,
          subcontract: 15_000_000,
          expenses: 5_000_000,
          mfgDepreciation: 1_000_000,
          wipBeginning: 2_000_000,
          wipEnding: 1_000_000,
        },
        sga: { sgaDepreciation: 500_000 },
      });

      const result = convertPL(raw);

      expect(result.completedConstructionRevenue).toBe(60_000); // (50M + 10M) / 1000
      expect(result.totalSales).toBe(60_000);
      expect(result.completedConstructionCost).toBe(40_000);
      expect(result.grossProfit).toBe(60_000 - 40_000); // 20,000
      expect(result.sgaTotal).toBe(5_000 + 2_000); // 7,000
      expect(result.operatingProfit).toBe(20_000 - 7_000); // 13,000
    });

    it('computes netIncome correctly through the full chain', () => {
      const raw = makeRaw({
        pl: {
          totalSales: 100_000_000,
          completedConstruction: 80_000_000,
          progressConstruction: 20_000_000,
          costOfSales: 60_000_000,
          sgaItems: { salary: 10_000_000 },
          interestIncome: 500_000,
          dividendIncome: 300_000,
          miscIncome: 200_000,
          interestExpense: 1_000_000,
          miscExpense: 500_000,
          specialGain: 2_000_000,
          specialLoss: 1_000_000,
          corporateTax: 5_000_000,
        },
      });

      const result = convertPL(raw);

      // grossProfit = 100,000 - 60,000 = 40,000
      expect(result.grossProfit).toBe(40_000);
      // operatingProfit = 40,000 - 10,000 = 30,000
      expect(result.operatingProfit).toBe(30_000);
      // nonOpIncomeTotal = 500 + 300 + 200 = 1,000
      expect(result.nonOpIncomeTotal).toBe(1_000);
      // nonOpExpenseTotal = 1,000 + 500 = 1,500
      expect(result.nonOpExpenseTotal).toBe(1_500);
      // ordinaryProfit = 30,000 + 1,000 - 1,500 = 29,500
      expect(result.ordinaryProfit).toBe(29_500);
      // preTaxProfit = 29,500 + 2,000 - 1,000 = 30,500
      expect(result.preTaxProfit).toBe(30_500);
      // netIncome = 30,500 - 5,000 - 0 = 25,500
      expect(result.netIncome).toBe(25_500);
    });
  });

  // ---------------------------------------------------------------
  // Construction revenue/cost handling
  // ---------------------------------------------------------------
  describe('construction revenue and cost handling', () => {
    it('completedConstructionRevenue = completedConstruction + progressConstruction (rule 1)', () => {
      const raw = makeRaw({
        pl: {
          completedConstruction: 30_000_000,
          progressConstruction: 5_000_000,
          totalSales: 40_000_000,
        },
      });

      const result = convertPL(raw);

      // (30M + 5M) / 1000 = 35,000
      expect(result.completedConstructionRevenue).toBe(35_000);
    });

    it('sideBusiness = totalSales - completedConstruction - progressConstruction', () => {
      const raw = makeRaw({
        pl: {
          completedConstruction: 30_000_000,
          progressConstruction: 5_000_000,
          totalSales: 40_000_000,
        },
      });

      const result = convertPL(raw);

      // (40M - 30M - 5M) / 1000 = 5,000
      expect(result.sideBusiness).toBe(5_000);
    });

    it('sideBusiness is 0 when there is no non-construction revenue', () => {
      const raw = makeRaw({
        pl: {
          completedConstruction: 30_000_000,
          progressConstruction: 10_000_000,
          totalSales: 40_000_000,
        },
      });

      const result = convertPL(raw);
      expect(result.sideBusiness).toBe(0);
    });

    it('sideBusinessCost is always 0 (not yet implemented)', () => {
      const raw = makeRaw({
        pl: { costOfSales: 50_000_000 },
      });
      const result = convertPL(raw);
      expect(result.sideBusinessCost).toBe(0);
    });

    it('costReport expenses include WIP adjustment (rule 4)', () => {
      const raw = makeRaw({
        manufacturing: {
          expenses: 3_000_000,
          wipBeginning: 2_000_000,
          wipEnding: 500_000,
        },
      });

      const result = convertPL(raw);

      // expenses = truncK(3M) + truncK(2M) - truncK(500K)
      //          = 3,000 + 2,000 - 500 = 4,500
      expect(result.costReport.expenses).toBe(4_500);
    });

    it('costReport totalCost sums materials + labor + subcontract + expenses', () => {
      const raw = makeRaw({
        manufacturing: {
          materials: 10_000_000,
          labor: 8_000_000,
          subcontract: 15_000_000,
          expenses: 5_000_000,
          wipBeginning: 0,
          wipEnding: 0,
        },
      });

      const result = convertPL(raw);

      // 10,000 + 8,000 + 0(laborSubcontract) + 15,000 + 5,000 = 38,000
      expect(result.costReport.totalCost).toBe(38_000);
      expect(result.costReport.laborSubcontract).toBe(0);
      expect(result.costReport.personnelInExpenses).toBe(0);
    });

    it('depreciation = mfgDepreciation + sgaDepreciation (rule 5)', () => {
      const raw = makeRaw({
        manufacturing: { mfgDepreciation: 1_500_000 },
        sga: { sgaDepreciation: 800_000 },
      });

      const result = convertPL(raw);

      // truncK(1,500,000) + truncK(800,000) = 1,500 + 800 = 2,300
      expect(result.depreciation).toBe(2_300);
    });
  });

  // ---------------------------------------------------------------
  // Interest/dividend merging (rule 2)
  // ---------------------------------------------------------------
  describe('interest and dividend income merging', () => {
    it('interestDividendIncome = truncK(interestIncome + dividendIncome) (rule 2)', () => {
      const raw = makeRaw({
        pl: {
          interestIncome: 123_456,
          dividendIncome: 654_321,
        },
      });

      const result = convertPL(raw);

      // truncK(123,456 + 654,321) = truncK(777,777) = 777
      expect(result.interestDividendIncome).toBe(777);
    });
  });

  // ---------------------------------------------------------------
  // SGA items (rule 3): per-item truncation then sum
  // ---------------------------------------------------------------
  describe('SGA items handling', () => {
    it('truncates each SGA item individually before summing (rule 3)', () => {
      const raw = makeRaw({
        pl: {
          sgaItems: {
            salary: 1_500_999,   // truncK -> 1,500
            rent: 800_999,       // truncK -> 800
            utilities: 200_100,  // truncK -> 200
          },
        },
      });

      const result = convertPL(raw);

      // If summed first then truncated: truncK(2,502,098) = 2,502
      // With per-item truncation: 1,500 + 800 + 200 = 2,500
      expect(result.sgaTotal).toBe(2_500);
    });

    it('handles empty sgaItems', () => {
      const raw = makeRaw({
        pl: { sgaItems: {} },
      });

      const result = convertPL(raw);
      expect(result.sgaTotal).toBe(0);
    });
  });

  // ---------------------------------------------------------------
  // Zero values
  // ---------------------------------------------------------------
  describe('zero values', () => {
    it('returns all zeros when input is entirely zero', () => {
      const raw = makeRaw();
      const result = convertPL(raw);

      expect(result.completedConstructionRevenue).toBe(0);
      expect(result.sideBusiness).toBe(0);
      expect(result.totalSales).toBe(0);
      expect(result.completedConstructionCost).toBe(0);
      expect(result.sideBusinessCost).toBe(0);
      expect(result.grossProfit).toBe(0);
      expect(result.sgaTotal).toBe(0);
      expect(result.operatingProfit).toBe(0);
      expect(result.interestDividendIncome).toBe(0);
      expect(result.otherNonOpIncome).toBe(0);
      expect(result.nonOpIncomeTotal).toBe(0);
      expect(result.interestExpense).toBe(0);
      expect(result.otherNonOpExpense).toBe(0);
      expect(result.nonOpExpenseTotal).toBe(0);
      expect(result.ordinaryProfit).toBe(0);
      expect(result.specialGain).toBe(0);
      expect(result.specialLoss).toBe(0);
      expect(result.preTaxProfit).toBe(0);
      expect(result.corporateTax).toBe(0);
      expect(result.taxAdjustment).toBe(0);
      expect(result.netIncome).toBe(0);
      expect(result.costReport.materials).toBe(0);
      expect(result.costReport.labor).toBe(0);
      expect(result.costReport.laborSubcontract).toBe(0);
      expect(result.costReport.subcontract).toBe(0);
      expect(result.costReport.expenses).toBe(0);
      expect(result.costReport.personnelInExpenses).toBe(0);
      expect(result.costReport.totalCost).toBe(0);
      expect(result.depreciation).toBe(0);
    });

    it('taxAdjustment is always 0 (not yet implemented)', () => {
      const raw = makeRaw({
        pl: {
          totalSales: 100_000_000,
          corporateTax: 10_000_000,
        },
      });
      const result = convertPL(raw);
      expect(result.taxAdjustment).toBe(0);
    });
  });

  // ---------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------
  describe('edge cases', () => {
    it('truncates toward zero for positive values (floors)', () => {
      const raw = makeRaw({
        pl: {
          totalSales: 999_999, // truncK -> 999 (not 1,000)
          completedConstruction: 999_999,
          progressConstruction: 0,
        },
      });

      const result = convertPL(raw);
      expect(result.totalSales).toBe(999);
    });

    it('truncates toward zero for negative values', () => {
      // truncK(-999_999) should be -999, not -1000
      const raw = makeRaw({
        pl: {
          totalSales: 0,
          completedConstruction: 0,
          progressConstruction: 0,
          costOfSales: 0,
          sgaItems: {},
          interestIncome: 0,
          dividendIncome: 0,
          miscIncome: 0,
          interestExpense: 0,
          miscExpense: 0,
          specialGain: 0,
          specialLoss: 999_999, // truncK -> 999
          corporateTax: 0,
        },
      });

      const result = convertPL(raw);
      // preTaxProfit = 0, specialLoss = 999
      // netIncome = 0 + 0 - 999 - 0 - 0 = -999
      expect(result.specialLoss).toBe(999);
      expect(result.netIncome).toBe(-999);
    });

    it('handles negative WIP adjustment (wipEnding > wipBeginning)', () => {
      const raw = makeRaw({
        manufacturing: {
          expenses: 1_000_000,
          wipBeginning: 500_000,
          wipEnding: 2_000_000,
        },
      });

      const result = convertPL(raw);

      // expenses = truncK(1M) + truncK(500K) - truncK(2M) = 1,000 + 500 - 2,000 = -500
      expect(result.costReport.expenses).toBe(-500);
    });

    it('handles sub-thousand values (less than 1000 yen)', () => {
      const raw = makeRaw({
        pl: {
          interestIncome: 500,
          dividendIncome: 400,
        },
      });

      const result = convertPL(raw);
      // truncK(500 + 400) = truncK(900) = 0
      expect(result.interestDividendIncome).toBe(0);
    });

    it('handles values just above 1000', () => {
      const raw = makeRaw({
        pl: {
          interestIncome: 1_001,
          dividendIncome: 0,
        },
      });

      const result = convertPL(raw);
      // truncK(1,001) = 1
      expect(result.interestDividendIncome).toBe(1);
    });

    it('handles large realistic construction company values', () => {
      const raw = makeRaw({
        pl: {
          completedConstruction: 1_234_567_890,
          progressConstruction: 345_678_901,
          totalSales: 1_680_246_791,
          costOfSales: 1_200_000_000,
          sgaItems: {
            salary: 50_000_000,
            rent: 12_000_000,
            depreciation: 8_000_000,
            insurance: 3_500_000,
            communication: 1_200_000,
          },
          interestIncome: 2_345_678,
          dividendIncome: 1_234_567,
          miscIncome: 567_890,
          interestExpense: 15_678_901,
          miscExpense: 2_345_678,
          specialGain: 10_000_000,
          specialLoss: 5_000_000,
          corporateTax: 50_000_000,
        },
        manufacturing: {
          materials: 300_000_000,
          labor: 250_000_000,
          subcontract: 500_000_000,
          expenses: 100_000_000,
          mfgDepreciation: 30_000_000,
          wipBeginning: 50_000_000,
          wipEnding: 40_000_000,
        },
        sga: { sgaDepreciation: 8_000_000 },
      });

      const result = convertPL(raw);

      expect(result.completedConstructionRevenue).toBe(1_580_246);
      expect(result.totalSales).toBe(1_680_246);
      expect(result.sideBusiness).toBe(100_000);
      expect(result.completedConstructionCost).toBe(1_200_000);

      // SGA: 50,000 + 12,000 + 8,000 + 3,500 + 1,200 = 74,700
      expect(result.sgaTotal).toBe(74_700);

      // depreciation: truncK(30M) + truncK(8M) = 30,000 + 8,000 = 38,000
      expect(result.depreciation).toBe(38_000);
    });

    it('handles exactly 1000 yen boundaries', () => {
      const raw = makeRaw({
        pl: {
          completedConstruction: 1_000,
          progressConstruction: 0,
          totalSales: 1_000,
        },
      });

      const result = convertPL(raw);
      expect(result.completedConstructionRevenue).toBe(1);
      expect(result.totalSales).toBe(1);
    });

    it('handles single SGA item correctly', () => {
      const raw = makeRaw({
        pl: {
          totalSales: 10_000_000,
          costOfSales: 5_000_000,
          sgaItems: { onlyItem: 3_456_789 },
        },
      });

      const result = convertPL(raw);
      // truncK(3,456,789) = 3,456
      expect(result.sgaTotal).toBe(3_456);
      // grossProfit = 10,000 - 5,000 = 5,000
      // operatingProfit = 5,000 - 3,456 = 1,544
      expect(result.operatingProfit).toBe(1_544);
    });
  });
});
