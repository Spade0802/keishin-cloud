import { describe, test, expect } from 'vitest';
import { calculateW, calculateP } from '@/lib/engine/p-calculator';
import type { SocialItems } from '@/lib/engine/types';

// ==========================================
// W score detailed integration tests
// ==========================================

/** Helper to create SocialItems with defaults */
function makeSocialItems(overrides: Partial<SocialItems> = {}): SocialItems {
  return {
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
    constructionMachineCount: 0,
    iso9001: false,
    iso14001: false,
    ecoAction21: false,
    ...overrides,
  };
}

// ==========================================
// Scenario 1: Maximum W score
// All social insurances, all ISO certs, max business years, etc.
// ==========================================
describe('W score: Maximum scenario (all items maxed)', () => {
  const items = makeSocialItems({
    // W1: social insurance (all 3 = no deduction)
    employmentInsurance: true,
    healthInsurance: true,
    pensionInsurance: true,
    // W1: retirement mutual aid (+15 each)
    constructionRetirementMutualAid: true,
    retirementSystem: true,
    nonStatutoryAccidentInsurance: true,
    // W1: young tech (ratio >= 0.15 → +1)
    youngTechContinuous: true,
    techStaffCount: 100,
    youngTechCount: 20, // 20/100 = 0.20 >= 0.15
    // W1: new young tech (+1)
    youngTechNew: true,
    newYoungTechCount: 3,
    // W1: CPD >= 30 per person → +10
    cpdTotalUnits: 3500, // 3500/100 = 35
    // W1: skill level up >= 0.15 → +10
    skillLevelUpCount: 20, // 20/100 = 0.20
    skilledWorkerCount: 50,
    deductionTargetCount: 0,
    // W1: WLB max
    wlbEruboshi: 4, // +5
    wlbKurumin: 4,  // +5
    wlbYouth: 2,    // +4
    // W1: CCUS max
    ccusImplementation: 3, // +15
    // W2: business years >= 35 → 60
    businessYears: 50,
    civilRehabilitation: false,
    // W3: disaster agreement → +20
    disasterAgreement: true,
    // W4: no violations
    suspensionOrder: false,
    instructionOrder: false,
    // W5: audit status 4 → +20, plus accountants
    auditStatus: 4,
    certifiedAccountants: 3,
    firstClassAccountants: 2,
    secondClassAccountants: 1,
    // W6: R&D ratio >= 5% → +25
    rdExpense2YearAvg: 60000,
    completionAmount2YearAvg: 1000000, // 60000/1000000 * 100 = 6%
    // W7: construction machines >= 15 → 15
    constructionMachineCount: 20,
    // W8: ISO (max 10 from any combo)
    iso9001: true,
    iso14001: true,
    ecoAction21: false,
  });

  const result = calculateW(items);

  test('W1 includes all social insurance bonuses (no deductions)', () => {
    // No deductions for insurance (all true)
    // +15 + 15 + 15 (retirement/accident)
    // +1 (young tech continuous)
    // +1 (young tech new)
    // +10 (CPD >= 30)
    // +10 (skill level up >= 0.15)
    // +5 (eruboshi 4)
    // +5 (kurumin 4)
    // +4 (youth 2)
    // +15 (CCUS 3)
    // Total w1 = 0 + 45 + 1 + 1 + 10 + 10 + 5 + 5 + 4 + 15 = 96
    expect(result.detail.w1).toBe(96);
  });

  test('W2 is 60 for business years >= 35', () => {
    expect(result.detail.w2).toBe(60);
  });

  test('W3 is 20 for disaster agreement', () => {
    expect(result.detail.w3).toBe(20);
  });

  test('W4 is 0 with no violations', () => {
    expect(result.detail.w4).toBe(0);
  });

  test('W5 includes audit status 4 and all accountants', () => {
    // audit=4 → +20, plus 3+2+1 = +6
    expect(result.detail.w5).toBe(26);
  });

  test('W6 is 25 for R&D ratio >= 5%', () => {
    expect(result.detail.w6).toBe(25);
  });

  test('W7 is 15 (capped) for 20 machines', () => {
    expect(result.detail.w7).toBe(15);
  });

  test('W8 is 10 (capped) for ISO9001 + ISO14001', () => {
    // 5 + 5 = 10, capped at 10
    expect(result.detail.w8).toBe(10);
  });

  test('Total raw W items sum correctly', () => {
    const expectedTotal = 96 + 60 + 20 + 0 + 26 + 25 + 15 + 10;
    expect(result.detail.total).toBe(expectedTotal);
    expect(result.total).toBe(expectedTotal);
  });

  test('W = total * 1750 / 200 (floor)', () => {
    expect(result.W).toBe(Math.floor((result.total * 1750) / 200));
  });

  test('W score is high (> 2000)', () => {
    expect(result.W).toBeGreaterThan(2000);
  });
});

