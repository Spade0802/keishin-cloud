import { describe, expect, it } from 'vitest';
import { enrichFinancialData, enrichKeishinData } from '../data-enrichment';
import type { RawFinancialData } from '../engine/types';

// ---------------------------------------------------------------------------
// enrichFinancialData
// ---------------------------------------------------------------------------
describe('enrichFinancialData', () => {
  it('空データ → 何も補完されない', () => {
    const result = enrichFinancialData({});
    expect(result.enrichedFields).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('BS内訳から合計を補完する', () => {
    const data: Partial<RawFinancialData> = {
      bs: {
        currentAssets: { cash: 1000, receivables: 2000 },
        tangibleFixed: { buildings: 500 },
        intangibleFixed: {},
        investments: {},
        currentLiabilities: { payables: 800 },
        fixedLiabilities: { longTermDebt: 200 },
        equity: { capital: 1000, retainedEarnings: 1500 },
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
    };

    const result = enrichFinancialData(data);
    expect(result.data.bs!.totals!.currentAssets).toBe(3000);
    expect(result.data.bs!.totals!.tangibleFixed).toBe(500);
    expect(result.data.bs!.totals!.currentLiabilities).toBe(800);
    expect(result.data.bs!.totals!.fixedLiabilities).toBe(200);
    expect(result.data.bs!.totals!.totalLiabilities).toBe(1000);
    expect(result.data.bs!.totals!.totalEquity).toBe(2500);
    expect(result.enrichedFields.length).toBeGreaterThan(0);
  });

  it('既存の合計値は上書きしない', () => {
    const data: Partial<RawFinancialData> = {
      bs: {
        currentAssets: { cash: 1000 },
        tangibleFixed: {},
        intangibleFixed: {},
        investments: {},
        currentLiabilities: {},
        fixedLiabilities: {},
        equity: {},
        totals: {
          currentAssets: 9999, // 既存の値
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
    };

    const result = enrichFinancialData(data);
    expect(result.data.bs!.totals!.currentAssets).toBe(9999);
  });

  it('BS均衡不一致の警告を出す', () => {
    const data: Partial<RawFinancialData> = {
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
          totalAssets: 10000,
          currentLiabilities: 0,
          fixedLiabilities: 0,
          totalLiabilities: 4000,
          totalEquity: 3000, // 4000 + 3000 = 7000 != 10000
        },
      },
    };

    const result = enrichFinancialData(data);
    expect(result.warnings.some((w) => w.includes('BS均衡不一致'))).toBe(true);
  });

  it('PL: totalSales を completedConstruction + progressConstruction から補完', () => {
    const data: Partial<RawFinancialData> = {
      pl: {
        completedConstruction: 50000,
        progressConstruction: 10000,
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
      } as RawFinancialData['pl'],
    };

    const result = enrichFinancialData(data);
    expect(result.data.pl!.totalSales).toBe(60000);
    expect(result.enrichedFields).toContain('pl.totalSales');
  });

  it('PL: grossProfit を totalSales - costOfSales から補完', () => {
    const data: Partial<RawFinancialData> = {
      pl: {
        completedConstruction: 0,
        progressConstruction: 0,
        totalSales: 100000,
        costOfSales: 70000,
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
      } as RawFinancialData['pl'],
    };

    const result = enrichFinancialData(data);
    expect(result.data.pl!.grossProfit).toBe(30000);
    expect(result.enrichedFields).toContain('pl.grossProfit');
  });

  it('製造原価: totalCost を材料+労務+外注+経費から補完', () => {
    const data: Partial<RawFinancialData> = {
      manufacturing: {
        materials: 10000,
        labor: 20000,
        subcontract: 15000,
        expenses: 5000,
        totalCost: 0,
      } as RawFinancialData['manufacturing'],
    };

    const result = enrichFinancialData(data);
    expect(result.data.manufacturing!.totalCost).toBe(50000);
    expect(result.enrichedFields).toContain('manufacturing.totalCost');
  });

  it('元データを変更しない（deep clone）', () => {
    const data: Partial<RawFinancialData> = {
      pl: {
        completedConstruction: 50000,
        progressConstruction: 10000,
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
      } as RawFinancialData['pl'],
    };

    enrichFinancialData(data);
    // 元データの totalSales は 0 のまま
    expect(data.pl!.totalSales).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// enrichKeishinData
// ---------------------------------------------------------------------------
describe('enrichKeishinData', () => {
  it('正常データ → 警告なし', () => {
    const result = enrichKeishinData({
      industries: [
        {
          name: '土木一式工事',
          code: '01',
          prevCompletion: 100000,
          currCompletion: 120000,
          prevPrimeContract: 80000,
          currPrimeContract: 90000,
        },
      ],
      businessYears: 30,
    });
    expect(result.warnings).toHaveLength(0);
  });

  it('元請完工高 > 完工高 → 警告', () => {
    const result = enrichKeishinData({
      industries: [
        {
          name: '建築一式工事',
          code: '02',
          prevCompletion: 100000,
          currCompletion: 50000,
          prevPrimeContract: 80000,
          currPrimeContract: 60000, // 60000 > 50000
        },
      ],
    });
    expect(result.warnings.some((w) => w.includes('当期元請完工高'))).toBe(true);
  });

  it('営業年数が異常値 → 警告', () => {
    const result = enrichKeishinData({ businessYears: 200 });
    expect(result.warnings.some((w) => w.includes('営業年数'))).toBe(true);
  });

  it('営業年数1桁 + 大規模売上 → OCR桁落ち警告', () => {
    const result = enrichKeishinData({
      businessYears: 5,
      industries: [
        {
          name: '土木一式工事',
          code: '01',
          prevCompletion: 200000,
          currCompletion: 250000,
          prevPrimeContract: 100000,
          currPrimeContract: 120000,
        },
      ],
    });
    expect(result.warnings.some((w) => w.includes('桁落ち'))).toBe(true);
  });

  it('データなし → 警告なし', () => {
    const result = enrichKeishinData({});
    expect(result.warnings).toHaveLength(0);
  });
});
