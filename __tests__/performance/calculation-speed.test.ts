import { describe, it, expect } from 'vitest';
import { calculateP, calculateW, calculateX2, calculateZ } from '@/lib/engine/p-calculator';
import {
  lookupScore,
  X1_TABLE,
  X21_TABLE,
  X22_TABLE,
  Z1_TABLE,
  Z2_TABLE,
} from '@/lib/engine/score-tables';
import { convertBS } from '@/lib/engine/bs-converter';
import { convertPL } from '@/lib/engine/pl-converter';
import { calculateY } from '@/lib/engine/y-calculator';
import type { SocialItems, RawFinancialData, YInput } from '@/lib/engine/types';

const ITERATIONS = 1000;

// ---------------------------------------------------------------------------
// Shared test data factories
// ---------------------------------------------------------------------------

function makeSocialItems(seed: number): SocialItems {
  return {
    employmentInsurance: seed % 3 !== 0,
    healthInsurance: seed % 4 !== 0,
    pensionInsurance: seed % 5 !== 0,
    constructionRetirementMutualAid: seed % 2 === 0,
    retirementSystem: seed % 3 === 0,
    nonStatutoryAccidentInsurance: seed % 2 === 1,
    youngTechContinuous: seed % 2 === 0,
    youngTechNew: seed % 3 === 0,
    techStaffCount: 10 + (seed % 50),
    youngTechCount: 1 + (seed % 12),
    newYoungTechCount: seed % 5,
    cpdTotalUnits: 100 + (seed % 900),
    skillLevelUpCount: seed % 8,
    skilledWorkerCount: 2 + (seed % 20),
    deductionTargetCount: seed % 3,
    wlbEruboshi: seed % 5,
    wlbKurumin: seed % 5,
    wlbYouth: seed % 3,
    ccusImplementation: seed % 4,
    businessYears: 5 + (seed % 40),
    civilRehabilitation: seed % 50 === 0,
    disasterAgreement: seed % 2 === 0,
    suspensionOrder: seed % 100 === 0,
    instructionOrder: seed % 80 === 0,
    auditStatus: seed % 5,
    certifiedAccountants: seed % 3,
    firstClassAccountants: seed % 4,
    secondClassAccountants: seed % 5,
    rdExpense2YearAvg: (seed % 10) * 10000,
    completionAmount2YearAvg: 500000 + seed * 1000,
    constructionMachineCount: seed % 20,
    iso9001: seed % 2 === 0,
    iso14001: seed % 3 === 0,
    ecoAction21: seed % 7 === 0,
  };
}