// ==========================================
// Scenario 2: Minimum W score
// No insurance, civil rehabilitation, violations
// ==========================================
describe('W score: Minimum scenario (no insurance, civil rehab)', () => {
  const items = makeSocialItems({
    // W1: all insurance missing → -40 each = -120
    employmentInsurance: false,
    healthInsurance: false,
    pensionInsurance: false,
    // W2: civil rehabilitation → -60
    civilRehabilitation: true,
    businessYears: 40, // ignored due to civil rehab
    // W4: suspension order → -30
    suspensionOrder: true,
  });

  const result = calculateW(items);

  test('W1 is -120 for missing all social insurance', () => {
    expect(result.detail.w1).toBe(-120);
  });

  test('W2 is -60 for civil rehabilitation', () => {
    expect(result.detail.w2).toBe(-60);
  });

  test('W3 is 0 (no disaster agreement)', () => {
    expect(result.detail.w3).toBe(0);
  });

  test('W4 is -30 for suspension order', () => {
    expect(result.detail.w4).toBe(-30);
  });

  test('W5 through W8 are 0', () => {
    expect(result.detail.w5).toBe(0);
    expect(result.detail.w6).toBe(0);
    expect(result.detail.w7).toBe(0);
    expect(result.detail.w8).toBe(0);
  });

  test('Total is deeply negative', () => {
    expect(result.total).toBe(-120 + -60 + 0 + -30 + 0 + 0 + 0 + 0);
    expect(result.total).toBe(-210);
  });

  test('W = total * 1750 / 200 (floor), negative', () => {
    expect(result.W).toBe(Math.floor((-210 * 1750) / 200));
  });

  test('W score is negative', () => {
    expect(result.W).toBeLessThan(0);
  });
});

// ==========================================
// Scenario 3: Typical medium company
// ==========================================
describe('W score: Typical medium company with mixed items', () => {
  const items = makeSocialItems({
    employmentInsurance: true,
    healthInsurance: true,
    pensionInsurance: true,
    constructionRetirementMutualAid: true,
    retirementSystem: true,
    nonStatutoryAccidentInsurance: false,
    youngTechContinuous: true,
    techStaffCount: 30,
    youngTechCount: 5, // 5/30 ~ 0.167 >= 0.15
    youngTechNew: false,
    newYoungTechCount: 0,
    cpdTotalUnits: 600, // 600/30 = 20, >= 15 → +5
    skillLevelUpCount: 2, // 2/30 ~ 0.067 >= 0.05 → +3
    wlbEruboshi: 2, // +2
    wlbKurumin: 1, // +1
    wlbYouth: 0,
    ccusImplementation: 1, // +5
    businessYears: 25, // (25-5)*2 = 40
    civilRehabilitation: false,
    disasterAgreement: true, // +20
    suspensionOrder: false,
    instructionOrder: false,
    auditStatus: 2, // +8
    certifiedAccountants: 0,
    firstClassAccountants: 1, // +1
    secondClassAccountants: 0,
    rdExpense2YearAvg: 0,
    constructionMachineCount: 3, // +3
    iso9001: true, // +5
    iso14001: false,
    ecoAction21: false,
  });

  const result = calculateW(items);

  test('W1 calculation for medium company', () => {
    // insurance: no deductions
    // retirement: +15, +15 (no accident ins)
    // young tech continuous: ratio 5/30 ~ 0.167 >= 0.15 → +1
    // CPD 20 per person >= 15 → +5
    // skill ratio ~0.067 >= 0.05 → +3
    // eruboshi 2 → +2
    // kurumin 1 → +1
    // CCUS 1 → +5
    // Total w1 = 30 + 1 + 5 + 3 + 2 + 1 + 5 = 47
    expect(result.detail.w1).toBe(47);
  });

  test('W2 = (25-5)*2 = 40', () => {
    expect(result.detail.w2).toBe(40);
  });

  test('W3 = 20 (disaster agreement)', () => {
    expect(result.detail.w3).toBe(20);
  });

  test('W5 = 8 (audit) + 1 (first class) = 9', () => {
    expect(result.detail.w5).toBe(9);
  });

  test('W7 = 3 (machines)', () => {
    expect(result.detail.w7).toBe(3);
  });

  test('W8 = 5 (ISO9001 only)', () => {
    expect(result.detail.w8).toBe(5);
  });

  test('Total and W conversion', () => {
    const expectedTotal = 47 + 40 + 20 + 0 + 9 + 0 + 3 + 5;
    expect(result.total).toBe(expectedTotal);
    expect(result.W).toBe(Math.floor((expectedTotal * 1750) / 200));
  });

  test('W is in reasonable range for medium company (500-1500)', () => {
    expect(result.W).toBeGreaterThanOrEqual(500);
    expect(result.W).toBeLessThanOrEqual(1500);
  });
});

