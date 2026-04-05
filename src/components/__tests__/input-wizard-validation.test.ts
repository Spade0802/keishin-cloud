import { describe, it, expect } from 'vitest';
import {
  getFinancialFieldWarning,
  detectIndustryDuplicate,
  getIndustryWDefaults,
  INDUSTRY_W_DEFAULTS,
  LARGE_VALUE_THRESHOLD,
} from '@/lib/input-wizard-validation';

// ---- getFinancialFieldWarning ----

describe('getFinancialFieldWarning', () => {
  it('returns null for empty value', () => {
    expect(getFinancialFieldWarning('売上', '')).toBeNull();
  });

  it('returns null for non-numeric value', () => {
    expect(getFinancialFieldWarning('売上', 'abc')).toBeNull();
  });

  it('returns null for normal positive value', () => {
    expect(getFinancialFieldWarning('売上', '500000')).toBeNull();
  });

  it('warns when mustBePositive and value is negative', () => {
    const result = getFinancialFieldWarning('完成工事高', '-100', { mustBePositive: true });
    expect(result).not.toBeNull();
    expect(result!.level).toBe('warning');
    expect(result!.message).toContain('正の値');
  });

  it('warns when value is negative and allowNegative is not set', () => {
    const result = getFinancialFieldWarning('流動負債', '-500');
    expect(result).not.toBeNull();
    expect(result!.level).toBe('warning');
    expect(result!.message).toContain('負の値');
  });

  it('does not warn for negative value when allowNegative is true', () => {
    expect(getFinancialFieldWarning('経常利益', '-500', { allowNegative: true })).toBeNull();
  });

  it('warns for extremely large positive value (unit check)', () => {
    const bigValue = String(LARGE_VALUE_THRESHOLD + 1);
    const result = getFinancialFieldWarning('売上', bigValue);
    expect(result).not.toBeNull();
    expect(result!.level).toBe('warning');
    expect(result!.message).toContain('100億円超');
  });

  it('warns for extremely large negative value (unit check)', () => {
    const bigNeg = String(-(LARGE_VALUE_THRESHOLD + 1));
    const result = getFinancialFieldWarning('経常利益', bigNeg, { allowNegative: true });
    expect(result).not.toBeNull();
    expect(result!.message).toContain('100億円超');
  });

  it('does not warn at exactly the threshold', () => {
    const exactThreshold = String(LARGE_VALUE_THRESHOLD);
    expect(getFinancialFieldWarning('売上', exactThreshold)).toBeNull();
  });

  it('mustBePositive takes priority over large value warning', () => {
    const result = getFinancialFieldWarning('完成工事高', '-20000000', { mustBePositive: true });
    expect(result).not.toBeNull();
    expect(result!.message).toContain('正の値');
  });

  it('returns null for zero', () => {
    expect(getFinancialFieldWarning('支払利息', '0')).toBeNull();
  });
});

// ---- detectIndustryDuplicate ----

describe('detectIndustryDuplicate', () => {
  const industries = [
    { name: '土木一式工事' },
    { name: '建築一式工事' },
    { name: '電気工事' },
  ];

  it('detects duplicate when same name exists at different index', () => {
    expect(detectIndustryDuplicate(industries, 2, '土木一式工事')).toBe(true);
  });

  it('does not flag self as duplicate', () => {
    expect(detectIndustryDuplicate(industries, 0, '土木一式工事')).toBe(false);
  });

  it('returns false for new unique name', () => {
    expect(detectIndustryDuplicate(industries, 0, '管工事')).toBe(false);
  });

  it('returns false for empty name', () => {
    expect(detectIndustryDuplicate(industries, 0, '')).toBe(false);
  });

  it('handles empty industries list', () => {
    expect(detectIndustryDuplicate([], 0, '土木一式工事')).toBe(false);
  });

  it('handles industries with empty names', () => {
    const withEmpty = [{ name: '' }, { name: '土木一式工事' }];
    expect(detectIndustryDuplicate(withEmpty, 0, '')).toBe(false);
    expect(detectIndustryDuplicate(withEmpty, 0, '土木一式工事')).toBe(true);
  });
});

// ---- getIndustryWDefaults (smart defaults mapping) ----

describe('getIndustryWDefaults', () => {
  it('returns empty object for unknown industry', () => {
    const result = getIndustryWDefaults(['存在しない工事']);
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('returns correct defaults for a single known industry', () => {
    const result = getIndustryWDefaults(['土木一式工事']);
    expect(result.disasterAgreement).toBe(true);
    expect(result.constructionMachineCount).toBe(1);
    expect(result.employmentInsurance).toBe(true);
    expect(result.healthInsurance).toBe(true);
    expect(result.pensionInsurance).toBe(true);
    expect(result.constructionRetirementMutualAid).toBe(true);
  });

  it('returns ISO9001 for 建築一式工事', () => {
    const result = getIndustryWDefaults(['建築一式工事']);
    expect(result.iso9001).toBe(true);
    expect(result.constructionRetirementMutualAid).toBe(true);
  });

  it('merges boolean fields from multiple industries (true wins)', () => {
    // 土木一式 has disasterAgreement, 電気工事 does not
    const result = getIndustryWDefaults(['土木一式工事', '電気工事']);
    expect(result.disasterAgreement).toBe(true);
    expect(result.nonStatutoryAccidentInsurance).toBe(true); // from 電気工事
    expect(result.employmentInsurance).toBe(true); // both have it
  });

  it('merges numeric fields by taking the max', () => {
    // 土木一式 has constructionMachineCount=1, 舗装工事 also has 1
    const result = getIndustryWDefaults(['土木一式工事', '舗装工事']);
    expect(result.constructionMachineCount).toBe(1);
  });

  it('returns empty object for empty array', () => {
    const result = getIndustryWDefaults([]);
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('only returns defined keys from INDUSTRY_W_DEFAULTS', () => {
    const result = getIndustryWDefaults(['電気工事']);
    // 電気工事 does not set disasterAgreement or constructionMachineCount
    expect(result.disasterAgreement).toBeUndefined();
    expect(result.constructionMachineCount).toBeUndefined();
    // But does set these
    expect(result.nonStatutoryAccidentInsurance).toBe(true);
  });

  it('INDUSTRY_W_DEFAULTS has entries for expected industries', () => {
    const expectedIndustries = [
      '土木一式工事', '建築一式工事', '電気工事',
      '管工事', '舗装工事', '鋼構造物工事', '解体工事',
    ];
    for (const name of expectedIndustries) {
      expect(INDUSTRY_W_DEFAULTS[name]).toBeDefined();
    }
  });
});