function makeRawFinancialData(seed: number): RawFinancialData {
  const base = 1000000 + seed * 10000;
  return {
    bs: {
      currentAssets: {
        '現金及び預金': base * 0.15,
        '受取手形': base * 0.05,
        '完成工事未収入金': base * 0.20,
        '有価証券': base * 0.02,
        '未成工事支出金': base * 0.08,
        '材料貯蔵品': base * 0.01,
        '短期貸付金': base * 0.02,
        '前払費用': base * 0.005,
        '繰延税金資産': base * 0.003,
        '貸倒引当金': -(base * 0.005),
      },
      tangibleFixed: {
        '建物': base * 0.10,
        '構築物': base * 0.02,
        '建物付属設備': base * 0.03,
        '機械装置': base * 0.05,
        '車両運搬具': base * 0.01,
        '土地': base * 0.15,
        '工具器具備品': base * 0.01,
      },
      intangibleFixed: {
        '特許権': base * 0.005,
        'ソフトウェア': base * 0.01,
      },
      investments: {
        '関係会社株式': base * 0.02,
        '長期貸付金': base * 0.01,
        '保険積立金': base * 0.02,
        '長期前払費用': base * 0.005,
        '繰延税金資産': base * 0.003,
      },
      currentLiabilities: {
        '支払手形': base * 0.04,
        '工事未払金': base * 0.12,
        '未払外注費': base * 0.03,
        '短期借入金': base * 0.08,
        'リース債務': base * 0.01,
        '買掛金': base * 0.02,
        '未払給与': base * 0.015,
        '未払経費': base * 0.01,
        '未払法人税等': base * 0.02,
        '繰延税金負債': base * 0.003,
        '未成工事受入金': base * 0.05,
        '預り金': base * 0.005,
        '前受収益': base * 0.002,
        '賞与引当金': base * 0.01,
        '未払消費税等': base * 0.01,
      },
      fixedLiabilities: {
        '長期借入金': base * 0.15,
      },
      equity: {
        '資本金': base * 0.10,
        '利益準備金': base * 0.02,
        '積立金': base * 0.05,
        '別途積立金': base * 0.03,
        '自己株式': -(base * 0.005),
        'その他有価証券評価差額金': base * 0.002,
      },
      totals: {
        currentAssets: base * 0.508,
        tangibleFixed: base * 0.37,
        intangibleFixed: base * 0.015,
        investments: base * 0.058,
        fixedAssets: base * 0.443,
        totalAssets: base * 0.951,
        currentLiabilities: base * 0.425,
        fixedLiabilities: base * 0.15,
        totalLiabilities: base * 0.575,
        totalEquity: base * 0.397,
      },
    },
    pl: {
      completedConstruction: base * 2.0,
      progressConstruction: base * 0.3,
      totalSales: base * 2.5,
      costOfSales: base * 1.8,
      grossProfit: base * 0.7,
      sgaItems: {
        '役員報酬': base * 0.05,
        '従業員給料手当': base * 0.12,
        '法定福利費': base * 0.02,
        '減価償却費': base * 0.03,
        '地代家賃': base * 0.02,
        '通信費': base * 0.005,
        '交際費': base * 0.008,
        '雑費': base * 0.005,
      },
      sgaTotal: base * 0.258,
      operatingProfit: base * 0.442,
      interestIncome: base * 0.001,
      dividendIncome: base * 0.002,
      miscIncome: base * 0.005,
      interestExpense: base * 0.015,
      miscExpense: base * 0.003,
      ordinaryProfit: base * 0.432,
      specialGain: base * 0.01,
      specialLoss: base * 0.005,
      preTaxProfit: base * 0.437,
      corporateTax: base * 0.13,
      netIncome: base * 0.307,
    },
    manufacturing: {
      materials: base * 0.4,
      labor: base * 0.3,
      expenses: base * 0.2,
      subcontract: base * 0.5,
      mfgDepreciation: base * 0.05,
      wipBeginning: base * 0.08,
      wipEnding: base * 0.06,
      totalCost: base * 1.8,
    },
    sga: {
      sgaDepreciation: base * 0.03,
    },
  };
}

function makeYInput(seed: number): YInput {
  const base = 100000 + seed * 500;
  return {
    sales: base * 5,
    grossProfit: base * 1.2,
    ordinaryProfit: base * 0.8,
    interestExpense: base * 0.03,
    interestDividendIncome: base * 0.005,
    currentLiabilities: base * 2.0,
    fixedLiabilities: base * 1.5,
    totalCapital: base * 6.0,
    equity: base * 2.5,
    fixedAssets: base * 3.0,
    retainedEarnings: base * 1.8,
    corporateTax: base * 0.25,
    depreciation: base * 0.15,
    allowanceDoubtful: base * 0.02,
    notesAndAccountsReceivable: base * 1.0,
    constructionPayable: base * 0.8,
    inventoryAndMaterials: base * 0.3,
    advanceReceived: base * 0.2,
    prev: {
      totalCapital: base * 5.5,
      operatingCF: base * 0.6,
      allowanceDoubtful: base * 0.018,
      notesAndAccountsReceivable: base * 0.95,
      constructionPayable: base * 0.75,
      inventoryAndMaterials: base * 0.28,
      advanceReceived: base * 0.18,
    },
  };
}

// ---------------------------------------------------------------------------
// Original benchmarks
// ---------------------------------------------------------------------------

