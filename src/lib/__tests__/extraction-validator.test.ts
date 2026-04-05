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
});
