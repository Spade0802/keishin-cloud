import { describe, expect, it } from 'vitest';
import { validateExtractedData, type ValidationIssue } from '../extraction-validator';
import type { KeishinPdfResult } from '../keishin-pdf-parser';
import type { SocialItems } from '../engine/types';

// ---------------------------------------------------------------------------
// Helper: minimal valid KeishinPdfResult
// ---------------------------------------------------------------------------
function baseData(overrides: Partial<KeishinPdfResult> = {}): KeishinPdfResult {
  return {
    basicInfo: {
      companyName: 'テスト建設株式会社',
      permitNumber: '国土交通大臣許可（特-1）第12345号',
      reviewBaseDate: '2025-03-31',
      periodNumber: '第30期',
    },
    equity: 50000,
    ebitda: 10000,
    techStaffCount: 10,
    industries: [
      {
        name: '土木一式工事',
        code: '01',
        prevCompletion: 100000,
        currCompletion: 120000,
        prevPrimeContract: 80000,
        currPrimeContract: 100000,
      },
    ],
    wItems: {
      employmentInsurance: true,
      healthInsurance: true,
      pensionInsurance: true,
      businessYears: 20,
      techStaffCount: 10,
      youngTechCount: 3,
    },
    businessYears: 20,
    warnings: [],
    mappings: [],
    ...overrides,
  };
}

function findIssue(issues: ValidationIssue[], field: string): ValidationIssue | undefined {
  return issues.find((i) => i.field === field);
}

// ---------------------------------------------------------------------------
// 1. validateBasicInfo
// ---------------------------------------------------------------------------
describe('validateBasicInfo', () => {
  it('produces warning when company name is missing', () => {
    const data = baseData({
      basicInfo: {
        companyName: '',
        permitNumber: '',
        reviewBaseDate: '2025-03-31',
        periodNumber: '',
      },
    });
    const result = validateExtractedData(data);
    const issue = findIssue(result.issues, 'basicInfo.companyName');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('warning');
  });

  it('produces warning for invalid date format', () => {
    const data = baseData({
      basicInfo: {
        companyName: 'テスト',
        permitNumber: '',
        reviewBaseDate: '令和7年3月31日',
        periodNumber: '',
      },
    });
    const result = validateExtractedData(data);
    const issue = findIssue(result.issues, 'basicInfo.reviewBaseDate');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('warning');
    expect(issue!.message).toContain('形式が不正');
  });

  it('accepts valid date formats (YYYY-MM-DD and YYYY/MM/DD)', () => {
    for (const dateStr of ['2025-03-31', '2025/3/31']) {
      const data = baseData({
        basicInfo: {
          companyName: 'テスト',
          permitNumber: '',
          reviewBaseDate: dateStr,
          periodNumber: '',
        },
      });
      const result = validateExtractedData(data);
      const issue = findIssue(result.issues, 'basicInfo.reviewBaseDate');
      expect(issue).toBeUndefined();
    }
  });

  it('validates basic info with all valid data', () => {
    const result = validateExtractedData(baseData());
    const basicIssues = result.issues.filter((i) => i.field.startsWith('basicInfo.'));
    expect(basicIssues).toHaveLength(0);
    expect(result.validatedBasicInfo.companyName).toBe('テスト建設株式会社');
    expect(result.validatedBasicInfo.reviewBaseDate).toBe('2025-03-31');
  });
});