describe('Calculation performance benchmarks', () => {
  it(`calculateP completes ${ITERATIONS} iterations in under 100ms`, () => {
    const start = performance.now();

    for (let i = 0; i < ITERATIONS; i++) {
      calculateP(
        700 + (i % 500),
        600 + (i % 300),
        800 + (i % 200),
        750 + (i % 400),
        900 + (i % 300),
      );
    }

    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(100);
  });

  it(`calculateW completes ${ITERATIONS} iterations in under 100ms`, () => {
    const baseSocialItems: SocialItems = {
      employmentInsurance: true,
      healthInsurance: true,
      pensionInsurance: true,
      constructionRetirementMutualAid: true,
      retirementSystem: true,
      nonStatutoryAccidentInsurance: true,
      youngTechContinuous: true,
      youngTechNew: true,
      techStaffCount: 20,
      youngTechCount: 5,
      newYoungTechCount: 2,
      cpdTotalUnits: 600,
      skillLevelUpCount: 4,
      skilledWorkerCount: 10,
      deductionTargetCount: 0,
      wlbEruboshi: 3,
      wlbKurumin: 2,
      wlbYouth: 1,
      ccusImplementation: 2,
      businessYears: 25,
      civilRehabilitation: false,
      disasterAgreement: true,
      suspensionOrder: false,
      instructionOrder: false,
      auditStatus: 3,
      certifiedAccountants: 1,
      firstClassAccountants: 2,
      secondClassAccountants: 3,
      rdExpense2YearAvg: 50000,
      completionAmount2YearAvg: 1000000,
      constructionMachineCount: 10,
      iso9001: true,
      iso14001: true,
      ecoAction21: false,
    };

    const start = performance.now();

    for (let i = 0; i < ITERATIONS; i++) {
      calculateW({
        ...baseSocialItems,
        techStaffCount: 10 + (i % 50),
        businessYears: 5 + (i % 40),
      });
    }

    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(100);
  });

  it(`lookupScore completes ${ITERATIONS} iterations across all tables in under 100ms`, () => {
    const tables = [
      { name: 'X1', table: X1_TABLE, minVal: 0, maxVal: 100000000 },
      { name: 'X21', table: X21_TABLE, minVal: 0, maxVal: 999999 },
      { name: 'X22', table: X22_TABLE, minVal: 0, maxVal: 999999 },
      { name: 'Z1', table: Z1_TABLE, minVal: 0, maxVal: 1099 },
      { name: 'Z2', table: Z2_TABLE, minVal: 0, maxVal: 1999999 },
    ];

    const start = performance.now();

    for (let i = 0; i < ITERATIONS; i++) {
      for (const { table, minVal, maxVal } of tables) {
        const value = minVal + ((i * 997) % (maxVal - minVal));
        lookupScore(table, value);
      }
    }

    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(100);
  });
});

// ---------------------------------------------------------------------------
// Score table lookup - dedicated per-table benchmarks
// ---------------------------------------------------------------------------

