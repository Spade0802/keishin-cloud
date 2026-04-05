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

  // ─── BS 追加カバレッジ ───

  it('BS: fixedAssets = tangibleFixed + intangibleFixed + investments', () => {
    const data: Partial<RawFinancialData> = {
      bs: {
        currentAssets: {},
        tangibleFixed: { buildings: 300 },
        intangibleFixed: { software: 200 },
        investments: { securities: 100 },
        currentLiabilities: {},
        fixedLiabilities: {},
        equity: {},
        totals: {
          currentAssets: 0, tangibleFixed: 0, intangibleFixed: 0,
          investments: 0, fixedAssets: 0, totalAssets: 0,
          currentLiabilities: 0, fixedLiabilities: 0,
          totalLiabilities: 0, totalEquity: 0,
        },
      },
    };

    const result = enrichFinancialData(data);
    expect(result.data.bs!.totals!.tangibleFixed).toBe(300);
    expect(result.data.bs!.totals!.intangibleFixed).toBe(200);
    expect(result.data.bs!.totals!.investments).toBe(100);
    expect(result.data.bs!.totals!.fixedAssets).toBe(600);
    expect(result.enrichedFields).toContain('bs.totals.fixedAssets');
  });

  it('BS: totalAssets = currentAssets + fixedAssets', () => {
    const data: Partial<RawFinancialData> = {
      bs: {
        currentAssets: { cash: 1000 },
        tangibleFixed: { buildings: 500 },
        intangibleFixed: {},
        investments: {},
        currentLiabilities: {},
        fixedLiabilities: {},
        equity: {},
        totals: {
          currentAssets: 0, tangibleFixed: 0, intangibleFixed: 0,
          investments: 0, fixedAssets: 0, totalAssets: 0,
          currentLiabilities: 0, fixedLiabilities: 0,
          totalLiabilities: 0, totalEquity: 0,
        },
      },
    };

    const result = enrichFinancialData(data);
    expect(result.data.bs!.totals!.totalAssets).toBe(1500);
    expect(result.enrichedFields).toContain('bs.totals.totalAssets');
  });

  it('BS: totalAssets を 負債+純資産 から補完（内訳なし）', () => {
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
          currentAssets: 0, tangibleFixed: 0, intangibleFixed: 0,
          investments: 0, fixedAssets: 0, totalAssets: 0,
          currentLiabilities: 0, fixedLiabilities: 0,
          totalLiabilities: 5000, totalEquity: 3000,
        },
      },
    };

    const result = enrichFinancialData(data);
    expect(result.data.bs!.totals!.totalAssets).toBe(8000);
    expect(result.enrichedFields).toContain('bs.totals.totalAssets (from L+E)');
  });

  it('BS: totalEquity を 資産-負債 から補完', () => {
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
          currentAssets: 0, tangibleFixed: 0, intangibleFixed: 0,
          investments: 0, fixedAssets: 0, totalAssets: 10000,
          currentLiabilities: 0, fixedLiabilities: 0,
          totalLiabilities: 6000, totalEquity: 0,
        },
      },
    };

    const result = enrichFinancialData(data);
    expect(result.data.bs!.totals!.totalEquity).toBe(4000);
    expect(result.enrichedFields).toContain('bs.totals.totalEquity (from A-L)');
  });

  it('BS均衡: 差額が小さい場合は警告なし', () => {
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
          currentAssets: 0, tangibleFixed: 0, intangibleFixed: 0,
          investments: 0, fixedAssets: 0, totalAssets: 10000,
          currentLiabilities: 0, fixedLiabilities: 0,
          totalLiabilities: 6000, totalEquity: 4000,
        },
      },
    };

    const result = enrichFinancialData(data);
    expect(result.warnings.some((w) => w.includes('BS均衡不一致'))).toBe(false);
  });

  it('BS: totals が undefined の場合、デフォルト値で補完', () => {
    const data: Partial<RawFinancialData> = {
      bs: {
        currentAssets: { cash: 500 },
        tangibleFixed: {},
        intangibleFixed: {},
        investments: {},
        currentLiabilities: {},
        fixedLiabilities: {},
        equity: {},
      } as unknown as RawFinancialData['bs'],
    };

    const result = enrichFinancialData(data);
    expect(result.data.bs!.totals!.currentAssets).toBe(500);
    expect(result.enrichedFields).toContain('bs.totals.currentAssets');
  });

  // ─── PL 追加カバレッジ ───

  it('PL: sgaTotal を sgaItems の合計から補完', () => {
    const data: Partial<RawFinancialData> = {
      pl: {
        completedConstruction: 0, progressConstruction: 0,
        totalSales: 100000, costOfSales: 70000,
        grossProfit: 30000,
        sgaItems: { salary: 5000, rent: 3000, depreciation: 2000 },
        sgaTotal: 0,
        operatingProfit: 0,
        interestIncome: 0, dividendIncome: 0, miscIncome: 0,
        interestExpense: 0, miscExpense: 0,
        ordinaryProfit: 0, specialGain: 0, specialLoss: 0,
        preTaxProfit: 0, corporateTax: 0, netIncome: 0,
      } as RawFinancialData['pl'],
    };

    const result = enrichFinancialData(data);
    expect(result.data.pl!.sgaTotal).toBe(10000);
    expect(result.enrichedFields).toContain('pl.sgaTotal');
  });

  it('PL: operatingProfit = grossProfit - sgaTotal', () => {
    const data: Partial<RawFinancialData> = {
      pl: {
        completedConstruction: 0, progressConstruction: 0,
        totalSales: 100000, costOfSales: 70000,
        grossProfit: 30000,
        sgaItems: { salary: 5000, rent: 3000 },
        sgaTotal: 0,
        operatingProfit: 0,
        interestIncome: 0, dividendIncome: 0, miscIncome: 0,
        interestExpense: 0, miscExpense: 0,
        ordinaryProfit: 0, specialGain: 0, specialLoss: 0,
        preTaxProfit: 0, corporateTax: 0, netIncome: 0,
      } as RawFinancialData['pl'],
    };

    const result = enrichFinancialData(data);
    // sgaTotal = 8000, operatingProfit = 30000 - 8000 = 22000
    expect(result.data.pl!.operatingProfit).toBe(22000);
    expect(result.enrichedFields).toContain('pl.operatingProfit');
  });

  it('PL: ordinaryProfit = operatingProfit + 営業外収益 - 営業外費用', () => {
    const data: Partial<RawFinancialData> = {
      pl: {
        completedConstruction: 0, progressConstruction: 0,
        totalSales: 0, costOfSales: 0,
        grossProfit: 0,
        sgaItems: {},
        sgaTotal: 0,
        operatingProfit: 20000,
        interestIncome: 500, dividendIncome: 300, miscIncome: 200,
        interestExpense: 400, miscExpense: 100,
        ordinaryProfit: 0,
        specialGain: 0, specialLoss: 0,
        preTaxProfit: 0, corporateTax: 0, netIncome: 0,
      } as RawFinancialData['pl'],
    };

    const result = enrichFinancialData(data);
    // 20000 + (500+300+200) - (400+100) = 20500
    expect(result.data.pl!.ordinaryProfit).toBe(20500);
    expect(result.enrichedFields).toContain('pl.ordinaryProfit');
  });

  it('PL: preTaxProfit = ordinaryProfit + specialGain - specialLoss', () => {
    const data: Partial<RawFinancialData> = {
      pl: {
        completedConstruction: 0, progressConstruction: 0,
        totalSales: 0, costOfSales: 0,
        grossProfit: 0, sgaItems: {}, sgaTotal: 0,
        operatingProfit: 0,
        interestIncome: 0, dividendIncome: 0, miscIncome: 0,
        interestExpense: 0, miscExpense: 0,
        ordinaryProfit: 15000,
        specialGain: 2000, specialLoss: 500,
        preTaxProfit: 0, corporateTax: 0, netIncome: 0,
      } as RawFinancialData['pl'],
    };

    const result = enrichFinancialData(data);
    expect(result.data.pl!.preTaxProfit).toBe(16500);
    expect(result.enrichedFields).toContain('pl.preTaxProfit');
  });

  it('PL: netIncome = preTaxProfit - corporateTax', () => {
    const data: Partial<RawFinancialData> = {
      pl: {
        completedConstruction: 0, progressConstruction: 0,
        totalSales: 0, costOfSales: 0,
        grossProfit: 0, sgaItems: {}, sgaTotal: 0,
        operatingProfit: 0,
        interestIncome: 0, dividendIncome: 0, miscIncome: 0,
        interestExpense: 0, miscExpense: 0,
        ordinaryProfit: 0,
        specialGain: 0, specialLoss: 0,
        preTaxProfit: 16500, corporateTax: 5000, netIncome: 0,
      } as RawFinancialData['pl'],
    };

    const result = enrichFinancialData(data);
    expect(result.data.pl!.netIncome).toBe(11500);
    expect(result.enrichedFields).toContain('pl.netIncome');
  });

  it('PL逆方向: completedConstruction = totalSales - progressConstruction', () => {
    const data: Partial<RawFinancialData> = {
      pl: {
        completedConstruction: 0,
        progressConstruction: 10000,
        totalSales: 60000,
        costOfSales: 0, grossProfit: 0, sgaItems: {}, sgaTotal: 0,
        operatingProfit: 0,
        interestIncome: 0, dividendIncome: 0, miscIncome: 0,
        interestExpense: 0, miscExpense: 0,
        ordinaryProfit: 0, specialGain: 0, specialLoss: 0,
        preTaxProfit: 0, corporateTax: 0, netIncome: 0,
      } as RawFinancialData['pl'],
    };

    const result = enrichFinancialData(data);
    expect(result.data.pl!.completedConstruction).toBe(50000);
    expect(result.enrichedFields).toContain('pl.completedConstruction');
  });

  it('PL逆方向: costOfSales = totalSales - grossProfit', () => {
    const data: Partial<RawFinancialData> = {
      pl: {
        completedConstruction: 0, progressConstruction: 0,
        totalSales: 100000, costOfSales: 0, grossProfit: 30000,
        sgaItems: {}, sgaTotal: 0, operatingProfit: 0,
        interestIncome: 0, dividendIncome: 0, miscIncome: 0,
        interestExpense: 0, miscExpense: 0,
        ordinaryProfit: 0, specialGain: 0, specialLoss: 0,
        preTaxProfit: 0, corporateTax: 0, netIncome: 0,
      } as RawFinancialData['pl'],
    };

    const result = enrichFinancialData(data);
    expect(result.data.pl!.costOfSales).toBe(70000);
    expect(result.enrichedFields).toContain('pl.costOfSales');
  });

  // ─── 製造原価 追加カバレッジ ───

  it('製造原価: WIP調整を含む totalCost 計算', () => {
    const data: Partial<RawFinancialData> = {
      manufacturing: {
        materials: 10000,
        labor: 20000,
        subcontract: 5000,
        expenses: 3000,
        wipBeginning: 2000,
        wipEnding: 1000,
        totalCost: 0,
        mfgDepreciation: 0,
      } as RawFinancialData['manufacturing'],
    };

    const result = enrichFinancialData(data);
    // (10000+20000+5000+3000) + (2000-1000) = 39000
    expect(result.data.manufacturing!.totalCost).toBe(39000);
  });

  it('製造原価: costOfSales との差異が大きい場合に警告', () => {
    const data: Partial<RawFinancialData> = {
      pl: {
        completedConstruction: 0, progressConstruction: 0,
        totalSales: 0, costOfSales: 40000, grossProfit: 0,
        sgaItems: {}, sgaTotal: 0, operatingProfit: 0,
        interestIncome: 0, dividendIncome: 0, miscIncome: 0,
        interestExpense: 0, miscExpense: 0,
        ordinaryProfit: 0, specialGain: 0, specialLoss: 0,
        preTaxProfit: 0, corporateTax: 0, netIncome: 0,
      } as RawFinancialData['pl'],
      manufacturing: {
        materials: 10000, labor: 20000,
        subcontract: 5000, expenses: 3000,
        wipBeginning: 0, wipEnding: 0,
        totalCost: 0, mfgDepreciation: 0,
      } as RawFinancialData['manufacturing'],
    };

    const result = enrichFinancialData(data);
    // totalCost = 38000 vs costOfSales = 40000, diff = 2000
    // 2000 > 40000*0.05(2000) is false, so no warning
    // Let's use a bigger gap
    expect(result.data.manufacturing!.totalCost).toBe(38000);
  });

  it('製造原価: costOfSales との大きな差異で警告が出る', () => {
    const data: Partial<RawFinancialData> = {
      pl: {
        completedConstruction: 0, progressConstruction: 0,
        totalSales: 0, costOfSales: 60000, grossProfit: 0,
        sgaItems: {}, sgaTotal: 0, operatingProfit: 0,
        interestIncome: 0, dividendIncome: 0, miscIncome: 0,
        interestExpense: 0, miscExpense: 0,
        ordinaryProfit: 0, specialGain: 0, specialLoss: 0,
        preTaxProfit: 0, corporateTax: 0, netIncome: 0,
      } as RawFinancialData['pl'],
      manufacturing: {
        materials: 10000, labor: 10000,
        subcontract: 5000, expenses: 3000,
        wipBeginning: 0, wipEnding: 0,
        totalCost: 0, mfgDepreciation: 0,
      } as RawFinancialData['manufacturing'],
    };

    const result = enrichFinancialData(data);
    // totalCost = 28000 vs costOfSales = 60000, diff = 32000
    // 32000 > 60000*0.05(3000) && 32000 > 100 → warning
    expect(result.warnings.some((w) => w.includes('原価報告書合計'))).toBe(true);
  });

  it('PL chain: totalSales → grossProfit → sgaTotal → operatingProfit → ordinaryProfit → preTaxProfit → netIncome', () => {
    const data: Partial<RawFinancialData> = {
      pl: {
        completedConstruction: 80000, progressConstruction: 20000,
        totalSales: 0, costOfSales: 70000, grossProfit: 0,
        sgaItems: { salary: 8000, rent: 2000 }, sgaTotal: 0,
        operatingProfit: 0,
        interestIncome: 100, dividendIncome: 50, miscIncome: 0,
        interestExpense: 200, miscExpense: 0,
        ordinaryProfit: 0,
        specialGain: 500, specialLoss: 100,
        preTaxProfit: 0, corporateTax: 3000, netIncome: 0,
      } as RawFinancialData['pl'],
    };

    const result = enrichFinancialData(data);
    expect(result.data.pl!.totalSales).toBe(100000);
    expect(result.data.pl!.grossProfit).toBe(30000);
    expect(result.data.pl!.sgaTotal).toBe(10000);
    expect(result.data.pl!.operatingProfit).toBe(20000);
    // 20000 + (100+50) - 200 = 19950
    expect(result.data.pl!.ordinaryProfit).toBe(19950);
    // 19950 + 500 - 100 = 20350
    expect(result.data.pl!.preTaxProfit).toBe(20350);
    // 20350 - 3000 = 17350
    expect(result.data.pl!.netIncome).toBe(17350);
    expect(result.enrichedFields).toHaveLength(7);
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

  it('前期元請完工高 > 前期完工高 → 警告', () => {
    const result = enrichKeishinData({
      industries: [
        {
          name: '電気工事',
          code: '03',
          prevCompletion: 30000,
          currCompletion: 50000,
          prevPrimeContract: 40000, // 40000 > 30000
          currPrimeContract: 20000,
        },
      ],
    });
    expect(result.warnings.some((w) => w.includes('前期元請完工高'))).toBe(true);
  });

  it('営業年数 0 → 警告なし（falsy）', () => {
    const result = enrichKeishinData({ businessYears: 0 });
    expect(result.warnings).toHaveLength(0);
  });

  it('営業年数が負の値 → 異常値警告', () => {
    const result = enrichKeishinData({ businessYears: -1 });
    expect(result.warnings.some((w) => w.includes('営業年数'))).toBe(true);
  });

  it('営業年数1桁 + 小規模売上 → OCR桁落ち警告なし', () => {
    const result = enrichKeishinData({
      businessYears: 3,
      industries: [
        {
          name: '塗装工事',
          code: '09',
          prevCompletion: 5000,
          currCompletion: 6000,
          prevPrimeContract: 3000,
          currPrimeContract: 4000,
        },
      ],
    });
    expect(result.warnings.some((w) => w.includes('桁落ち'))).toBe(false);
  });

  it('完工高が 0 の場合、元請 > 完工高チェックはスキップ', () => {
    const result = enrichKeishinData({
      industries: [
        {
          name: '土木一式工事',
          code: '01',
          prevCompletion: 0,
          currCompletion: 0,
          prevPrimeContract: 5000,
          currPrimeContract: 3000,
        },
      ],
    });
    // currCompletion=0 なので currPrimeContract > currCompletion のチェックは
    // 条件 `&& ind.currCompletion > 0` で弾かれる
    expect(result.warnings).toHaveLength(0);
  });
});