// ---------------------------------------------------------------------------
// 2. validateFinancialData
// ---------------------------------------------------------------------------
describe('validateFinancialData', () => {
  it('produces warning for very large equity', () => {
    const data = baseData({ equity: 20_000_000 });
    const result = validateExtractedData(data);
    const issue = findIssue(result.issues, 'equity');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('warning');
    expect(issue!.message).toContain('非常に大きい');
  });

  it('produces info for large negative equity', () => {
    const data = baseData({ equity: -2_000_000 });
    const result = validateExtractedData(data);
    const issue = findIssue(result.issues, 'equity');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('info');
    expect(issue!.message).toContain('負の値');
  });

  it('produces warning for very large EBITDA', () => {
    const data = baseData({ ebitda: 20_000_000 });
    const result = validateExtractedData(data);
    const issue = findIssue(result.issues, 'ebitda');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('warning');
  });

  it('no issues for normal equity and ebitda values', () => {
    const data = baseData({ equity: 50000, ebitda: 10000 });
    const result = validateExtractedData(data);
    expect(findIssue(result.issues, 'equity')).toBeUndefined();
    expect(findIssue(result.issues, 'ebitda')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 3. validateIndustryData
// ---------------------------------------------------------------------------
describe('validateIndustryData', () => {
  it('produces warning when no industries extracted', () => {
    const data = baseData({ industries: [] });
    const result = validateExtractedData(data);
    const issue = findIssue(result.issues, 'industries');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('warning');
    expect(issue!.message).toContain('1つも抽出されませんでした');
  });

  it('produces warning for duplicate industry names', () => {
    const data = baseData({
      industries: [
        { name: '土木一式工事', code: '01', prevCompletion: 100000, currCompletion: 120000, prevPrimeContract: 80000, currPrimeContract: 100000 },
        { name: '土木一式工事', code: '01', prevCompletion: 50000, currCompletion: 60000, prevPrimeContract: 40000, currPrimeContract: 50000 },
      ],
    });
    const result = validateExtractedData(data);
    const issue = result.issues.find(
      (i) => i.field === 'industries' && i.message.includes('重複'),
    );
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('warning');
  });

  it('produces warning when currPrimeContract > currCompletion', () => {
    const data = baseData({
      industries: [
        { name: '建築一式工事', code: '02', prevCompletion: 100000, currCompletion: 100000, prevPrimeContract: 80000, currPrimeContract: 120000 },
      ],
    });
    const result = validateExtractedData(data);
    const issue = result.issues.find((i) =>
      i.field.includes('currPrimeContract'),
    );
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('warning');
    expect(issue!.suggestedValue).toBe(100000);
  });

  it('produces info when currCompletion is 0 but prevCompletion > 0', () => {
    const data = baseData({
      industries: [
        { name: '舗装工事', code: '17', prevCompletion: 50000, currCompletion: 0, prevPrimeContract: 0, currPrimeContract: 0 },
      ],
    });
    const result = validateExtractedData(data);
    const issue = result.issues.find((i) =>
      i.field.includes('currCompletion'),
    );
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('info');
  });
});

// ---------------------------------------------------------------------------
// 4. validateWItems
// ---------------------------------------------------------------------------
describe('validateWItems', () => {
  it('produces info when wItems is empty', () => {
    const data = baseData({ wItems: {} });
    const result = validateExtractedData(data);
    const issue = findIssue(result.issues, 'wItems');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('info');
    expect(issue!.message).toContain('抽出されませんでした');
  });

  it('coerces boolean from number (0 → false, 1 → true)', () => {
    const data = baseData({
      wItems: {
        employmentInsurance: 1 as unknown as boolean,
        healthInsurance: 0 as unknown as boolean,
      },
    });
    const result = validateExtractedData(data);
    expect(result.validatedWItems.employmentInsurance).toBe(true);
    expect(result.validatedWItems.healthInsurance).toBe(false);
  });

  it('produces warning when number value exceeds max', () => {
    const data = baseData({
      wItems: {
        techStaffCount: 99999,
      },
    });
    const result = validateExtractedData(data);
    const issue = result.issues.find(
      (i) => i.field === 'techStaffCount' && i.message.includes('最大値'),
    );
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('warning');
  });

  it('produces warning when number value is below min', () => {
    const data = baseData({
      wItems: {
        techStaffCount: -5,
      },
    });
    const result = validateExtractedData(data);
    const issue = result.issues.find(
      (i) => i.field === 'techStaffCount' && i.message.includes('最小値'),
    );
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('warning');
  });

  it('validates number within range successfully', () => {
    const data = baseData({
      wItems: {
        techStaffCount: 50,
        businessYears: 20,
      },
    });
    const result = validateExtractedData(data);
    expect(result.validatedWItems.techStaffCount).toBe(50);
    expect(result.validatedWItems.businessYears).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// 5. validateTechStaff
// ---------------------------------------------------------------------------
describe('validateTechStaff', () => {
  it('produces info for staff entries with no name', () => {
    const data = baseData({
      staffList: [
        { name: '', qualificationCode1: 127, qualificationCode2: undefined, industryCode1: 1, industryCode2: undefined, lectureFlag1: 1, lectureFlag2: undefined, supervisorCert: false, cpdUnits: 0 } as never,
        { name: '田中太郎', qualificationCode1: 127, qualificationCode2: undefined, industryCode1: 1, industryCode2: undefined, lectureFlag1: 1, lectureFlag2: undefined, supervisorCert: false, cpdUnits: 0 } as never,
      ],
    });
    const result = validateExtractedData(data);
    const issue = result.issues.find(
      (i) => i.field === 'staffList' && i.message.includes('氏名なし'),
    );
    expect(issue).toBeDefined();
    expect(issue!.originalValue).toBe(1);
  });

  it('produces info for staff entries with no qualification code', () => {
    const data = baseData({
      staffList: [
        { name: '田中太郎', qualificationCode1: undefined, qualificationCode2: undefined, industryCode1: 1, industryCode2: undefined, lectureFlag1: 0, lectureFlag2: undefined, supervisorCert: false, cpdUnits: 0 } as never,
      ],
    });
    const result = validateExtractedData(data);
    const issue = result.issues.find(
      (i) => i.field === 'staffList' && i.message.includes('資格コードなし'),
    );
    expect(issue).toBeDefined();
    expect(issue!.originalValue).toBe(1);
  });

  it('produces warning when techStaffCount mismatches staffList length', () => {
    const staff = Array.from({ length: 5 }, (_, i) => ({
      name: `職員${i}`,
      qualificationCode1: 127,
      qualificationCode2: undefined,
      industryCode1: 1,
      industryCode2: undefined,
      lectureFlag1: 1,
      lectureFlag2: undefined,
      supervisorCert: false,
      cpdUnits: 0,
    })) as never[];
    const data = baseData({ techStaffCount: 15, staffList: staff });
    const result = validateExtractedData(data);
    const issue = findIssue(result.issues, 'techStaffCount');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('warning');
    expect(issue!.message).toContain('一致しません');
  });
});

// ---------------------------------------------------------------------------
// 6. validateCrossField
// ---------------------------------------------------------------------------
describe('validateCrossField', () => {
  it('produces warning when youngTechCount > techStaffCount', () => {
    const data = baseData({
      wItems: {
        youngTechCount: 20,
        techStaffCount: 10,
      },
    });
    const result = validateExtractedData(data);
    const issue = findIssue(result.issues, 'youngTechCount');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('warning');
    expect(issue!.message).toContain('超えています');
  });

  it('produces info when businessYears mismatch between top-level and wItems', () => {
    const data = baseData({
      businessYears: 20,
      wItems: {
        businessYears: 25,
      },
    });
    const result = validateExtractedData(data);
    const issue = findIssue(result.issues, 'businessYears');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('info');
    expect(issue!.suggestedValue).toBe(25);
  });

  it('no cross-field issues when data is consistent', () => {
    const data = baseData({
      businessYears: 20,
      wItems: {
        businessYears: 20,
        techStaffCount: 10,
        youngTechCount: 3,
        newYoungTechCount: 1,
        skilledWorkerCount: 5,
        deductionTargetCount: 2,
      },
    });
    const result = validateExtractedData(data);
    expect(findIssue(result.issues, 'youngTechCount')).toBeUndefined();
    expect(findIssue(result.issues, 'newYoungTechCount')).toBeUndefined();
    expect(findIssue(result.issues, 'deductionTargetCount')).toBeUndefined();
  });

  it('produces warning when deductionTargetCount > skilledWorkerCount', () => {
    const data = baseData({
      wItems: {
        deductionTargetCount: 10,
        skilledWorkerCount: 5,
      },
    });
    const result = validateExtractedData(data);
    const issue = findIssue(result.issues, 'deductionTargetCount');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('warning');
  });

  it('isValid is true when there are only warnings and info (no errors)', () => {
    const data = baseData({ equity: 20_000_000 }); // triggers warning but not error
    const result = validateExtractedData(data);
    expect(result.isValid).toBe(true);
  });

  it('produces info when newYoungTechCount > youngTechCount', () => {
    const data = baseData({
      wItems: {
        newYoungTechCount: 10,
        youngTechCount: 5,
      },
    });
    const result = validateExtractedData(data);
    const issue = findIssue(result.issues, 'newYoungTechCount');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('info');
    expect(issue!.message).toContain('超えています');
  });

  it('no issue when businessYears match between top-level and wItems', () => {
    const data = baseData({
      businessYears: 20,
      wItems: { businessYears: 20 },
    });
    const result = validateExtractedData(data);
    const issue = findIssue(result.issues, 'businessYears');
    expect(issue).toBeUndefined();
  });

  it('no cross-field issue when youngTechCount <= techStaffCount', () => {
    const data = baseData({
      wItems: { youngTechCount: 5, techStaffCount: 10 },
    });
    const result = validateExtractedData(data);
    expect(findIssue(result.issues, 'youngTechCount')).toBeUndefined();
  });

  it('no cross-field issue when deductionTargetCount <= skilledWorkerCount', () => {
    const data = baseData({
      wItems: { deductionTargetCount: 3, skilledWorkerCount: 10 },
    });
    const result = validateExtractedData(data);
    expect(findIssue(result.issues, 'deductionTargetCount')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 7. Boundary values
// ---------------------------------------------------------------------------
describe('boundary values', () => {
  it('equity exactly at 10_000_000 does not trigger warning (boundary)', () => {
    const data = baseData({ equity: 10_000_000 });
    const result = validateExtractedData(data);
    expect(findIssue(result.issues, 'equity')).toBeUndefined();
  });

  it('equity just above 10_000_000 triggers warning', () => {
    const data = baseData({ equity: 10_000_001 });
    const result = validateExtractedData(data);
    const issue = findIssue(result.issues, 'equity');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('warning');
  });

  it('equity exactly at -1_000_000 does not trigger info (boundary)', () => {
    const data = baseData({ equity: -1_000_000 });
    const result = validateExtractedData(data);
    expect(findIssue(result.issues, 'equity')).toBeUndefined();
  });

  it('equity just below -1_000_000 triggers info', () => {
    const data = baseData({ equity: -1_000_001 });
    const result = validateExtractedData(data);
    const issue = findIssue(result.issues, 'equity');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('info');
  });

  it('equity of 0 produces no issue', () => {
    const data = baseData({ equity: 0 });
    const result = validateExtractedData(data);
    expect(findIssue(result.issues, 'equity')).toBeUndefined();
  });

  it('ebitda of 0 produces no issue', () => {
    const data = baseData({ ebitda: 0 });
    const result = validateExtractedData(data);
    expect(findIssue(result.issues, 'ebitda')).toBeUndefined();
  });

  it('large negative ebitda triggers warning', () => {
    const data = baseData({ ebitda: -20_000_000 });
    const result = validateExtractedData(data);
    const issue = findIssue(result.issues, 'ebitda');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('warning');
  });

  it('ebitda exactly at abs 10_000_000 does not trigger warning', () => {
    const data = baseData({ ebitda: 10_000_000 });
    const result = validateExtractedData(data);
    expect(findIssue(result.issues, 'ebitda')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 8. Additional basicInfo edge cases
// ---------------------------------------------------------------------------
describe('validateBasicInfo – additional', () => {
  it('populates permitNumber and periodNumber in validated output', () => {
    const result = validateExtractedData(baseData());
    expect(result.validatedBasicInfo.permitNumber).toBe('国土交通大臣許可（特-1）第12345号');
    expect(result.validatedBasicInfo.periodNumber).toBe('第30期');
  });

  it('does not populate permitNumber when empty', () => {
    const data = baseData({
      basicInfo: {
        companyName: 'テスト',
        permitNumber: '',
        reviewBaseDate: '2025-03-31',
        periodNumber: '',
      },
    });
    const result = validateExtractedData(data);
    expect(result.validatedBasicInfo.permitNumber).toBeUndefined();
    expect(result.validatedBasicInfo.periodNumber).toBeUndefined();
  });

  it('does not produce issue when reviewBaseDate is empty', () => {
    const data = baseData({
      basicInfo: {
        companyName: 'テスト',
        permitNumber: '',
        reviewBaseDate: '',
        periodNumber: '',
      },
    });
    const result = validateExtractedData(data);
    // empty string is falsy → no issue and no validated value
    expect(findIssue(result.issues, 'basicInfo.reviewBaseDate')).toBeUndefined();
    expect(result.validatedBasicInfo.reviewBaseDate).toBeUndefined();
  });

  it('still sets reviewBaseDate in validated even when format is invalid', () => {
    const data = baseData({
      basicInfo: {
        companyName: 'テスト',
        permitNumber: '',
        reviewBaseDate: '令和7年3月31日',
        periodNumber: '',
      },
    });
    const result = validateExtractedData(data);
    // invalid format generates warning but value is still set
    expect(result.validatedBasicInfo.reviewBaseDate).toBe('令和7年3月31日');
  });
});

// ---------------------------------------------------------------------------
// 9. Additional industry edge cases
// ---------------------------------------------------------------------------
describe('validateIndustryData – additional', () => {
  it('does not trigger primeContract warning when currCompletion is 0', () => {
    // currPrimeContract > currCompletion but currCompletion === 0 → guard clause prevents warning
    const data = baseData({
      industries: [
        { name: '管工事', code: '08', prevCompletion: 0, currCompletion: 0, prevPrimeContract: 0, currPrimeContract: 100 },
      ],
    });
    const result = validateExtractedData(data);
    const issue = result.issues.find((i) => i.field.includes('currPrimeContract'));
    expect(issue).toBeUndefined();
  });

  it('no issues for industry with normal values', () => {
    const data = baseData({
      industries: [
        { name: '電気工事', code: '09', prevCompletion: 50000, currCompletion: 60000, prevPrimeContract: 30000, currPrimeContract: 40000 },
      ],
    });
    const result = validateExtractedData(data);
    const industryIssues = result.issues.filter((i) => i.field.startsWith('industry.'));
    expect(industryIssues).toHaveLength(0);
  });

  it('does not trigger currCompletion info when prevCompletion is also 0', () => {
    const data = baseData({
      industries: [
        { name: '防水工事', code: '18', prevCompletion: 0, currCompletion: 0, prevPrimeContract: 0, currPrimeContract: 0 },
      ],
    });
    const result = validateExtractedData(data);
    const issue = result.issues.find((i) => i.field.includes('currCompletion'));
    expect(issue).toBeUndefined();
  });

  it('includes all duplicate names in warning message (deduped)', () => {
    const data = baseData({
      industries: [
        { name: '舗装工事', code: '17', prevCompletion: 100, currCompletion: 200, prevPrimeContract: 0, currPrimeContract: 0 },
        { name: '舗装工事', code: '17', prevCompletion: 300, currCompletion: 400, prevPrimeContract: 0, currPrimeContract: 0 },
        { name: '舗装工事', code: '17', prevCompletion: 500, currCompletion: 600, prevPrimeContract: 0, currPrimeContract: 0 },
      ],
    });
    const result = validateExtractedData(data);
    const issue = result.issues.find((i) => i.message.includes('重複'));
    expect(issue).toBeDefined();
    // Even though '舗装工事' appears 3 times, the deduped message should list it once
    expect(issue!.message).toContain('舗装工事');
    expect(issue!.message.match(/舗装工事/g)!.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 10. Additional W item edge cases
// ---------------------------------------------------------------------------
describe('validateWItems – additional', () => {
  it('produces warning for non-numeric string value in number field', () => {
    const data = baseData({
      wItems: {
        businessYears: 'abc' as unknown as number,
      },
    });
    const result = validateExtractedData(data);
    const issue = result.issues.find(
      (i) => i.field === 'businessYears' && i.message.includes('数値に変換できません'),
    );
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('warning');
    expect(issue!.originalValue).toBe('abc');
  });

  it('produces warning for boolean field with string value', () => {
    const data = baseData({
      wItems: {
        employmentInsurance: 'yes' as unknown as boolean,
      },
    });
    const result = validateExtractedData(data);
    const issue = result.issues.find(
      (i) => i.field === 'employmentInsurance' && i.message.includes('boolean期待'),
    );
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('warning');
  });

  it('skips null and undefined values without producing issues', () => {
    const data = baseData({
      wItems: {
        employmentInsurance: undefined as unknown as boolean,
        techStaffCount: null as unknown as number,
      },
    });
    const result = validateExtractedData(data);
    // Should produce "W items not extracted" info since effectively empty after filtering
    // But no field-specific issues for these fields
    const boolIssue = result.issues.find((i) => i.field === 'employmentInsurance');
    const numIssue = result.issues.find((i) => i.field === 'techStaffCount');
    expect(boolIssue).toBeUndefined();
    expect(numIssue).toBeUndefined();
  });

  it('validates WLB fields with boundary max values', () => {
    const data = baseData({
      wItems: {
        wlbEruboshi: 5, // max is 4
        wlbKurumin: 4,  // exactly at max, OK
        wlbYouth: 2,    // exactly at max, OK
      },
    });
    const result = validateExtractedData(data);
    const eruboshiIssue = result.issues.find(
      (i) => i.field === 'wlbEruboshi' && i.message.includes('最大値'),
    );
    expect(eruboshiIssue).toBeDefined();
    expect(eruboshiIssue!.suggestedValue).toBe(4);

    // wlbKurumin at max should be valid
    expect(result.validatedWItems.wlbKurumin).toBe(4);
    // wlbYouth at max should be valid
    expect(result.validatedWItems.wlbYouth).toBe(2);
  });

  it('validates CCUS implementation level boundary', () => {
    const data = baseData({
      wItems: {
        ccusImplementation: 3, // exactly at max, OK
      },
    });
    const result = validateExtractedData(data);
    expect(result.validatedWItems.ccusImplementation).toBe(3);
  });

  it('rejects number value at min boundary - below min', () => {
    const data = baseData({
      wItems: {
        businessYears: -1, // min is 0
      },
    });
    const result = validateExtractedData(data);
    const issue = result.issues.find(
      (i) => i.field === 'businessYears' && i.message.includes('最小値'),
    );
    expect(issue).toBeDefined();
    expect(issue!.suggestedValue).toBe(0);
  });

  it('accepts number at exactly min boundary', () => {
    const data = baseData({
      wItems: {
        businessYears: 0, // exactly at min, OK
      },
    });
    const result = validateExtractedData(data);
    expect(result.validatedWItems.businessYears).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 11. Additional techStaff edge cases
// ---------------------------------------------------------------------------
describe('validateTechStaff – additional', () => {
  it('no issues when staffList is undefined', () => {
    const data = baseData();
    delete (data as { staffList?: unknown }).staffList;
    const result = validateExtractedData(data);
    const staffIssues = result.issues.filter((i) => i.field === 'staffList');
    expect(staffIssues).toHaveLength(0);
  });

  it('no issues when staffList is empty', () => {
    const data = baseData({ staffList: [] });
    const result = validateExtractedData(data);
    const staffIssues = result.issues.filter((i) => i.field === 'staffList');
    expect(staffIssues).toHaveLength(0);
  });

  it('no mismatch warning when techStaffCount difference is within tolerance (<=2)', () => {
    const staff = Array.from({ length: 10 }, (_, i) => ({
      name: `職員${i}`,
      qualificationCode1: 127,
      qualificationCode2: undefined,
      industryCode1: '01',
      industryCode2: undefined,
      lectureFlag1: 1,
      lectureFlag2: undefined,
      supervisorCert: false,
      cpdUnits: 0,
    })) as never[];
    const data = baseData({ techStaffCount: 12, staffList: staff }); // diff = 2
    const result = validateExtractedData(data);
    expect(findIssue(result.issues, 'techStaffCount')).toBeUndefined();
  });

  it('mismatch warning when techStaffCount difference is exactly 3', () => {
    const staff = Array.from({ length: 10 }, (_, i) => ({
      name: `職員${i}`,
      qualificationCode1: 127,
      qualificationCode2: undefined,
      industryCode1: '01',
      industryCode2: undefined,
      lectureFlag1: 1,
      lectureFlag2: undefined,
      supervisorCert: false,
      cpdUnits: 0,
    })) as never[];
    const data = baseData({ techStaffCount: 13, staffList: staff }); // diff = 3
    const result = validateExtractedData(data);
    const issue = findIssue(result.issues, 'techStaffCount');
    expect(issue).toBeDefined();
    expect(issue!.suggestedValue).toBe(10);
  });

  it('no issues for all-valid staff entries', () => {
    const staff = [
      { name: '田中太郎', qualificationCode1: 127, qualificationCode2: undefined, industryCode1: '01', industryCode2: undefined, lectureFlag1: 1, lectureFlag2: undefined, supervisorCert: false, cpdUnits: 0 },
      { name: '佐藤花子', qualificationCode1: 200, qualificationCode2: 300, industryCode1: '02', industryCode2: '03', lectureFlag1: 1, lectureFlag2: 1, supervisorCert: true, cpdUnits: 10 },
    ] as never[];
    const data = baseData({ techStaffCount: 2, staffList: staff });
    const result = validateExtractedData(data);
    const staffIssues = result.issues.filter((i) => i.field === 'staffList');
    expect(staffIssues).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 12. Combined / integration scenarios
// ---------------------------------------------------------------------------
describe('combined validation scenarios', () => {
  it('accumulates multiple issues from different validators', () => {
    const data = baseData({
      basicInfo: {
        companyName: '',
        permitNumber: '',
        reviewBaseDate: 'invalid-date',
        periodNumber: '',
      },
      equity: 20_000_000,
      industries: [],
      wItems: {},
    });
    const result = validateExtractedData(data);
    // Should have at least: companyName warning, reviewBaseDate warning, equity warning, industries warning, wItems info
    expect(result.issues.length).toBeGreaterThanOrEqual(5);
    expect(findIssue(result.issues, 'basicInfo.companyName')).toBeDefined();
    expect(findIssue(result.issues, 'basicInfo.reviewBaseDate')).toBeDefined();
    expect(findIssue(result.issues, 'equity')).toBeDefined();
    expect(findIssue(result.issues, 'industries')).toBeDefined();
    expect(findIssue(result.issues, 'wItems')).toBeDefined();
  });

  it('isValid is always true when no error-severity issues exist', () => {
    // The current validators never produce 'error' severity, so isValid should always be true
    const data = baseData({
      basicInfo: { companyName: '', permitNumber: '', reviewBaseDate: 'bad', periodNumber: '' },
      equity: 999_999_999,
      ebitda: 999_999_999,
      industries: [],
      wItems: {},
    });
    const result = validateExtractedData(data);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues.every((i) => i.severity !== 'error')).toBe(true);
    expect(result.isValid).toBe(true);
  });

  it('returns correct validated items when all data is valid', () => {
    const data = baseData({
      wItems: {
        employmentInsurance: true,
        healthInsurance: false,
        pensionInsurance: true,
        businessYears: 25,
        techStaffCount: 50,
        youngTechCount: 10,
        newYoungTechCount: 3,
        wlbEruboshi: 2,
        iso9001: true,
        iso14001: false,
      },
    });
    const result = validateExtractedData(data);
    expect(result.validatedWItems.employmentInsurance).toBe(true);
    expect(result.validatedWItems.healthInsurance).toBe(false);
    expect(result.validatedWItems.pensionInsurance).toBe(true);
    expect(result.validatedWItems.businessYears).toBe(25);
    expect(result.validatedWItems.techStaffCount).toBe(50);
    expect(result.validatedWItems.youngTechCount).toBe(10);
    expect(result.validatedWItems.wlbEruboshi).toBe(2);
    expect(result.validatedWItems.iso9001).toBe(true);
    expect(result.validatedWItems.iso14001).toBe(false);
  });

  it('does not add to validatedWItems when value fails validation', () => {
    const data = baseData({
      wItems: {
        businessYears: 200, // max is 100
        techStaffCount: -5, // min is 0
        employmentInsurance: 'invalid' as unknown as boolean,
      },
    });
    const result = validateExtractedData(data);
    expect(result.validatedWItems.businessYears).toBeUndefined();
    expect(result.validatedWItems.techStaffCount).toBeUndefined();
    expect(result.validatedWItems.employmentInsurance).toBeUndefined();
  });

  it('error message for min/max includes the actual boundary values', () => {
    const data = baseData({
      wItems: {
        businessYears: 200, // max is 100
      },
    });
    const result = validateExtractedData(data);
    const issue = result.issues.find(
      (i) => i.field === 'businessYears' && i.message.includes('最大値'),
    );
    expect(issue).toBeDefined();
    expect(issue!.message).toContain('100');
    expect(issue!.message).toContain('200');
  });
});
