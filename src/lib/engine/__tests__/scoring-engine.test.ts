import { describe, expect, it } from 'vitest';
import {
  lookupScore,
  X1_TABLE,
  X21_TABLE,
  X22_TABLE,
  Z1_TABLE,
  Z2_TABLE,
  getEffectiveMultiplier,
  type Bracket,
} from '../score-tables';
import {
  calculateP,
  calculateX2,
  calculateZ,
  calculateW,
  calculateX1WithAverage,
} from '../p-calculator';
import type { SocialItems } from '../types';

// ---------------------------------------------------------------------------
// Helper: default SocialItems with all flags off / zero
// ---------------------------------------------------------------------------
function baseSocialItems(overrides: Partial<SocialItems> = {}): SocialItems {
  return {
    employmentInsurance: true,
    healthInsurance: true,
    pensionInsurance: true,
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
    deductionTargetCount: 0,
    wlbEruboshi: 0,
    wlbKurumin: 0,
    wlbYouth: 0,
    ccusImplementation: 0,
    businessYears: 0,
    civilRehabilitation: false,
    disasterAgreement: false,
    suspensionOrder: false,
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
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. lookupScore
// ---------------------------------------------------------------------------
describe('lookupScore', () => {
  const simpleBrackets: Bracket[] = [
    { min: 0, max: 100, a: 10, b: 100, c: 50 },
    { min: 100, max: Infinity, a: 0, b: 1, c: 99 },
  ];

  it('returns correct score for mid-bracket value', () => {
    // floor(10 * 50 / 100) + 50 = floor(5) + 50 = 55
    expect(lookupScore(simpleBrackets, 50)).toBe(55);
  });

  it('returns correct score at lower boundary (inclusive)', () => {
    // floor(10 * 0 / 100) + 50 = 50
    expect(lookupScore(simpleBrackets, 0)).toBe(50);
  });

  it('returns correct score at upper boundary (exclusive → next bracket)', () => {
    // value=100 falls into second bracket: floor(0*100/1)+99 = 99
    expect(lookupScore(simpleBrackets, 100)).toBe(99);
  });

  it('throws for value below all brackets', () => {
    const limited: Bracket[] = [{ min: 10, max: 100, a: 1, b: 1, c: 0 }];
    // min=10 なので 5 は範囲外 → エラー
    expect(() => lookupScore(limited, 5)).toThrow('評点テーブルの該当区間が見つかりません');
  });

  it('throws for empty brackets array', () => {
    expect(() => lookupScore([], 0)).toThrow();
  });

  it('floors the result (truncates decimals)', () => {
    // floor(10 * 33 / 100) + 50 = floor(3.3) + 50 = 53
    expect(lookupScore(simpleBrackets, 33)).toBe(53);
  });
});

// ---------------------------------------------------------------------------
// 2. X1_TABLE monotonicity
// ---------------------------------------------------------------------------
describe('X1_TABLE monotonicity', () => {
  it('scores increase as value increases across bracket midpoints', () => {
    const midpoints = X1_TABLE.filter((b) => b.max !== Infinity).map(
      (b) => (b.min + b.max) / 2
    );
    const scores = midpoints.map((v) => lookupScore(X1_TABLE, v));

    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]);
    }
  });

  it('first bracket minimum (0) returns a score', () => {
    expect(lookupScore(X1_TABLE, 0)).toBe(397); // floor(131*0/10000)+397
  });

  it('last bracket (>=100000000) returns capped score 1998', () => {
    expect(lookupScore(X1_TABLE, 100000000)).toBe(1998);
    expect(lookupScore(X1_TABLE, 999999999)).toBe(1998);
  });
});

// ---------------------------------------------------------------------------
// 3. X21_TABLE (自己資本額)
// ---------------------------------------------------------------------------
describe('X21_TABLE', () => {
  it('negative equity returns 0', () => {
    expect(lookupScore(X21_TABLE, -100000)).toBe(0);
    expect(lookupScore(X21_TABLE, -1)).toBe(0);
  });

  it('zero equity returns base score 361', () => {
    // floor(223*0/10000)+361 = 361
    expect(lookupScore(X21_TABLE, 0)).toBe(361);
  });

  it('normal range returns expected score', () => {
    // 50000: bracket min=50000, max=60000, a=11, b=10000, c=614
    // floor(11*50000/10000)+614 = floor(55)+614 = 669
    expect(lookupScore(X21_TABLE, 50000)).toBe(669);
  });

  it('max cap (>=1000000) returns 902', () => {
    expect(lookupScore(X21_TABLE, 1000000)).toBe(902);
    expect(lookupScore(X21_TABLE, 5000000)).toBe(902);
  });
});