describe('Score table lookup performance (per-table)', () => {
  const ALL_TABLES = [
    { name: 'X1',  table: X1_TABLE,  minVal: 0,         maxVal: 100000000 },
    { name: 'X21', table: X21_TABLE, minVal: 0,         maxVal: 999999 },
    { name: 'X22', table: X22_TABLE, minVal: 0,         maxVal: 999999 },
    { name: 'Z1',  table: Z1_TABLE,  minVal: 0,         maxVal: 1099 },
    { name: 'Z2',  table: Z2_TABLE,  minVal: 0,         maxVal: 1999999 },
  ];

  for (const { name, table, minVal, maxVal } of ALL_TABLES) {
    it(`lookupScore ${name}: 1000 lookups with uniformly distributed values in under 50ms`, () => {
      const start = performance.now();
      for (let i = 0; i < ITERATIONS; i++) {
        const value = minVal + ((i * 997) % (maxVal - minVal));
        lookupScore(table, value);
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(50);
    });

    it(`lookupScore ${name}: boundary values hit every bracket`, () => {
      const start = performance.now();
      for (let round = 0; round < 100; round++) {
        for (const bracket of table) {
          if (Number.isFinite(bracket.min)) {
            lookupScore(table, bracket.min);
          }
          const mid = Number.isFinite(bracket.max)
            ? Math.floor((bracket.min + bracket.max) / 2)
            : bracket.min + 1;
          if (Number.isFinite(mid)) {
            lookupScore(table, mid);
          }
        }
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(50);
    });
  }

  it('lookupScore across all 5 tables: 5000 total lookups in under 100ms', () => {
    const start = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
      for (const { table, minVal, maxVal } of ALL_TABLES) {
        const value = minVal + ((i * 1009) % (maxVal - minVal));
        lookupScore(table, value);
      }
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(100);
  });
});

// ---------------------------------------------------------------------------
// BS converter performance
// ---------------------------------------------------------------------------

describe('BS converter performance', () => {
  it(`convertBS completes ${ITERATIONS} iterations with realistic data in under 200ms`, () => {
    const start = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
      convertBS(makeRawFinancialData(i));
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(200);
  });

  it('convertBS handles large company financials (billions of yen) without degradation', () => {
    const largeCompany = makeRawFinancialData(0);
    // Scale everything up to simulate a large company (~100 billion yen revenue)
    const scale = 50000;
    const scaled: RawFinancialData = JSON.parse(JSON.stringify(largeCompany));
    for (const section of ['currentAssets', 'tangibleFixed', 'intangibleFixed', 'investments', 'currentLiabilities', 'fixedLiabilities', 'equity'] as const) {
      for (const key of Object.keys(scaled.bs[section])) {
        (scaled.bs[section] as Record<string, number>)[key] *= scale;
      }
    }
    for (const key of Object.keys(scaled.bs.totals)) {
      (scaled.bs.totals as unknown as Record<string, number>)[key] *= scale;
    }

    const start = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
      convertBS(scaled);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(200);
  });
});

// ---------------------------------------------------------------------------
// PL converter performance
// ---------------------------------------------------------------------------

describe('PL converter performance', () => {
  it(`convertPL completes ${ITERATIONS} iterations with realistic data in under 200ms`, () => {
    const start = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
      convertPL(makeRawFinancialData(i));
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(200);
  });

  it('convertPL with many SGA line items (20+ items) stays fast', () => {
    const data = makeRawFinancialData(42);
    // Add many SGA line items to simulate a detailed company
    const extraSgaItems: Record<string, number> = { ...data.pl.sgaItems };
    const sgaNames = [
      '旅費交通費', '消耗品費', '修繕費', '保険料', '租税公課',
      '水道光熱費', '福利厚生費', '荷造発送費', '広告宣伝費', '会議費',
      '図書費', '研修費', '車両費', '事務用品費', '支払手数料',
    ];
    for (const name of sgaNames) {
      extraSgaItems[name] = 50000 + Math.floor(Math.random() * 200000);
    }
    data.pl.sgaItems = extraSgaItems;

    const start = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
      convertPL(data);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(200);
  });
});

// ---------------------------------------------------------------------------
// Y calculator performance
// ---------------------------------------------------------------------------

describe('Y calculator performance', () => {
  it(`calculateY completes ${ITERATIONS} iterations with varying inputs in under 100ms`, () => {
    const start = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
      calculateY(makeYInput(i));
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(100);
  });

  it('calculateY with extreme edge-case inputs (zero sales, negative equity)', () => {
    const edgeCases: YInput[] = [];
    for (let i = 0; i < 200; i++) {
      const input = makeYInput(i);
      // Alternate between various edge cases
      switch (i % 5) {
        case 0: input.sales = 0; break;                          // zero sales
        case 1: input.equity = -(input.totalCapital * 0.5); break; // negative equity
        case 2: input.fixedAssets = 0; break;                     // no fixed assets
        case 3: input.totalCapital = 10000; break;                // below 30,000 floor
        case 4:                                                    // all previous period zero
          input.prev = {
            totalCapital: 0,
            operatingCF: 0,
            allowanceDoubtful: 0,
            notesAndAccountsReceivable: 0,
            constructionPayable: 0,
            inventoryAndMaterials: 0,
            advanceReceived: 0,
          };
          break;
      }
      edgeCases.push(input);
    }

    const start = performance.now();
    for (const input of edgeCases) {
      calculateY(input);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50);
  });

  it('calculateY results are always within valid Y range [0, 1595]', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const result = calculateY(makeYInput(i));
      expect(result.Y).toBeGreaterThanOrEqual(0);
      expect(result.Y).toBeLessThanOrEqual(1595);
    }
  });
});

// ---------------------------------------------------------------------------
// W calculator with diverse social items
// ---------------------------------------------------------------------------

describe('W calculator performance with diverse inputs', () => {
  it(`calculateW with ${ITERATIONS} unique social item combinations in under 100ms`, () => {
    const start = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
      calculateW(makeSocialItems(i));
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(100);
  });

  it('calculateW with worst-case inputs (all penalties active)', () => {
    const worstCase: SocialItems = {
      employmentInsurance: false,
      healthInsurance: false,
      pensionInsurance: false,
      constructionRetirementMutualAid: false,
      retirementSystem: false,
      nonStatutoryAccidentInsurance: false,
      youngTechContinuous: false,
      youngTechNew: false,
      techStaffCount: 0,
      youngTechCount: 0,
      newYoungTechCount: 0,
      cpdTotalUnits: 0,
      skillLevelUpCount: 0,
      skilledWorkerCount: 0,
      deductionTargetCount: 10,
      wlbEruboshi: 0,
      wlbKurumin: 0,
      wlbYouth: 0,
      ccusImplementation: 0,
      businessYears: 0,
      civilRehabilitation: true,
      disasterAgreement: false,
      suspensionOrder: true,
      instructionOrder: false,
      auditStatus: 0,
      certifiedAccountants: 0,
      firstClassAccountants: 0,
      secondClassAccountants: 0,
      rdExpense2YearAvg: 0,
      completionAmount2YearAvg: 0,
      constructionMachineCount: 0,
      iso9001: false,
      iso14001: false,
      ecoAction21: false,
    };

    const start = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
      calculateW(worstCase);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50);
  });
});

