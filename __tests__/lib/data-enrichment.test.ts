/**
 * データ補完（Data Enrichment）のテスト
 */
import { describe, it, expect } from 'vitest';
import { enrichFinancialData, enrichKeishinData } from '@/lib/data-enrichment';

describe('enrichFinancialData', () => {
  it('BS合計をセクション内訳から計算する', () => {
    const result = enrichFinancialData({
      bs: {
        currentAssets: { '現金': 5000, '売掛金': 3000 },
        tangibleFixed: { '建物': 10000, '機械': 5000 },
        intangibleFixed: { 'ソフトウェア': 1000 },
        investments: { '投資有価証券': 2000 },
        currentLiabilities: { '買掛金': 4000, '短期借入金': 2000 },
        fixedLiabilities: { '長期借入金': 8000 },
        equity: { '資本金': 5000, '利益剰余金': 7000 },
        totals: {
          currentAssets: 0, tangibleFixed: 0, intangibleFixed: 0,
          investments: 0, fixedAssets: 0, totalAssets: 0,
          currentLiabilities: 0, fixedLiabilities: 0,
          totalLiabilities: 0, totalEquity: 0,
        },
      },
    });

    expect(result.data.bs?.totals?.currentAssets).toBe(8000);
    expect(result.data.bs?.totals?.tangibleFixed).toBe(15000);
    expect(result.data.bs?.totals?.intangibleFixed).toBe(1000);
    expect(result.data.bs?.totals?.investments).toBe(2000);
    expect(result.data.bs?.totals?.fixedAssets).toBe(18000);
    expect(result.data.bs?.totals?.totalAssets).toBe(26000);
    expect(result.data.bs?.totals?.currentLiabilities).toBe(6000);
    expect(result.data.bs?.totals?.fixedLiabilities).toBe(8000);
    expect(result.data.bs?.totals?.totalLiabilities).toBe(14000);
    expect(result.data.bs?.totals?.totalEquity).toBe(12000);
    expect(result.enrichedFields.length).toBeGreaterThan(0);
  });

  it('既に値がある合計は上書きしない', () => {
    const result = enrichFinancialData({
      bs: {
        currentAssets: { '現金': 5000 },
        tangibleFixed: {},
        intangibleFixed: {},
        investments: {},
        currentLiabilities: {},
        fixedLiabilities: {},
        equity: {},
        totals: {
          currentAssets: 9999, // 既存値を保持
          tangibleFixed: 0, intangibleFixed: 0,
          investments: 0, fixedAssets: 0, totalAssets: 0,
          currentLiabilities: 0, fixedLiabilities: 0,
          totalLiabilities: 0, totalEquity: 0,
        },
      },
    });

    expect(result.data.bs?.totals?.currentAssets).toBe(9999);
  });

  it('PL項目を順番に導出する', () => {
    const result = enrichFinancialData({
      pl: {
        completedConstruction: 50000,
        progressConstruction: 10000,
        totalSales: 0, // → 60000
        costOfSales: 40000,
        grossProfit: 0, // → 20000
        sgaItems: { '人件費': 8000, '通信費': 2000 },
        sgaTotal: 0, // → 10000
        operatingProfit: 0, // → 10000
        interestIncome: 100,
        dividendIncome: 50,
        miscIncome: 0,
        interestExpense: 500,
        miscExpense: 0,
        ordinaryProfit: 0, // → 9650
        specialGain: 0,
        specialLoss: 1000,
        preTaxProfit: 0, // → 8650
        corporateTax: 3000,
        netIncome: 0, // → 5650
      },
    });

    expect(result.data.pl?.totalSales).toBe(60000);
    expect(result.data.pl?.grossProfit).toBe(20000);
    expect(result.data.pl?.sgaTotal).toBe(10000);
    expect(result.data.pl?.operatingProfit).toBe(10000);
    expect(result.data.pl?.ordinaryProfit).toBe(9650);
    expect(result.data.pl?.preTaxProfit).toBe(8650);
    expect(result.data.pl?.netIncome).toBe(5650);
  });

  it('製造原価合計を計算する', () => {
    const result = enrichFinancialData({
      manufacturing: {
        materials: 10000,
        labor: 8000,
        subcontract: 15000,
        expenses: 5000,
        mfgDepreciation: 0,
        wipBeginning: 3000,
        wipEnding: 2000,
        totalCost: 0,
      },
    });

    // totalCost = 10000 + 8000 + 15000 + 5000 + 3000 - 2000 = 39000
    expect(result.data.manufacturing?.totalCost).toBe(39000);
  });

  it('BS均衡不一致を警告する', () => {
    const result = enrichFinancialData({
      bs: {
        currentAssets: {},
        tangibleFixed: {},
        intangibleFixed: {},
        investments: {},
        currentLiabilities: {},
        fixedLiabilities: {},
        equity: {},
        totals: {
          currentAssets: 0, tangibleFixed: 0, intangibleFixed: 0,
          investments: 0, fixedAssets: 0,
          totalAssets: 100000,
          currentLiabilities: 0, fixedLiabilities: 0,
          totalLiabilities: 50000,
          totalEquity: 40000, // 不一致: 50000+40000 ≠ 100000
        },
      },
    });

    expect(result.warnings.some(w => w.includes('BS均衡不一致'))).toBe(true);
  });

  it('逆方向の導出: totalAssets を負債+純資産から算出', () => {
    const result = enrichFinancialData({
      bs: {
        currentAssets: {},
        tangibleFixed: {},
        intangibleFixed: {},
        investments: {},
        currentLiabilities: {},
        fixedLiabilities: {},
        equity: {},
        totals: {
          currentAssets: 0, tangibleFixed: 0, intangibleFixed: 0,
          investments: 0, fixedAssets: 0,
          totalAssets: 0,
          currentLiabilities: 0, fixedLiabilities: 0,
          totalLiabilities: 60000,
          totalEquity: 40000,
        },
      },
    });

    expect(result.data.bs?.totals?.totalAssets).toBe(100000);
  });

  it('原価報告書とPLの差異を警告する', () => {
    const result = enrichFinancialData({
      pl: {
        completedConstruction: 0,
        progressConstruction: 0,
        totalSales: 0,
        costOfSales: 30000,
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
        materials: 10000,
        labor: 5000,
        subcontract: 5000,
        expenses: 2000,
        mfgDepreciation: 0,
        wipBeginning: 0,
        wipEnding: 0,
        totalCost: 0, // → 22000 ≠ 30000
      },
    });

    expect(result.warnings.some(w => w.includes('原価報告書合計'))).toBe(true);
  });
});

describe('enrichKeishinData', () => {
  it('元請完工高>完工高の不整合を警告する', () => {
    const result = enrichKeishinData({
      industries: [
        {
          name: '電気', code: '08',
          prevCompletion: 100000, currCompletion: 50000,
          prevPrimeContract: 80000, currPrimeContract: 60000, // 60000 > 50000
        },
      ],
    });

    expect(result.warnings.some(w => w.includes('電気') && w.includes('元請完工高'))).toBe(true);
  });

  it('異常な営業年数を警告する', () => {
    const result = enrichKeishinData({
      businessYears: 200,
    });

    expect(result.warnings.some(w => w.includes('営業年数'))).toBe(true);
  });

  it('正常データは警告なし', () => {
    const result = enrichKeishinData({
      equity: 50000,
      ebitda: 10000,
      businessYears: 35,
      industries: [
        {
          name: '電気', code: '08',
          prevCompletion: 100000, currCompletion: 120000,
          prevPrimeContract: 80000, currPrimeContract: 90000,
        },
      ],
    });

    expect(result.warnings.length).toBe(0);
  });
});
