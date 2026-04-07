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
    // audit=4 → +20, plus min(10, (3+2+1)*2) = min(10, 12) = +10
    expect(result.detail.w5).toBe(30);
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
    const expectedTotal = 96 + 60 + 20 + 0 + 30 + 25 + 15 + 10;
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

  test('W5 = 8 (audit) + min(10, 1*2) = 10', () => {
    expect(result.detail.w5).toBe(10);
  });

  test('W7 = 3 (machines)', () => {
    expect(result.detail.w7).toBe(3);
  });

  test('W8 = 5 (ISO9001 only)', () => {
    expect(result.detail.w8).toBe(5);
  });

  test('Total and W conversion', () => {
    const expectedTotal = 47 + 40 + 20 + 0 + 10 + 0 + 3 + 5;
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
// Scenario 4: All W sub-items individually toggled on/off
// Verify each item contributes the expected delta
// ==========================================
describe('W score: Individual sub-item toggle tests', () => {
  /** Baseline: all insurance present, nothing else */
  const baseline = makeSocialItems({
    employmentInsurance: true,
    healthInsurance: true,
    pensionInsurance: true,
  });
  const baseResult = calculateW(baseline);

  // --- W1: Social insurance deductions ---
  test('Missing employmentInsurance deducts -40 from W1', () => {
    const items = makeSocialItems({ ...baseline, employmentInsurance: false });
    const r = calculateW(items);
    expect(r.detail.w1 - baseResult.detail.w1).toBe(-40);
  });

  test('Missing healthInsurance deducts -40 from W1', () => {
    const items = makeSocialItems({ ...baseline, healthInsurance: false });
    const r = calculateW(items);
    expect(r.detail.w1 - baseResult.detail.w1).toBe(-40);
  });

  test('Missing pensionInsurance deducts -40 from W1', () => {
    const items = makeSocialItems({ ...baseline, pensionInsurance: false });
    const r = calculateW(items);
    expect(r.detail.w1 - baseResult.detail.w1).toBe(-40);
  });

  // --- W1: Retirement / accident insurance bonuses ---
  test('constructionRetirementMutualAid adds +15', () => {
    const items = makeSocialItems({ ...baseline, constructionRetirementMutualAid: true });
    const r = calculateW(items);
    expect(r.detail.w1 - baseResult.detail.w1).toBe(15);
  });

  test('retirementSystem adds +15', () => {
    const items = makeSocialItems({ ...baseline, retirementSystem: true });
    const r = calculateW(items);
    expect(r.detail.w1 - baseResult.detail.w1).toBe(15);
  });

  test('nonStatutoryAccidentInsurance adds +15', () => {
    const items = makeSocialItems({ ...baseline, nonStatutoryAccidentInsurance: true });
    const r = calculateW(items);
    expect(r.detail.w1 - baseResult.detail.w1).toBe(15);
  });

  // --- W1: Young tech continuous ---
  test('youngTechContinuous with ratio >= 0.15 adds +1', () => {
    const items = makeSocialItems({
      ...baseline,
      youngTechContinuous: true,
      techStaffCount: 20,
      youngTechCount: 3, // 3/20 = 0.15
    });
    const r = calculateW(items);
    expect(r.detail.w1 - baseResult.detail.w1).toBe(1);
  });

  test('youngTechContinuous with ratio < 0.15 adds nothing', () => {
    const items = makeSocialItems({
      ...baseline,
      youngTechContinuous: true,
      techStaffCount: 20,
      youngTechCount: 2, // 2/20 = 0.10 < 0.15
    });
    const r = calculateW(items);
    expect(r.detail.w1 - baseResult.detail.w1).toBe(0);
  });

  test('youngTechContinuous with techStaffCount=0 adds nothing', () => {
    const items = makeSocialItems({
      ...baseline,
      youngTechContinuous: true,
      techStaffCount: 0,
      youngTechCount: 5,
    });
    const r = calculateW(items);
    expect(r.detail.w1 - baseResult.detail.w1).toBe(0);
  });

  // --- W1: New young tech ---
  test('youngTechNew with newYoungTechCount > 0 adds +1', () => {
    const items = makeSocialItems({
      ...baseline,
      youngTechNew: true,
      newYoungTechCount: 1,
    });
    const r = calculateW(items);
    expect(r.detail.w1 - baseResult.detail.w1).toBe(1);
  });

  test('youngTechNew with newYoungTechCount=0 adds nothing', () => {
    const items = makeSocialItems({
      ...baseline,
      youngTechNew: true,
      newYoungTechCount: 0,
    });
    const r = calculateW(items);
    expect(r.detail.w1 - baseResult.detail.w1).toBe(0);
  });

  // --- W1: CPD tiers ---
  test.each([
    { units: 600, staff: 20, expected: 10, label: 'CPD >= 30/person -> +10' },
    { units: 400, staff: 20, expected: 5, label: 'CPD >= 15/person -> +5' },
    { units: 120, staff: 20, expected: 3, label: 'CPD >= 5/person -> +3' },
    { units: 30, staff: 20, expected: 1, label: 'CPD >= 1/person -> +1' },
    { units: 0, staff: 20, expected: 0, label: 'CPD 0/person -> +0' },
  ])('$label', ({ units, staff, expected }) => {
    const items = makeSocialItems({
      ...baseline,
      techStaffCount: staff,
      cpdTotalUnits: units,
    });
    const r = calculateW(items);
    expect(r.detail.w1 - baseResult.detail.w1).toBe(expected);
  });

  // --- W1: Skill level up tiers ---
  test.each([
    { count: 4, staff: 20, expected: 10, label: 'skill >= 0.15 -> +10' },
    { count: 2, staff: 20, expected: 7, label: 'skill 2/20=0.10 >= 0.10 -> +7' },
    { count: 3, staff: 20, expected: 10, label: 'skill 3/20=0.15 -> +10' },
    { count: 2, staff: 19, expected: 7, label: 'skill 2/19~0.105 >= 0.10 -> +7' },
    { count: 1, staff: 20, expected: 3, label: 'skill 1/20=0.05 >= 0.05 -> +3' },
    { count: 0, staff: 20, expected: 0, label: 'skill 0 -> +0' },
  ])('$label', ({ count, staff, expected }) => {
    const items = makeSocialItems({
      ...baseline,
      techStaffCount: staff,
      skillLevelUpCount: count,
    });
    const r = calculateW(items);
    expect(r.detail.w1 - baseResult.detail.w1).toBe(expected);
  });

  // --- W1: WLB Eruboshi tiers ---
  test.each([
    { level: 0, expected: 0 },
    { level: 1, expected: 1 },
    { level: 2, expected: 2 },
    { level: 3, expected: 3 },
    { level: 4, expected: 5 },
  ])('wlbEruboshi=$level -> +$expected', ({ level, expected }) => {
    const items = makeSocialItems({ ...baseline, wlbEruboshi: level });
    const r = calculateW(items);
    expect(r.detail.w1 - baseResult.detail.w1).toBe(expected);
  });

  // --- W1: WLB Kurumin tiers ---
  test.each([
    { level: 0, expected: 0 },
    { level: 1, expected: 1 },
    { level: 2, expected: 2 },
    { level: 3, expected: 3 },
    { level: 4, expected: 5 },
  ])('wlbKurumin=$level -> +$expected', ({ level, expected }) => {
    const items = makeSocialItems({ ...baseline, wlbKurumin: level });
    const r = calculateW(items);
    expect(r.detail.w1 - baseResult.detail.w1).toBe(expected);
  });

  // --- W1: Youth tiers ---
  test.each([
    { level: 0, expected: 0 },
    { level: 1, expected: 2 },
    { level: 2, expected: 4 },
  ])('wlbYouth=$level -> +$expected', ({ level, expected }) => {
    const items = makeSocialItems({ ...baseline, wlbYouth: level });
    const r = calculateW(items);
    expect(r.detail.w1 - baseResult.detail.w1).toBe(expected);
  });

  // --- W1: CCUS tiers ---
  test.each([
    { level: 0, expected: 0 },
    { level: 1, expected: 5 },
    { level: 2, expected: 10 },
    { level: 3, expected: 15 },
  ])('ccusImplementation=$level -> +$expected', ({ level, expected }) => {
    const items = makeSocialItems({ ...baseline, ccusImplementation: level });
    const r = calculateW(items);
    expect(r.detail.w1 - baseResult.detail.w1).toBe(expected);
  });

  // --- W2: Business years ---
  test.each([
    { years: 0, expected: 0, label: 'years=0 -> 0' },
    { years: 5, expected: 0, label: 'years=5 -> 0' },
    { years: 6, expected: 2, label: 'years=6 -> (6-5)*2=2' },
    { years: 20, expected: 30, label: 'years=20 -> (20-5)*2=30' },
    { years: 34, expected: 58, label: 'years=34 -> (34-5)*2=58' },
    { years: 35, expected: 60, label: 'years=35 -> 60 (cap)' },
    { years: 100, expected: 60, label: 'years=100 -> 60 (cap)' },
  ])('W2: $label', ({ years, expected }) => {
    const items = makeSocialItems({ ...baseline, businessYears: years });
    const r = calculateW(items);
    expect(r.detail.w2).toBe(expected);
  });

  test('W2: civilRehabilitation overrides businessYears to -60', () => {
    const items = makeSocialItems({ ...baseline, civilRehabilitation: true, businessYears: 50 });
    const r = calculateW(items);
    expect(r.detail.w2).toBe(-60);
  });

  // --- W3: Disaster agreement ---
  test('W3: disasterAgreement=true -> 20', () => {
    const r = calculateW(makeSocialItems({ ...baseline, disasterAgreement: true }));
    expect(r.detail.w3).toBe(20);
  });

  test('W3: disasterAgreement=false -> 0', () => {
    const r = calculateW(makeSocialItems({ ...baseline, disasterAgreement: false }));
    expect(r.detail.w3).toBe(0);
  });

  // --- W4: Violations ---
  test('W4: suspensionOrder=true -> -30', () => {
    const r = calculateW(makeSocialItems({ ...baseline, suspensionOrder: true }));
    expect(r.detail.w4).toBe(-30);
  });

  test('W4: instructionOrder=true -> -15', () => {
    const r = calculateW(makeSocialItems({ ...baseline, instructionOrder: true }));
    expect(r.detail.w4).toBe(-15);
  });

  test('W4: suspensionOrder takes priority over instructionOrder', () => {
    const r = calculateW(makeSocialItems({ ...baseline, suspensionOrder: true, instructionOrder: true }));
    expect(r.detail.w4).toBe(-30);
  });

  test('W4: no violations -> 0', () => {
    const r = calculateW(makeSocialItems({ ...baseline }));
    expect(r.detail.w4).toBe(0);
  });

  // --- W5: Audit status + accountants ---
  test.each([
    { status: 0, expected: 0 },
    { status: 1, expected: 4 },
    { status: 2, expected: 8 },
    { status: 3, expected: 14 },
    { status: 4, expected: 20 },
  ])('W5: auditStatus=$status -> +$expected', ({ status, expected }) => {
    const r = calculateW(makeSocialItems({ ...baseline, auditStatus: status }));
    expect(r.detail.w5).toBe(expected);
  });

  test('W5: accountants add linearly', () => {
    const r = calculateW(makeSocialItems({
      ...baseline,
      certifiedAccountants: 2,
      firstClassAccountants: 3,
      secondClassAccountants: 4,
    }));
    // New formula: min(10, (2+3+4)*2) = min(10, 18) = 10
    expect(r.detail.w5).toBe(10);
  });

  // --- W7: Construction machines ---
  test.each([
    { count: 0, expected: 0 },
    { count: 1, expected: 1 },
    { count: 14, expected: 14 },
    { count: 15, expected: 15 },
    { count: 100, expected: 15 },
  ])('W7: $count machines -> $expected', ({ count, expected }) => {
    const r = calculateW(makeSocialItems({ ...baseline, constructionMachineCount: count }));
    expect(r.detail.w7).toBe(expected);
  });

  // --- W8: ISO combinations ---
  test.each([
    { iso9001: false, iso14001: false, ecoAction21: false, expected: 0 },
    { iso9001: true, iso14001: false, ecoAction21: false, expected: 5 },
    { iso9001: false, iso14001: true, ecoAction21: false, expected: 5 },
    { iso9001: false, iso14001: false, ecoAction21: true, expected: 5 },
    { iso9001: true, iso14001: true, ecoAction21: false, expected: 10 },
    { iso9001: true, iso14001: false, ecoAction21: true, expected: 10 },
    { iso9001: false, iso14001: true, ecoAction21: true, expected: 10 },
    { iso9001: true, iso14001: true, ecoAction21: true, expected: 10 }, // capped at 10
  ])('W8: iso9001=$iso9001, iso14001=$iso14001, ecoAction21=$ecoAction21 -> $expected', (params) => {
    const r = calculateW(makeSocialItems({ ...baseline, ...params }));
    expect(r.detail.w8).toBe(params.expected);
  });
});

// ==========================================
// W6: R&D ratio edge cases
// ==========================================
describe('W score: W6 R&D ratio edge cases', () => {
  const baseline = makeSocialItems({
    employmentInsurance: true,
    healthInsurance: true,
    pensionInsurance: true,
  });

  test('W6 = 0 when completionAmount2YearAvg is 0 (zero revenue)', () => {
    const items = makeSocialItems({
      ...baseline,
      rdExpense2YearAvg: 50000,
      completionAmount2YearAvg: 0,
    });
    const r = calculateW(items);
    expect(r.detail.w6).toBe(0);
  });

  test('W6 = 0 when completionAmount2YearAvg is undefined', () => {
    const items = makeSocialItems({
      ...baseline,
      rdExpense2YearAvg: 50000,
    });
    // completionAmount2YearAvg defaults to undefined
    const r = calculateW(items);
    expect(r.detail.w6).toBe(0);
  });

  test('W6 = 0 when rdExpense2YearAvg is 0', () => {
    const items = makeSocialItems({
      ...baseline,
      rdExpense2YearAvg: 0,
      completionAmount2YearAvg: 1000000,
    });
    const r = calculateW(items);
    expect(r.detail.w6).toBe(0);
  });

  test('W6 = 0 when ratio < 1%', () => {
    const items = makeSocialItems({
      ...baseline,
      rdExpense2YearAvg: 9000,
      completionAmount2YearAvg: 1000000, // 0.9%
    });
    const r = calculateW(items);
    expect(r.detail.w6).toBe(0);
  });

  test('W6 = 5 when ratio is exactly 1%', () => {
    const items = makeSocialItems({
      ...baseline,
      rdExpense2YearAvg: 10000,
      completionAmount2YearAvg: 1000000, // 1.0%
    });
    const r = calculateW(items);
    expect(r.detail.w6).toBe(5);
  });

  test('W6 = 5 when ratio is 2.99%', () => {
    const items = makeSocialItems({
      ...baseline,
      rdExpense2YearAvg: 29900,
      completionAmount2YearAvg: 1000000, // 2.99%
    });
    const r = calculateW(items);
    expect(r.detail.w6).toBe(5);
  });

  test('W6 = 15 when ratio is exactly 3%', () => {
    const items = makeSocialItems({
      ...baseline,
      rdExpense2YearAvg: 30000,
      completionAmount2YearAvg: 1000000, // 3.0%
    });
    const r = calculateW(items);
    expect(r.detail.w6).toBe(15);
  });

  test('W6 = 15 when ratio is 4.99%', () => {
    const items = makeSocialItems({
      ...baseline,
      rdExpense2YearAvg: 49900,
      completionAmount2YearAvg: 1000000, // 4.99%
    });
    const r = calculateW(items);
    expect(r.detail.w6).toBe(15);
  });

  test('W6 = 25 when ratio is exactly 5%', () => {
    const items = makeSocialItems({
      ...baseline,
      rdExpense2YearAvg: 50000,
      completionAmount2YearAvg: 1000000, // 5.0%
    });
    const r = calculateW(items);
    expect(r.detail.w6).toBe(25);
  });

  test('W6 = 25 when ratio is very high (50%)', () => {
    const items = makeSocialItems({
      ...baseline,
      rdExpense2YearAvg: 500000,
      completionAmount2YearAvg: 1000000, // 50%
    });
    const r = calculateW(items);
    expect(r.detail.w6).toBe(25);
  });

  test('W6 = 25 when R&D exceeds revenue (ratio > 100%)', () => {
    const items = makeSocialItems({
      ...baseline,
      rdExpense2YearAvg: 2000000,
      completionAmount2YearAvg: 1000000, // 200%
    });
    const r = calculateW(items);
    expect(r.detail.w6).toBe(25);
  });

  test('W6 with very small revenue (denominator near zero)', () => {
    const items = makeSocialItems({
      ...baseline,
      rdExpense2YearAvg: 1,
      completionAmount2YearAvg: 1, // 100%
    });
    const r = calculateW(items);
    expect(r.detail.w6).toBe(25);
  });
});

// ==========================================
// W score with all possible bonus items enabled
// ==========================================
describe('W score: All bonus items enabled (theoretical maximum)', () => {
  const maxItems = makeSocialItems({
    // W1: no insurance deductions
    employmentInsurance: true,
    healthInsurance: true,
    pensionInsurance: true,
    // W1: all retirement/accident (+45)
    constructionRetirementMutualAid: true,
    retirementSystem: true,
    nonStatutoryAccidentInsurance: true,
    // W1: young tech (+1)
    youngTechContinuous: true,
    techStaffCount: 100,
    youngTechCount: 20, // 20%
    // W1: new young tech (+1)
    youngTechNew: true,
    newYoungTechCount: 5,
    // W1: CPD max (+10)
    cpdTotalUnits: 5000, // 50/person
    // W1: skill level max (+10)
    skillLevelUpCount: 20, // 20%
    // W1: WLB max (5+5+4=14)
    wlbEruboshi: 4,
    wlbKurumin: 4,
    wlbYouth: 2,
    // W1: CCUS max (+15)
    ccusImplementation: 3,
    // W2: max business years (+60)
    businessYears: 50,
    civilRehabilitation: false,
    // W3: disaster (+20)
    disasterAgreement: true,
    // W4: no violations (0)
    suspensionOrder: false,
    instructionOrder: false,
    // W5: max audit (+20) + many accountants
    auditStatus: 4,
    certifiedAccountants: 5,
    firstClassAccountants: 5,
    secondClassAccountants: 5,
    // W6: R&D max (+25)
    rdExpense2YearAvg: 100000,
    completionAmount2YearAvg: 1000000, // 10%
    // W7: machines max (+15)
    constructionMachineCount: 30,
    // W8: ISO max (+10 capped)
    iso9001: true,
    iso14001: true,
    ecoAction21: true,
  });

  const result = calculateW(maxItems);

  test('W1 is maximized', () => {
    // 0 (insurance) + 45 (retirement) + 1 + 1 + 10 + 10 + 5 + 5 + 4 + 15 = 96
    expect(result.detail.w1).toBe(96);
  });

  test('W2 is maximized at 60', () => {
    expect(result.detail.w2).toBe(60);
  });

  test('W3 is maximized at 20', () => {
    expect(result.detail.w3).toBe(20);
  });

  test('W4 is 0 (best case)', () => {
    expect(result.detail.w4).toBe(0);
  });

  test('W5 is maximized (audit + accountants)', () => {
    // 20 + min(10, 15*2) = 20 + 10 = 30
    expect(result.detail.w5).toBe(30);
  });

  test('W6 is maximized at 25', () => {
    expect(result.detail.w6).toBe(25);
  });

  test('W7 is maximized at 15', () => {
    expect(result.detail.w7).toBe(15);
  });

  test('W8 is maximized at 10', () => {
    expect(result.detail.w8).toBe(10);
  });

  test('Total is sum of all max sub-items', () => {
    const expected = 96 + 60 + 20 + 0 + 30 + 25 + 15 + 10;
    expect(result.detail.total).toBe(expected);
    expect(result.detail.total).toBe(256);
  });

  test('W conversion of max total', () => {
    expect(result.W).toBe(Math.floor((256 * 1750) / 200));
    expect(result.W).toBe(2240);
  });
});

// ==========================================
// W score with all penalty items
// ==========================================
describe('W score: All penalty items (theoretical minimum)', () => {
  const minItems = makeSocialItems({
    // W1: all insurance missing (-120)
    employmentInsurance: false,
    healthInsurance: false,
    pensionInsurance: false,
    // W2: civil rehabilitation (-60)
    civilRehabilitation: true,
    businessYears: 50,
    // W3: no disaster (0)
    disasterAgreement: false,
    // W4: suspension order (-30)
    suspensionOrder: true,
    instructionOrder: true, // ignored because suspension takes priority
    // W5-W8: all zero
  });

  const result = calculateW(minItems);

  test('W1 is -120 (all insurance missing)', () => {
    expect(result.detail.w1).toBe(-120);
  });

  test('W2 is -60 (civil rehabilitation)', () => {
    expect(result.detail.w2).toBe(-60);
  });

  test('W3 is 0', () => {
    expect(result.detail.w3).toBe(0);
  });

  test('W4 is -30 (suspension order)', () => {
    expect(result.detail.w4).toBe(-30);
  });

  test('W5 through W8 are all 0', () => {
    expect(result.detail.w5).toBe(0);
    expect(result.detail.w6).toBe(0);
    expect(result.detail.w7).toBe(0);
    expect(result.detail.w8).toBe(0);
  });

  test('Total is -210 (worst case)', () => {
    expect(result.detail.total).toBe(-210);
  });

  test('W conversion of min total', () => {
    expect(result.W).toBe(Math.floor((-210 * 1750) / 200));
    expect(result.W).toBe(-1838);
  });
});

// ==========================================
// W score sensitivity analysis
// Which items have the biggest impact on the final W?
// ==========================================
describe('W score: Sensitivity analysis', () => {
  /** Start from a neutral baseline (insurance present, nothing else) */
  const baseline = makeSocialItems({
    employmentInsurance: true,
    healthInsurance: true,
    pensionInsurance: true,
    businessYears: 5,
  });
  const baseW = calculateW(baseline).W;

  /**
   * Helper: compute the delta in final W from toggling a single change.
   */
  function deltaW(overrides: Partial<SocialItems>): number {
    return calculateW(makeSocialItems({ ...baseline, ...overrides })).W - baseW;
  }

  function convertToW(rawDelta: number): number {
    return Math.floor(((rawDelta) * 1750) / 200);
  }

  test('Missing one social insurance is the single largest negative impact (-40 raw)', () => {
    const d = deltaW({ employmentInsurance: false });
    // -40 raw -> floor(-40 * 1750 / 200) = -350 W
    expect(d).toBe(-350);
  });

  test('Civil rehabilitation is the largest W2 penalty (-60 raw)', () => {
    const d = deltaW({ civilRehabilitation: true });
    // -60 raw -> floor(-60 * 1750 / 200) = -525
    expect(d).toBe(-525);
  });

  test('Suspension order is a significant penalty (-30 raw)', () => {
    const d = deltaW({ suspensionOrder: true });
    // -> floor(-30 * 1750/200) = -262 (floor of -262.5)
    expect(d).toBe(-263);
  });

  test('Business years from 5 to 35 is a large positive (+60 raw)', () => {
    const d = deltaW({ businessYears: 35 });
    expect(d).toBe(convertToW(60));
    expect(d).toBe(525);
  });

  test('All 3 retirement/accident insurances together (+45 raw)', () => {
    const d = deltaW({
      constructionRetirementMutualAid: true,
      retirementSystem: true,
      nonStatutoryAccidentInsurance: true,
    });
    expect(d).toBe(convertToW(45));
  });

  test('R&D at 5% ratio is valuable (+25 raw)', () => {
    const d = deltaW({
      rdExpense2YearAvg: 50000,
      completionAmount2YearAvg: 1000000,
    });
    expect(d).toBe(convertToW(25));
  });

  test('Disaster agreement is moderate (+20 raw)', () => {
    const d = deltaW({ disasterAgreement: true });
    expect(d).toBe(convertToW(20));
  });

  test('Audit status 4 is moderate (+20 raw)', () => {
    const d = deltaW({ auditStatus: 4 });
    expect(d).toBe(convertToW(20));
  });

  test('CCUS level 3 is significant (+15 raw)', () => {
    const d = deltaW({ ccusImplementation: 3 });
    expect(d).toBe(convertToW(15));
  });

  test('15+ construction machines is moderate (+15 raw)', () => {
    const d = deltaW({ constructionMachineCount: 15 });
    expect(d).toBe(convertToW(15));
  });

  test('ISO 9001+14001 combo is moderate (+10 raw)', () => {
    const d = deltaW({ iso9001: true, iso14001: true });
    expect(d).toBe(convertToW(10));
  });

  test('WLB full combo (eruboshi 4 + kurumin 4 + youth 2) adds +14 raw', () => {
    const d = deltaW({ wlbEruboshi: 4, wlbKurumin: 4, wlbYouth: 2 });
    expect(d).toBe(convertToW(14));
  });

  test('CPD max (+10 raw) requires tech staff', () => {
    const d = deltaW({ techStaffCount: 10, cpdTotalUnits: 400 }); // 40/person
    expect(d).toBe(convertToW(10));
  });

  test('Ranking: civil rehab > missing insurance > suspension > business years (as negatives/positives)', () => {
    const civilRehabDelta = Math.abs(deltaW({ civilRehabilitation: true }));
    const missingInsuranceDelta = Math.abs(deltaW({ employmentInsurance: false }));
    const suspensionDelta = Math.abs(deltaW({ suspensionOrder: true }));
    const businessYearsDelta = deltaW({ businessYears: 35 });

    // Civil rehabilitation (-525) > business years (+525) in magnitude, but equal
    expect(civilRehabDelta).toBe(businessYearsDelta);
    // Missing insurance (-350) > suspension (-263)
    expect(missingInsuranceDelta).toBeGreaterThan(suspensionDelta);
    // Civil rehab is the single biggest raw impact
    expect(civilRehabDelta).toBeGreaterThan(missingInsuranceDelta);
  });

  test('Full negative scenario delta from baseline', () => {
    const d = deltaW({
      employmentInsurance: false,
      healthInsurance: false,
      pensionInsurance: false,
      civilRehabilitation: true,
      suspensionOrder: true,
    });
    // -120 + -60 + -30 = -210 raw from baseline 0
    // floor(-210 * 1750 / 200) = floor(-1837.5) = -1838
    expect(d).toBe(-1838);
  });

  test('Full positive scenario delta from baseline', () => {
    const d = deltaW({
      constructionRetirementMutualAid: true,
      retirementSystem: true,
      nonStatutoryAccidentInsurance: true,
      youngTechContinuous: true,
      youngTechNew: true,
      techStaffCount: 100,
      youngTechCount: 20,
      newYoungTechCount: 5,
      cpdTotalUnits: 5000,
      skillLevelUpCount: 20,
      wlbEruboshi: 4,
      wlbKurumin: 4,
      wlbYouth: 2,
      ccusImplementation: 3,
      businessYears: 50,
      disasterAgreement: true,
      auditStatus: 4,
      certifiedAccountants: 5,
      firstClassAccountants: 5,
      secondClassAccountants: 5,
      rdExpense2YearAvg: 100000,
      completionAmount2YearAvg: 1000000,
      constructionMachineCount: 30,
      iso9001: true,
      iso14001: true,
      ecoAction21: true,
    });
    // 96 + 60 + 20 + 0 + 30 + 25 + 15 + 10 = 256 raw
    // floor(256 * 1750 / 200) = floor(2240) = 2240
    expect(d).toBe(2240);
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
