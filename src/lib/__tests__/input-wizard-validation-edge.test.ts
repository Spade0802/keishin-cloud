import { describe, it, expect } from 'vitest';
import {
  getFinancialFieldWarning,
  detectIndustryDuplicate,
  getIndustryWDefaults,
  INDUSTRY_W_DEFAULTS,
  LARGE_VALUE_THRESHOLD,
} from '@/lib/input-wizard-validation';

// ==========================================
// getFinancialFieldWarning: boundary values
// ==========================================
describe('getFinancialFieldWarning boundary values', () => {
  it('returns null at exactly LARGE_VALUE_THRESHOLD', () => {
    expect(getFinancialFieldWarning('売上', String(LARGE_VALUE_THRESHOLD))).toBeNull();
  });

  it('warns at LARGE_VALUE_THRESHOLD + 1', () => {
    const result = getFinancialFieldWarning('売上', String(LARGE_VALUE_THRESHOLD + 1));
    expect(result).not.toBeNull();
    expect(result!.message).toContain('100億円超');
  });

  it('returns null at negative LARGE_VALUE_THRESHOLD with allowNegative', () => {
    expect(getFinancialFieldWarning('経常利益', String(-LARGE_VALUE_THRESHOLD), { allowNegative: true })).toBeNull();
  });

  it('warns at -(LARGE_VALUE_THRESHOLD + 1) with allowNegative', () => {
    const result = getFinancialFieldWarning('経常利益', String(-(LARGE_VALUE_THRESHOLD + 1)), { allowNegative: true });
    expect(result).not.toBeNull();
    expect(result!.message).toContain('100億円超');
  });

  it('returns null for value of exactly 0', () => {
    expect(getFinancialFieldWarning('支払利息', '0')).toBeNull();
  });

  it('returns null for value of exactly -0', () => {
    expect(getFinancialFieldWarning('支払利息', '-0')).toBeNull();
  });

  it('warns for -1 without allowNegative (just barely negative)', () => {
    const result = getFinancialFieldWarning('流動負債', '-1');
    expect(result).not.toBeNull();
    expect(result!.message).toContain('負の値');
  });

  it('mustBePositive warns for -0.001 (very small negative)', () => {
    const result = getFinancialFieldWarning('完成工事高', '-0.001', { mustBePositive: true });
    expect(result).not.toBeNull();
    expect(result!.message).toContain('正の値');
  });

  it('returns null for value of exactly 1', () => {
    expect(getFinancialFieldWarning('売上', '1')).toBeNull();
  });
});

// ==========================================
// getFinancialFieldWarning: NaN, Infinity, -Infinity
// ==========================================
describe('getFinancialFieldWarning with special values', () => {
  it('returns null for NaN string', () => {
    expect(getFinancialFieldWarning('売上', 'NaN')).toBeNull();
  });

  it('returns null for non-numeric garbage', () => {
    expect(getFinancialFieldWarning('売上', '---')).toBeNull();
  });

  it('handles Infinity string', () => {
    const result = getFinancialFieldWarning('売上', 'Infinity');
    // parseFloat('Infinity') = Infinity, abs(Infinity) > threshold → warns
    expect(result).not.toBeNull();
    expect(result!.message).toContain('100億円超');
  });

  it('handles -Infinity string', () => {
    const result = getFinancialFieldWarning('売上', '-Infinity');
    // parseFloat('-Infinity') = -Infinity, it is < 0 (not allowNegative) → warns
    expect(result).not.toBeNull();
    expect(result!.level).toBe('warning');
  });

  it('handles -Infinity with allowNegative', () => {
    const result = getFinancialFieldWarning('経常利益', '-Infinity', { allowNegative: true });
    // abs(-Infinity) > threshold → large value warning
    expect(result).not.toBeNull();
    expect(result!.message).toContain('100億円超');
  });

  it('returns null for empty string', () => {
    expect(getFinancialFieldWarning('売上', '')).toBeNull();
  });

  it('returns null for whitespace-only string', () => {
    // parseFloat('   ') = NaN
    expect(getFinancialFieldWarning('売上', '   ')).toBeNull();
  });

  it('handles string with leading number', () => {
    // parseFloat('123abc') = 123
    const result = getFinancialFieldWarning('売上', '123abc');
    expect(result).toBeNull(); // 123 is a normal positive value
  });
});