// ==========================================
// W * 1750/200 conversion verification
// ==========================================
describe('W conversion formula (total * 1750 / 200)', () => {
  test('Conversion is always floor division', () => {
    // Test with a value where the division is not exact
    const items = makeSocialItems({
      employmentInsurance: true,
      healthInsurance: true,
      pensionInsurance: true,
      businessYears: 10, // (10-5)*2 = 10
    });
    const result = calculateW(items);
    // total = 0 + 10 = 10
    // W = floor(10 * 1750 / 200) = floor(87.5) = 87
    expect(result.W).toBe(Math.floor((result.total * 1750) / 200));
    expect(result.W).toBe(87);
  });

  test('W = 0 when total = 0', () => {
    // All insurance present but businessYears <= 5
    const items = makeSocialItems({
      employmentInsurance: true,
      healthInsurance: true,
      pensionInsurance: true,
      businessYears: 5,
    });
    const result = calculateW(items);
    expect(result.total).toBe(0);
    expect(result.W).toBe(0);
  });

  test('Negative total produces negative W', () => {
    // Missing one insurance
    const items = makeSocialItems({
      employmentInsurance: false,
      healthInsurance: true,
      pensionInsurance: true,
      businessYears: 5,
    });
    const result = calculateW(items);
    expect(result.total).toBe(-40);
    expect(result.W).toBe(Math.floor((-40 * 1750) / 200));
    expect(result.W).toBe(-350);
  });
});

// ==========================================
// W score bounds in P calculation context
// ==========================================
describe('W score within P calculation bounds', () => {
  test('Maximum W scenario produces valid P', () => {
    const maxItems = makeSocialItems({
      employmentInsurance: true,
      healthInsurance: true,
      pensionInsurance: true,
      constructionRetirementMutualAid: true,
      retirementSystem: true,
      nonStatutoryAccidentInsurance: true,
      youngTechContinuous: true,
      youngTechNew: true,
      techStaffCount: 100,
      youngTechCount: 20,
      newYoungTechCount: 5,
      cpdTotalUnits: 4000,
      skillLevelUpCount: 20,
      wlbEruboshi: 4,
      wlbKurumin: 4,
      wlbYouth: 2,
      ccusImplementation: 3,
      businessYears: 50,
      disasterAgreement: true,
      auditStatus: 4,
      certifiedAccountants: 3,
      firstClassAccountants: 2,
      secondClassAccountants: 1,
      rdExpense2YearAvg: 60000,
      completionAmount2YearAvg: 1000000,
      constructionMachineCount: 20,
      iso9001: true,
      iso14001: true,
      ecoAction21: true,
    });
    const wResult = calculateW(maxItems);

    // Use moderate values for other P components
    const P = calculateP(800, 700, 800, 800, wResult.W);
    expect(P).toBeGreaterThanOrEqual(6);
    expect(P).toBeLessThanOrEqual(2160);
  });

  test('Minimum W scenario still produces valid P', () => {
    const minItems = makeSocialItems({
      civilRehabilitation: true,
      suspensionOrder: true,
    });
    const wResult = calculateW(minItems);

    const P = calculateP(500, 500, 500, 500, wResult.W);
    expect(P).toBeGreaterThanOrEqual(6);
    expect(P).toBeLessThanOrEqual(2160);
  });
});