// ---------------------------------------------------------------------------
// Memory usage for large batch calculations
// ---------------------------------------------------------------------------

describe('Memory usage for large batch calculations', () => {
  const BATCH_SIZE = 5000;

  it(`batch of ${BATCH_SIZE} full pipeline calculations does not leak memory`, () => {
    // Force GC if available (node --expose-gc), otherwise just measure heap
    const heapBefore = process.memoryUsage().heapUsed;

    const results: number[] = [];
    for (let i = 0; i < BATCH_SIZE; i++) {
      const raw = makeRawFinancialData(i % 500);
      const bs = convertBS(raw);
      const pl = convertPL(raw);
      const yInput = makeYInput(i % 500);
      const yResult = calculateY(yInput);
      const w = calculateW(makeSocialItems(i % 500));

      const x1Score = lookupScore(X1_TABLE, Math.abs(bs.totalAssets) % 99999999);
      const x21Score = lookupScore(X21_TABLE, Math.abs(bs.totalAssets) % 999999);
      const x22Score = lookupScore(X22_TABLE, Math.abs(pl.grossProfit) % 999999);
      const x2 = calculateX2(x21Score, x22Score);
      const z = calculateZ(600 + (i % 400), 500 + (i % 300));

      results.push(calculateP(x1Score, x2, yResult.Y, z, w.W));
    }

    const heapAfter = process.memoryUsage().heapUsed;
    const heapGrowthMB = (heapAfter - heapBefore) / (1024 * 1024);

    // All results should be valid P scores
    for (const p of results) {
      expect(p).toBeGreaterThanOrEqual(6);
      expect(p).toBeLessThanOrEqual(2160);
    }

    // Heap growth should be reasonable (under 50MB for 5000 iterations)
    expect(heapGrowthMB).toBeLessThan(50);
  });

  it(`storing ${BATCH_SIZE} BS results in an array stays within memory bounds`, () => {
    const heapBefore = process.memoryUsage().heapUsed;
    const bsResults = [];
    for (let i = 0; i < BATCH_SIZE; i++) {
      bsResults.push(convertBS(makeRawFinancialData(i % 500)));
    }
    const heapAfter = process.memoryUsage().heapUsed;
    const heapGrowthMB = (heapAfter - heapBefore) / (1024 * 1024);

    expect(bsResults).toHaveLength(BATCH_SIZE);
    expect(heapGrowthMB).toBeLessThan(50);
  });

  it(`storing ${BATCH_SIZE} Y results in an array stays within memory bounds`, () => {
    const heapBefore = process.memoryUsage().heapUsed;
    const yResults = [];
    for (let i = 0; i < BATCH_SIZE; i++) {
      yResults.push(calculateY(makeYInput(i % 500)));
    }
    const heapAfter = process.memoryUsage().heapUsed;
    const heapGrowthMB = (heapAfter - heapBefore) / (1024 * 1024);

    expect(yResults).toHaveLength(BATCH_SIZE);
    expect(heapGrowthMB).toBeLessThan(50);
  });
});

// ---------------------------------------------------------------------------
// End-to-end pipeline throughput
// ---------------------------------------------------------------------------

describe('End-to-end pipeline throughput', () => {
  it('full scoring pipeline (BS+PL+Y+W+score tables+P) x 1000 in under 500ms', () => {
    const start = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
      const raw = makeRawFinancialData(i);
      const bs = convertBS(raw);
      const pl = convertPL(raw);
      const yInput = makeYInput(i);
      const yResult = calculateY(yInput);
      const w = calculateW(makeSocialItems(i));

      const x1Score = lookupScore(X1_TABLE, Math.abs(bs.totalAssets) % 99999999);
      const x21Score = lookupScore(X21_TABLE, Math.abs(bs.totalAssets) % 999999);
      const x22Score = lookupScore(X22_TABLE, Math.abs(pl.grossProfit) % 999999);
      const x2 = calculateX2(x21Score, x22Score);
      const z = calculateZ(600 + (i % 400), 500 + (i % 300));
      const p = calculateP(x1Score, x2, yResult.Y, z, w.W);

      expect(p).toBeGreaterThanOrEqual(6);
      expect(p).toBeLessThanOrEqual(2160);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(500);
  });
});