// ---------------------------------------------------------------------------
// 4. X22_TABLE (EBITDA)
// ---------------------------------------------------------------------------
describe('X22_TABLE', () => {
  it('negative EBITDA returns 0', () => {
    expect(lookupScore(X22_TABLE, -50000)).toBe(0);
    expect(lookupScore(X22_TABLE, -1)).toBe(0);
  });

  it('zero EBITDA returns base score 547', () => {
    // floor(78*0/10000)+547 = 547
    expect(lookupScore(X22_TABLE, 0)).toBe(547);
  });

  it('normal range returns expected score', () => {
    // 30000: bracket min=30000, max=40000, a=15, b=10000, c=622
    // floor(15*30000/10000)+622 = floor(45)+622 = 667
    expect(lookupScore(X22_TABLE, 30000)).toBe(667);
  });

  it('max cap (>=1000000) returns 938', () => {
    expect(lookupScore(X22_TABLE, 1000000)).toBe(938);
    expect(lookupScore(X22_TABLE, 9999999)).toBe(938);
  });
});

// ---------------------------------------------------------------------------
// 5. Z1_TABLE (技術職員数値)
// ---------------------------------------------------------------------------
describe('Z1_TABLE', () => {
  it('low value (0) returns base score', () => {
    // floor(62*0/5)+510 = 510
    expect(lookupScore(Z1_TABLE, 0)).toBe(510);
  });

  it('mid value (50) returns expected score', () => {
    // bracket min=50, max=65, a=62, b=15, c=742
    // floor(62*50/15)+742 = floor(206.66)+742 = 948
    expect(lookupScore(Z1_TABLE, 50)).toBe(948);
  });

  it('high value (>=1100) returns cap 1712', () => {
    expect(lookupScore(Z1_TABLE, 1100)).toBe(1712);
    expect(lookupScore(Z1_TABLE, 5000)).toBe(1712);
  });

  it('scores are monotonically non-decreasing', () => {
    const midpoints = Z1_TABLE.filter((b) => b.max !== Infinity).map(
      (b) => (b.min + b.max) / 2
    );
    const scores = midpoints.map((v) => lookupScore(Z1_TABLE, v));
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]);
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Z2_TABLE (元請完成工事高)
// ---------------------------------------------------------------------------
describe('Z2_TABLE', () => {
  it('zero returns base score 241', () => {
    // floor(341*0/10000)+241 = 241
    expect(lookupScore(Z2_TABLE, 0)).toBe(241);
  });

  it('boundary value at 10000 (second bracket start)', () => {
    // bracket min=10000, max=12000, a=16, b=2000, c=502
    // floor(16*10000/2000)+502 = floor(80)+502 = 582
    expect(lookupScore(Z2_TABLE, 10000)).toBe(582);
  });

  it('max cap (>=2000000) returns 1341', () => {
    expect(lookupScore(Z2_TABLE, 2000000)).toBe(1341);
  });

  it('scores are monotonically non-decreasing', () => {
    const midpoints = Z2_TABLE.filter((b) => b.max !== Infinity).map(
      (b) => (b.min + b.max) / 2
    );
    const scores = midpoints.map((v) => lookupScore(Z2_TABLE, v));
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]);
    }
  });
});