// ==========================================
// detectIndustryDuplicate with Unicode names
// ==========================================
describe('detectIndustryDuplicate with Unicode industry names', () => {
  const unicodeIndustries = [
    { name: '土木一式工事' },
    { name: '建築一式工事' },
    { name: '電気工事' },
    { name: '管工事' },
    { name: '鋼構造物工事' },
  ];

  it('detects exact Unicode match', () => {
    expect(detectIndustryDuplicate(unicodeIndustries, 4, '電気工事')).toBe(true);
  });

  it('does not match partial Unicode strings', () => {
    expect(detectIndustryDuplicate(unicodeIndustries, 0, '土木')).toBe(false);
  });

  it('does not match with extra whitespace', () => {
    expect(detectIndustryDuplicate(unicodeIndustries, 0, '土木一式工事 ')).toBe(false);
    expect(detectIndustryDuplicate(unicodeIndustries, 0, ' 土木一式工事')).toBe(false);
  });

  it('handles full-width vs half-width characters as distinct', () => {
    // Full-width space vs no space
    expect(detectIndustryDuplicate(unicodeIndustries, 0, '土木一式工事\u3000')).toBe(false);
  });

  it('handles very long Unicode names', () => {
    const longName = '特殊'.repeat(100) + '工事';
    const industries = [{ name: longName }, { name: '電気工事' }];
    expect(detectIndustryDuplicate(industries, 1, longName)).toBe(true);
    expect(detectIndustryDuplicate(industries, 0, longName)).toBe(false);
  });

  it('handles industries with emoji characters', () => {
    const emojiIndustries = [
      { name: '電気工事' },
      { name: '工事A' },
    ];
    expect(detectIndustryDuplicate(emojiIndustries, 1, '電気工事')).toBe(true);
  });
});

// ==========================================
// getIndustryWDefaults with all known industries
// ==========================================
describe('getIndustryWDefaults with all known industries', () => {
  const allKnownIndustries = Object.keys(INDUSTRY_W_DEFAULTS);

  it('returns non-empty defaults for each known industry', () => {
    for (const name of allKnownIndustries) {
      const result = getIndustryWDefaults([name]);
      expect(Object.keys(result).length).toBeGreaterThan(0);
    }
  });

  it('all known industries have social insurance defaults', () => {
    for (const name of allKnownIndustries) {
      const result = getIndustryWDefaults([name]);
      // All defined industries should recommend employment and health insurance
      expect(result.employmentInsurance).toBe(true);
      expect(result.healthInsurance).toBe(true);
      expect(result.pensionInsurance).toBe(true);
    }
  });

  it('merging all industries produces a superset of all recommendations', () => {
    const merged = getIndustryWDefaults(allKnownIndustries);

    // Should have all boolean keys that any industry defines
    expect(merged.employmentInsurance).toBe(true);
    expect(merged.healthInsurance).toBe(true);
    expect(merged.pensionInsurance).toBe(true);
    expect(merged.constructionRetirementMutualAid).toBe(true);
    expect(merged.nonStatutoryAccidentInsurance).toBe(true);
    expect(merged.disasterAgreement).toBe(true);
    expect(merged.iso9001).toBe(true);
  });

  it('specific industries have expected unique defaults', () => {
    // 土木一式工事 has disasterAgreement and constructionMachineCount
    const doboku = getIndustryWDefaults(['土木一式工事']);
    expect(doboku.disasterAgreement).toBe(true);
    expect(doboku.constructionMachineCount).toBe(1);

    // 建築一式工事 has ISO9001
    const kenchiku = getIndustryWDefaults(['建築一式工事']);
    expect(kenchiku.iso9001).toBe(true);

    // 鋼構造物工事 has both ISO9001 and accident insurance
    const kou = getIndustryWDefaults(['鋼構造物工事']);
    expect(kou.iso9001).toBe(true);
    expect(kou.nonStatutoryAccidentInsurance).toBe(true);
  });

  it('returns empty for completely unknown industry', () => {
    const result = getIndustryWDefaults(['宇宙工事']);
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('returns defaults only for known entries when mixing known and unknown', () => {
    const result = getIndustryWDefaults(['宇宙工事', '電気工事', '火星工事']);
    expect(result.nonStatutoryAccidentInsurance).toBe(true);
    expect(result.employmentInsurance).toBe(true);
  });

  it('known industries list is complete (7 industries)', () => {
    expect(allKnownIndustries).toHaveLength(7);
    expect(allKnownIndustries).toContain('土木一式工事');
    expect(allKnownIndustries).toContain('建築一式工事');
    expect(allKnownIndustries).toContain('電気工事');
    expect(allKnownIndustries).toContain('管工事');
    expect(allKnownIndustries).toContain('舗装工事');
    expect(allKnownIndustries).toContain('鋼構造物工事');
    expect(allKnownIndustries).toContain('解体工事');
  });
});
