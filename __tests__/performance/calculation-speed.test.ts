import { describe, it, expect } from 'vitest';
import { calculateP, calculateW } from '@/lib/engine/p-calculator';
import {
  lookupScore,
  X1_TABLE,
  X21_TABLE,
  X22_TABLE,
  Z1_TABLE,
  Z2_TABLE,
} from '@/lib/engine/score-tables';
import type { SocialItems } from '@/lib/engine/types';

const ITERATIONS = 1000;

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