// ---------------------------------------------------------------------------
// 7. calculateP
// ---------------------------------------------------------------------------
describe('calculateP', () => {
  it('computes weighted sum correctly', () => {
    // P = 0.25*1000 + 0.15*800 + 0.20*700 + 0.25*900 + 0.15*600
    //   = 250 + 120 + 140 + 225 + 90 = 825
    expect(calculateP(1000, 800, 700, 900, 600)).toBe(825);
  });

  it('clamps minimum to 6', () => {
    expect(calculateP(0, 0, 0, 0, 0)).toBe(6);
  });

  it('clamps maximum to 2160', () => {
    expect(calculateP(9999, 9999, 9999, 9999, 9999)).toBe(2160);
  });

  it('rounds to nearest integer', () => {
    // 0.25*101 + 0.15*101 + 0.20*101 + 0.25*101 + 0.15*101 = 101
    expect(calculateP(101, 101, 101, 101, 101)).toBe(101);
  });

  it('handles fractional intermediate values', () => {
    // 0.25*1 + 0.15*1 + 0.20*1 + 0.25*1 + 0.15*1 = 1.0 → round = 1, clamp to 6
    expect(calculateP(1, 1, 1, 1, 1)).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// 8. calculateX2
// ---------------------------------------------------------------------------
describe('calculateX2', () => {
  it('returns floor of average', () => {
    expect(calculateX2(600, 700)).toBe(650);
    expect(calculateX2(601, 700)).toBe(650); // floor(1301/2) = 650
    expect(calculateX2(601, 701)).toBe(651); // floor(1302/2) = 651
  });

  it('handles zero values', () => {
    expect(calculateX2(0, 0)).toBe(0);
  });

  it('handles odd sum (floors)', () => {
    expect(calculateX2(1, 0)).toBe(0); // floor(1/2) = 0
    expect(calculateX2(3, 0)).toBe(1); // floor(3/2) = 1
  });
});

// ---------------------------------------------------------------------------
// 9. calculateZ
// ---------------------------------------------------------------------------
describe('calculateZ', () => {
  it('applies 80/20 weighting and floors', () => {
    // floor(1000*0.8 + 500*0.2) = floor(800+100) = 900
    expect(calculateZ(1000, 500)).toBe(900);
  });

  it('floors fractional results', () => {
    // floor(1001*0.8 + 501*0.2) = floor(800.8+100.2) = floor(901.0) = 901
    expect(calculateZ(1001, 501)).toBe(901);
    // floor(999*0.8 + 499*0.2) = floor(799.2+99.8) = floor(899.0) = 899
    expect(calculateZ(999, 499)).toBe(899);
  });

  it('handles zero values', () => {
    expect(calculateZ(0, 0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 10. calculateW
// ---------------------------------------------------------------------------
describe('calculateW', () => {
  describe('insurance deductions (w1)', () => {
    it('deducts -40 for each missing insurance', () => {
      const result = calculateW(
        baseSocialItems({
          employmentInsurance: false,
          healthInsurance: false,
          pensionInsurance: false,
        })
      );
      // w1 = -40 -40 -40 = -120
      expect(result.detail.w1).toBe(-120);
    });

    it('no deduction when all insurances present', () => {
      const result = calculateW(baseSocialItems());
      expect(result.detail.w1).toBe(0);
    });

    it('deducts -40 for single missing insurance', () => {
      const result = calculateW(
        baseSocialItems({ employmentInsurance: false })
      );
      expect(result.detail.w1).toBe(-40);
    });
  });

  describe('social contribution items (w1)', () => {
    it('adds +15 for each social contribution flag', () => {
      const result = calculateW(
        baseSocialItems({
          constructionRetirementMutualAid: true,
          retirementSystem: true,
          nonStatutoryAccidentInsurance: true,
        })
      );
      expect(result.detail.w1).toBe(45);
    });

    it('adds +1 for young tech continuous (ratio >= 0.15)', () => {
      const result = calculateW(
        baseSocialItems({
          youngTechContinuous: true,
          techStaffCount: 100,
          youngTechCount: 15,
        })
      );
      expect(result.detail.w1).toBe(1);
    });

    it('no young tech bonus when ratio < 0.15', () => {
      const result = calculateW(
        baseSocialItems({
          youngTechContinuous: true,
          techStaffCount: 100,
          youngTechCount: 14,
        })
      );
      expect(result.detail.w1).toBe(0);
    });

    it('adds +1 for new young tech', () => {
      const result = calculateW(
        baseSocialItems({
          youngTechNew: true,
          newYoungTechCount: 1,
        })
      );
      expect(result.detail.w1).toBe(1);
    });
  });

  describe('CPD units (w1)', () => {
    it('adds +10 for cpdPerPerson >= 30', () => {
      const result = calculateW(
        baseSocialItems({ techStaffCount: 10, cpdTotalUnits: 300 })
      );
      expect(result.detail.w1).toBe(10);
    });

    it('adds +5 for cpdPerPerson >= 15 and < 30', () => {
      const result = calculateW(
        baseSocialItems({ techStaffCount: 10, cpdTotalUnits: 150 })
      );
      expect(result.detail.w1).toBe(5);
    });

    it('adds +3 for cpdPerPerson >= 5 and < 15', () => {
      const result = calculateW(
        baseSocialItems({ techStaffCount: 10, cpdTotalUnits: 50 })
      );
      expect(result.detail.w1).toBe(3);
    });

    it('adds +1 for cpdPerPerson >= 1 and < 5', () => {
      const result = calculateW(
        baseSocialItems({ techStaffCount: 10, cpdTotalUnits: 10 })
      );
      expect(result.detail.w1).toBe(1);
    });

    it('adds nothing when techStaffCount is 0', () => {
      const result = calculateW(
        baseSocialItems({ techStaffCount: 0, cpdTotalUnits: 999 })
      );
      expect(result.detail.w1).toBe(0);
    });
  });

  describe('skill level up (w1)', () => {
    it('adds +10 for ratio >= 0.15', () => {
      const result = calculateW(
        baseSocialItems({ techStaffCount: 100, skillLevelUpCount: 15 })
      );
      expect(result.detail.w1).toBe(10);
    });

    it('adds +7 for ratio >= 0.10 and < 0.15', () => {
      const result = calculateW(
        baseSocialItems({ techStaffCount: 100, skillLevelUpCount: 10 })
      );
      expect(result.detail.w1).toBe(7);
    });

    it('adds +3 for ratio >= 0.05 and < 0.10', () => {
      const result = calculateW(
        baseSocialItems({ techStaffCount: 100, skillLevelUpCount: 5 })
      );
      expect(result.detail.w1).toBe(3);
    });

    it('adds +1 for ratio > 0 and < 0.05', () => {
      const result = calculateW(
        baseSocialItems({ techStaffCount: 100, skillLevelUpCount: 1 })
      );
      expect(result.detail.w1).toBe(1);
    });
  });

  describe('WLB / eruboshi / kurumin / youth (w1)', () => {
    it('adds eruboshi points based on level', () => {
      expect(calculateW(baseSocialItems({ wlbEruboshi: 4 })).detail.w1).toBe(5);
      expect(calculateW(baseSocialItems({ wlbEruboshi: 3 })).detail.w1).toBe(3);
      expect(calculateW(baseSocialItems({ wlbEruboshi: 2 })).detail.w1).toBe(2);
      expect(calculateW(baseSocialItems({ wlbEruboshi: 1 })).detail.w1).toBe(1);
      expect(calculateW(baseSocialItems({ wlbEruboshi: 0 })).detail.w1).toBe(0);
    });

    it('adds kurumin points based on level', () => {
      expect(calculateW(baseSocialItems({ wlbKurumin: 4 })).detail.w1).toBe(5);
      expect(calculateW(baseSocialItems({ wlbKurumin: 3 })).detail.w1).toBe(3);
      expect(calculateW(baseSocialItems({ wlbKurumin: 2 })).detail.w1).toBe(2);
      expect(calculateW(baseSocialItems({ wlbKurumin: 1 })).detail.w1).toBe(1);
    });

    it('adds youth points based on level', () => {
      expect(calculateW(baseSocialItems({ wlbYouth: 2 })).detail.w1).toBe(4);
      expect(calculateW(baseSocialItems({ wlbYouth: 1 })).detail.w1).toBe(2);
      expect(calculateW(baseSocialItems({ wlbYouth: 0 })).detail.w1).toBe(0);
    });
  });

  describe('CCUS implementation (w1)', () => {
    it('adds +15 for level >= 3', () => {
      expect(
        calculateW(baseSocialItems({ ccusImplementation: 3 })).detail.w1
      ).toBe(15);
    });

    it('adds +10 for level 2', () => {
      expect(
        calculateW(baseSocialItems({ ccusImplementation: 2 })).detail.w1
      ).toBe(10);
    });

    it('adds +5 for level 1', () => {
      expect(
        calculateW(baseSocialItems({ ccusImplementation: 1 })).detail.w1
      ).toBe(5);
    });
  });

  describe('business years (w2)', () => {
    it('gives 60 for >= 35 years', () => {
      const result = calculateW(baseSocialItems({ businessYears: 35 }));
      expect(result.detail.w2).toBe(60);
    });

    it('gives (years - 5) * 2 for years between 6 and 34', () => {
      const result = calculateW(baseSocialItems({ businessYears: 20 }));
      expect(result.detail.w2).toBe(30); // (20-5)*2
    });

    it('gives 0 for 5 years or less', () => {
      expect(calculateW(baseSocialItems({ businessYears: 5 })).detail.w2).toBe(
        0
      );
      expect(calculateW(baseSocialItems({ businessYears: 0 })).detail.w2).toBe(
        0
      );
    });

    it('gives -60 for civil rehabilitation', () => {
      const result = calculateW(
        baseSocialItems({ civilRehabilitation: true, businessYears: 40 })
      );
      expect(result.detail.w2).toBe(-60);
    });

    it('boundary: exactly 5 years gives 0 (not in formula range)', () => {
      expect(calculateW(baseSocialItems({ businessYears: 5 })).detail.w2).toBe(0);
    });

    it('boundary: exactly 6 years gives (6-5)*2 = 2', () => {
      expect(calculateW(baseSocialItems({ businessYears: 6 })).detail.w2).toBe(2);
    });

    it('boundary: exactly 35 years gives 60 (cap)', () => {
      expect(calculateW(baseSocialItems({ businessYears: 35 })).detail.w2).toBe(60);
    });

    it('boundary: exactly 36 years gives 60 (above cap, still 60)', () => {
      expect(calculateW(baseSocialItems({ businessYears: 36 })).detail.w2).toBe(60);
    });

    it('civil rehabilitation overrides even high business years', () => {
      expect(
        calculateW(baseSocialItems({ civilRehabilitation: true, businessYears: 50 })).detail.w2
      ).toBe(-60);
    });
  });

  describe('disaster agreement (w3)', () => {
    it('gives 20 when true', () => {
      expect(
        calculateW(baseSocialItems({ disasterAgreement: true })).detail.w3
      ).toBe(20);
    });

    it('gives 0 when false', () => {
      expect(
        calculateW(baseSocialItems({ disasterAgreement: false })).detail.w3
      ).toBe(0);
    });
  });

  describe('legal compliance (w4)', () => {
    it('gives -30 for suspension order', () => {
      expect(
        calculateW(baseSocialItems({ suspensionOrder: true })).detail.w4
      ).toBe(-30);
    });

    it('gives -15 for instruction order (no suspension)', () => {
      expect(
        calculateW(baseSocialItems({ instructionOrder: true })).detail.w4
      ).toBe(-15);
    });

    it('gives 0 when no orders', () => {
      expect(calculateW(baseSocialItems()).detail.w4).toBe(0);
    });

    it('suspension takes priority over instruction', () => {
      expect(
        calculateW(
          baseSocialItems({ suspensionOrder: true, instructionOrder: true })
        ).detail.w4
      ).toBe(-30);
    });
  });

  describe('audit and accountants (w5)', () => {
    it('gives 20 for audit status 4', () => {
      expect(
        calculateW(baseSocialItems({ auditStatus: 4 })).detail.w5
      ).toBe(20);
    });

    it('gives 14 for audit status 3', () => {
      expect(
        calculateW(baseSocialItems({ auditStatus: 3 })).detail.w5
      ).toBe(14);
    });

    it('gives 8 for audit status 2', () => {
      expect(
        calculateW(baseSocialItems({ auditStatus: 2 })).detail.w5
      ).toBe(8);
    });

    it('gives 4 for audit status 1', () => {
      expect(
        calculateW(baseSocialItems({ auditStatus: 1 })).detail.w5
      ).toBe(4);
    });

    it('gives 0 for audit status 0', () => {
      expect(
        calculateW(baseSocialItems({ auditStatus: 0 })).detail.w5
      ).toBe(0);
    });

    it('adds accountants correctly', () => {
      const result = calculateW(
        baseSocialItems({
          auditStatus: 0,
          certifiedAccountants: 2,
          firstClassAccountants: 3,
          secondClassAccountants: 1,
        })
      );
      // min(10, (2+3+1)*2) = min(10, 12) = 10（上限キャップ）
      expect(result.detail.w5).toBe(10);
    });

    it('combines audit status + all accountant types', () => {
      const result = calculateW(
        baseSocialItems({
          auditStatus: 4,
          certifiedAccountants: 2,
          firstClassAccountants: 1,
          secondClassAccountants: 3,
        })
      );
      // 20 (audit) + min(10, (2+1+3)*2) = 20 + 10 = 30
      expect(result.detail.w5).toBe(30);
    });
  });

  describe('R&D expense (w6)', () => {
    it('gives 25 for ratio >= 5%', () => {
      const result = calculateW(
        baseSocialItems({
          rdExpense2YearAvg: 5000,
          completionAmount2YearAvg: 100000,
        })
      );
      expect(result.detail.w6).toBe(25);
    });

    it('gives 15 for ratio >= 3% and < 5%', () => {
      const result = calculateW(
        baseSocialItems({
          rdExpense2YearAvg: 3000,
          completionAmount2YearAvg: 100000,
        })
      );
      expect(result.detail.w6).toBe(15);
    });

    it('gives 5 for ratio >= 1% and < 3%', () => {
      const result = calculateW(
        baseSocialItems({
          rdExpense2YearAvg: 1000,
          completionAmount2YearAvg: 100000,
        })
      );
      expect(result.detail.w6).toBe(5);
    });

    it('gives 0 for ratio < 1%', () => {
      const result = calculateW(
        baseSocialItems({
          rdExpense2YearAvg: 999,
          completionAmount2YearAvg: 100000,
        })
      );
      expect(result.detail.w6).toBe(0);
    });

    it('gives 0 when no R&D expense', () => {
      expect(calculateW(baseSocialItems()).detail.w6).toBe(0);
    });
  });

  describe('construction machines (w7)', () => {
    it('caps at 15', () => {
      expect(
        calculateW(baseSocialItems({ constructionMachineCount: 20 })).detail.w7
      ).toBe(15);
    });

    it('returns count when < 15', () => {
      expect(
        calculateW(baseSocialItems({ constructionMachineCount: 7 })).detail.w7
      ).toBe(7);
    });

    it('returns 0 for zero machines', () => {
      expect(
        calculateW(baseSocialItems({ constructionMachineCount: 0 })).detail.w7
      ).toBe(0);
    });

    it('boundary: exactly 15 machines gives 15 (cap)', () => {
      expect(
        calculateW(baseSocialItems({ constructionMachineCount: 15 })).detail.w7
      ).toBe(15);
    });

    it('boundary: exactly 16 machines gives 15 (over cap)', () => {
      expect(
        calculateW(baseSocialItems({ constructionMachineCount: 16 })).detail.w7
      ).toBe(15);
    });

    it('boundary: exactly 14 machines gives 14 (under cap)', () => {
      expect(
        calculateW(baseSocialItems({ constructionMachineCount: 14 })).detail.w7
      ).toBe(14);
    });
  });

  describe('ISO certifications (w8)', () => {
    it('caps at 10 even with all three', () => {
      const result = calculateW(
        baseSocialItems({
          iso9001: true,
          iso14001: true,
          ecoAction21: true,
        })
      );
      expect(result.detail.w8).toBe(10); // min(10, 15)
    });

    it('gives 10 for two ISOs', () => {
      const result = calculateW(
        baseSocialItems({ iso9001: true, iso14001: true })
      );
      expect(result.detail.w8).toBe(10);
    });

    it('gives 5 for single ISO', () => {
      const result = calculateW(baseSocialItems({ iso9001: true }));
      expect(result.detail.w8).toBe(5);
    });

    it('gives 0 for no ISO', () => {
      expect(calculateW(baseSocialItems()).detail.w8).toBe(0);
    });
  });

  describe('W total and W score conversion', () => {
    it('W = floor(total * 1750 / 200)', () => {
      const result = calculateW(baseSocialItems());
      expect(result.W).toBe(Math.floor((result.total * 1750) / 200));
    });

    it('returns correct total as sum of w1..w8', () => {
      const result = calculateW(baseSocialItems());
      const { w1, w2, w3, w4, w5, w6, w7, w8 } = result.detail;
      expect(result.total).toBe(w1 + w2 + w3 + w4 + w5 + w6 + w7 + w8);
      expect(result.detail.total).toBe(result.total);
    });

    it('handles large positive total', () => {
      // Max out many items
      const result = calculateW(
        baseSocialItems({
          constructionRetirementMutualAid: true,
          retirementSystem: true,
          nonStatutoryAccidentInsurance: true,
          businessYears: 35,
          disasterAgreement: true,
          auditStatus: 4,
          certifiedAccountants: 5,
          firstClassAccountants: 5,
          secondClassAccountants: 5,
          rdExpense2YearAvg: 10000,
          completionAmount2YearAvg: 100000,
          constructionMachineCount: 20,
          iso9001: true,
          iso14001: true,
          ccusImplementation: 3,
          techStaffCount: 100,
          cpdTotalUnits: 3000,
          skillLevelUpCount: 20,
          wlbEruboshi: 4,
          wlbKurumin: 4,
          wlbYouth: 2,
        })
      );
      expect(result.total).toBeGreaterThan(0);
      expect(result.W).toBe(Math.floor((result.total * 1750) / 200));
    });

    it('handles negative total (all insurances missing + civil rehabilitation)', () => {
      const result = calculateW(
        baseSocialItems({
          employmentInsurance: false,
          healthInsurance: false,
          pensionInsurance: false,
          civilRehabilitation: true,
          suspensionOrder: true,
        })
      );
      // w1=-120, w2=-60, w4=-30, rest=0 → total=-210
      expect(result.total).toBe(-210);
      expect(result.W).toBe(Math.floor((-210 * 1750) / 200));
    });
  });
});

// ---------------------------------------------------------------------------
// Edge cases: calculateW with all items at maximum / all at zero
// ---------------------------------------------------------------------------
describe('calculateW edge cases', () => {
  it('all items at maximum values produces expected total and W', () => {
    const result = calculateW(
      baseSocialItems({
        employmentInsurance: true,
        healthInsurance: true,
        pensionInsurance: true,
        constructionRetirementMutualAid: true,
        retirementSystem: true,
        nonStatutoryAccidentInsurance: true,
        youngTechContinuous: true,
        youngTechNew: true,
        techStaffCount: 100,
        youngTechCount: 100,
        newYoungTechCount: 100,
        cpdTotalUnits: 3000,
        skillLevelUpCount: 100,
        skilledWorkerCount: 100,
        deductionTargetCount: 0,
        wlbEruboshi: 4,
        wlbKurumin: 4,
        wlbYouth: 2,
        ccusImplementation: 3,
        businessYears: 35,
        civilRehabilitation: false,
        disasterAgreement: true,
        suspensionOrder: false,
        instructionOrder: false,
        auditStatus: 4,
        certifiedAccountants: 10,
        firstClassAccountants: 10,
        secondClassAccountants: 10,
        rdExpense2YearAvg: 50000,
        completionAmount2YearAvg: 100000,
        constructionMachineCount: 20,
        iso9001: true,
        iso14001: true,
        ecoAction21: true,
      }),
    );
    // w1: 0(ins) +15+15+15 +1(youngCont) +1(youngNew) +10(cpd>=30) +10(skill>=0.15) +5(eruboshi4) +5(kurumin4) +4(youth2) +15(ccus3) = 96
    expect(result.detail.w1).toBe(96);
    // w2: 60 (>=35 years, no civil rehab)
    expect(result.detail.w2).toBe(60);
    // w3: 20 (disaster agreement)
    expect(result.detail.w3).toBe(20);
    // w4: 0 (no orders)
    expect(result.detail.w4).toBe(0);
    // w5: 20(audit4) + min(10, (10+10+10)*2) = 20 + 10 = 30
    expect(result.detail.w5).toBe(30);
    // w6: 25 (rdRatio = 50%)
    expect(result.detail.w6).toBe(25);
    // w7: 15 (capped)
    expect(result.detail.w7).toBe(15);
    // w8: 10 (capped)
    expect(result.detail.w8).toBe(10);
    expect(result.total).toBe(96 + 60 + 20 + 0 + 30 + 25 + 15 + 10);
    expect(result.W).toBe(Math.floor((result.total * 1750) / 200));
  });

  it('all items at zero/false (base case) returns zero total', () => {
    const result = calculateW(
      baseSocialItems({
        employmentInsurance: true,
        healthInsurance: true,
        pensionInsurance: true,
      }),
    );
    // All flags off except required insurances → no deductions, no bonuses
    expect(result.detail.w1).toBe(0);
    expect(result.detail.w2).toBe(0);
    expect(result.detail.w3).toBe(0);
    expect(result.detail.w4).toBe(0);
    expect(result.detail.w5).toBe(0);
    expect(result.detail.w6).toBe(0);
    expect(result.detail.w7).toBe(0);
    expect(result.detail.w8).toBe(0);
    expect(result.total).toBe(0);
    expect(result.W).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Edge cases: lookupScore at exact bracket boundaries
// ---------------------------------------------------------------------------
describe('lookupScore bracket boundary edge cases', () => {
  it('X1_TABLE at min of first bracket (value=0)', () => {
    // floor(131*0/10000)+397 = 397
    expect(lookupScore(X1_TABLE, 0)).toBe(397);
  });

  it('X1_TABLE at max-1 of last finite bracket (value=99999999)', () => {
    // Last finite bracket: min=50000000, max=100000000, a=50, b=50000000, c=1898
    // floor(50*99999999/50000000)+1898 = floor(99.999999)+1898 = 99+1898 = 1997
    expect(lookupScore(X1_TABLE, 99999999)).toBe(1997);
  });

  it('X1_TABLE at exact boundary between first and second bracket (value=10000)', () => {
    // Falls into second bracket: min=10000, max=12000, a=11, b=2000, c=473
    // floor(11*10000/2000)+473 = floor(55)+473 = 528
    expect(lookupScore(X1_TABLE, 10000)).toBe(528);
  });

  it('X21_TABLE at value=0 gives base score 361', () => {
    expect(lookupScore(X21_TABLE, 0)).toBe(361);
  });

  it('X22_TABLE at value=0 gives base score 547', () => {
    expect(lookupScore(X22_TABLE, 0)).toBe(547);
  });

  it('Z1_TABLE at value=0 gives base score 510', () => {
    expect(lookupScore(Z1_TABLE, 0)).toBe(510);
  });

  it('Z2_TABLE at value=0 gives base score 241', () => {
    expect(lookupScore(Z2_TABLE, 0)).toBe(241);
  });

  it('X1_TABLE score at value=0 gives minimum score for that table', () => {
    // value=0 should produce the smallest possible X1 score
    const scoreAt0 = lookupScore(X1_TABLE, 0);
    const scoreAt1 = lookupScore(X1_TABLE, 1);
    expect(scoreAt0).toBeLessThanOrEqual(scoreAt1);
    expect(scoreAt0).toBe(397);
  });
});

// ---------------------------------------------------------------------------
// getEffectiveMultiplier
// ---------------------------------------------------------------------------
describe('getEffectiveMultiplier', () => {
  it('returns 6 for 1級 + lecture + supervisor cert', () => {
    expect(getEffectiveMultiplier(127, 1, true)).toBe(6);
  });

  it('returns 5 for 1級 without lecture', () => {
    expect(getEffectiveMultiplier(127, 2, true)).toBe(5);
  });

  it('returns 5 for 1級 with lecture but no cert', () => {
    expect(getEffectiveMultiplier(127, 1, false)).toBe(5);
  });

  it('returns 2 for 2級 regardless of lecture/cert', () => {
    expect(getEffectiveMultiplier(155, 1, true)).toBe(2);
  });

  it('returns 1 for unknown qualification code', () => {
    expect(getEffectiveMultiplier(999, 1, true)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// calculateX1WithAverage (激変緩和措置)
// ---------------------------------------------------------------------------
describe('calculateX1WithAverage', () => {
  it('returns current year when no prev (single year)', () => {
    // With prev = 0, twoYearAvg = floor((100000+0)/2) = 50000
    // Max(100000, 50000) = 100000
    expect(calculateX1WithAverage(100000, 0)).toBe(100000);
  });

  it('returns 2-year average when higher than current', () => {
    // curr=80000, prev=120000 → twoYearAvg = floor(200000/2) = 100000
    // Max(80000, 100000) = 100000
    expect(calculateX1WithAverage(80000, 120000)).toBe(100000);
  });

  it('returns 3-year average when it is the highest', () => {
    // curr=60000, prev=90000, prevPrev=150000
    // twoYearAvg = floor(150000/2) = 75000
    // threeYearAvg = floor(300000/3) = 100000
    // Max(60000, 75000, 100000) = 100000
    expect(calculateX1WithAverage(60000, 90000, 150000)).toBe(100000);
  });

  it('returns current year when it is the highest (no averaging used)', () => {
    // curr=200000, prev=100000, prevPrev=50000
    // twoYearAvg = floor(300000/2) = 150000
    // threeYearAvg = floor(350000/3) = 116666
    // Max(200000, 150000, 116666) = 200000
    expect(calculateX1WithAverage(200000, 100000, 50000)).toBe(200000);
  });

  it('returns 2-year average as highest with 3 years of data', () => {
    // curr=100000, prev=200000, prevPrev=50000
    // twoYearAvg = floor(300000/2) = 150000
    // threeYearAvg = floor(350000/3) = 116666
    // Max(100000, 150000, 116666) = 150000
    expect(calculateX1WithAverage(100000, 200000, 50000)).toBe(150000);
  });

  it('handles equal values (no advantage to averaging)', () => {
    expect(calculateX1WithAverage(100000, 100000)).toBe(100000);
    expect(calculateX1WithAverage(100000, 100000, 100000)).toBe(100000);
  });

  it('floors the averages', () => {
    // curr=1, prev=2 → twoYearAvg = floor(3/2) = 1
    // Max(1, 1) = 1
    expect(calculateX1WithAverage(1, 2)).toBe(1);
    // curr=0, prev=1, prevPrev=1 → twoYearAvg=0, threeYearAvg=0
    // Max(0, 0, 0) = 0
    expect(calculateX1WithAverage(0, 1, 1)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Score table completeness verification
// ---------------------------------------------------------------------------
describe('Score table completeness — no gaps, valid coefficients', () => {
  const tables: { name: string; table: Bracket[] }[] = [
    { name: 'X1_TABLE', table: X1_TABLE },
    { name: 'X21_TABLE', table: X21_TABLE },
    { name: 'X22_TABLE', table: X22_TABLE },
    { name: 'Z1_TABLE', table: Z1_TABLE },
    { name: 'Z2_TABLE', table: Z2_TABLE },
  ];

  for (const { name, table } of tables) {
    describe(name, () => {
      it('has at least 2 brackets', () => {
        expect(table.length).toBeGreaterThanOrEqual(2);
      });

      it('has no gaps between consecutive brackets (max[N] === min[N+1])', () => {
        for (let i = 0; i < table.length - 1; i++) {
          expect(table[i].max).toBe(table[i + 1].min);
        }
      });

      it('last bracket ends at Infinity', () => {
        expect(table[table.length - 1].max).toBe(Infinity);
      });

      it('brackets are sorted in ascending order by min', () => {
        for (let i = 1; i < table.length; i++) {
          expect(table[i].min).toBeGreaterThanOrEqual(table[i - 1].min);
        }
      });

      it('all b values are positive (non-zero divisor)', () => {
        for (const bracket of table) {
          expect(bracket.b).toBeGreaterThan(0);
        }
      });

      it('all a values are non-negative', () => {
        for (const bracket of table) {
          expect(bracket.a).toBeGreaterThanOrEqual(0);
        }
      });

      it('each bracket min is strictly less than max', () => {
        for (const bracket of table) {
          expect(bracket.min).toBeLessThan(bracket.max);
        }
      });

      it('lookupScore returns a value for every bracket midpoint', () => {
        for (const bracket of table) {
          if (bracket.max === Infinity) {
            // Test at min for Infinity brackets
            expect(() => lookupScore(table, bracket.min)).not.toThrow();
          } else if (bracket.min === -Infinity) {
            // Test near max for -Infinity brackets
            expect(() => lookupScore(table, bracket.max - 1)).not.toThrow();
          } else {
            const mid = (bracket.min + bracket.max) / 2;
            expect(() => lookupScore(table, mid)).not.toThrow();
          }
        }
      });
    });
  }

  // Specific checks for tables that should start at specific minimums
  it('X1_TABLE first bracket starts at 0', () => {
    expect(X1_TABLE[0].min).toBe(0);
  });

  it('X21_TABLE first bracket starts at -Infinity (covers debt)', () => {
    expect(X21_TABLE[0].min).toBe(-Infinity);
  });

  it('X22_TABLE first bracket starts at -Infinity (covers losses)', () => {
    expect(X22_TABLE[0].min).toBe(-Infinity);
  });

  it('Z1_TABLE first bracket starts at 0', () => {
    expect(Z1_TABLE[0].min).toBe(0);
  });

  it('Z2_TABLE first bracket starts at 0', () => {
    expect(Z2_TABLE[0].min).toBe(0);
  });
});
