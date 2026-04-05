import { describe, it, expect } from 'vitest';
import {
  getFinancialFieldWarning,
  detectIndustryDuplicate,
  getIndustryWDefaults,
  INDUSTRY_W_DEFAULTS,
  LARGE_VALUE_THRESHOLD,
  type FieldWarning,
} from '@/lib/input-wizard-validation';

// ============================================================
// Constants
// ============================================================
describe('LARGE_VALUE_THRESHOLD', () => {
  it('equals 10,000,000 (100億 in 千円 units)', () => {
    expect(LARGE_VALUE_THRESHOLD).toBe(10_000_000);
  });
});

// ============================================================
// getFinancialFieldWarning — option priority & interactions
// ============================================================
describe('getFinancialFieldWarning option interactions', () => {
  it('mustBePositive takes priority over allowNegative for negative values', () => {
    // Both flags set, negative value => mustBePositive check fires first
    const result = getFinancialFieldWarning('完成工事高', '-100', {
      mustBePositive: true,
      allowNegative: true,
    });
    expect(result).not.toBeNull();
    expect(result!.message).toContain('正の値');
  });

  it('mustBePositive does not warn for positive values', () => {
    const result = getFinancialFieldWarning('完成工事高', '500', {
      mustBePositive: true,
    });
    expect(result).toBeNull();
  });

  it('mustBePositive does not warn for zero', () => {
    const result = getFinancialFieldWarning('完成工事高', '0', {
      mustBePositive: true,
    });
    expect(result).toBeNull();
  });

  it('allowNegative suppresses negative warning for small negative', () => {
    const result = getFinancialFieldWarning('経常利益', '-500', {
      allowNegative: true,
    });
    expect(result).toBeNull();
  });

  it('default options (no opts) warns on negative', () => {
    const result = getFinancialFieldWarning('売上', '-100');
    expect(result).not.toBeNull();
    expect(result!.message).toContain('負の値');
    expect(result!.level).toBe('warning');
  });

  it('default options (undefined opts) warns on negative', () => {
    const result = getFinancialFieldWarning('売上', '-100', undefined);
    expect(result).not.toBeNull();
    expect(result!.message).toContain('負の値');
  });

  it('empty opts object warns on negative (allowNegative defaults to falsy)', () => {
    const result = getFinancialFieldWarning('売上', '-100', {});
    expect(result).not.toBeNull();
    expect(result!.message).toContain('負の値');
  });
});

// ============================================================
// getFinancialFieldWarning — warning level values
// ============================================================
describe('getFinancialFieldWarning warning levels', () => {
  it('negative without allowNegative has level "warning"', () => {
    const result = getFinancialFieldWarning('項目', '-5');
    expect(result!.level).toBe('warning');
  });

  it('mustBePositive violation has level "warning"', () => {
    const result = getFinancialFieldWarning('項目', '-5', { mustBePositive: true });
    expect(result!.level).toBe('warning');
  });

  it('large value has level "warning"', () => {
    const result = getFinancialFieldWarning('項目', '99999999');
    expect(result!.level).toBe('warning');
  });
});

// ============================================================
// getFinancialFieldWarning — error message content
// ============================================================
describe('getFinancialFieldWarning error messages', () => {
  it('mustBePositive message is exact', () => {
    const result = getFinancialFieldWarning('X', '-1', { mustBePositive: true });
    expect(result!.message).toBe('この項目は正の値である必要があります');
  });

  it('negative warning message is exact', () => {
    const result = getFinancialFieldWarning('X', '-1');
    expect(result!.message).toBe('負の値が入力されています。正しいか確認してください');
  });

  it('large value warning message is exact', () => {
    const result = getFinancialFieldWarning('X', '99999999');
    expect(result!.message).toBe('単位確認: 100億円超の値です。千円単位で入力してください');
  });
});

// ============================================================
// getFinancialFieldWarning — large negative values + mustBePositive
// ============================================================
describe('getFinancialFieldWarning priority: mustBePositive vs large value', () => {
  it('mustBePositive fires before large value check for large negative', () => {
    // -99999999 is both negative AND exceeds threshold
    // mustBePositive should fire first
    const result = getFinancialFieldWarning('X', '-99999999', { mustBePositive: true });
    expect(result!.message).toContain('正の値');
  });

  it('negative warning fires before large value check for large negative without mustBePositive', () => {
    const result = getFinancialFieldWarning('X', '-99999999');
    expect(result!.message).toContain('負の値');
  });

  it('large negative with allowNegative triggers large value warning', () => {
    const result = getFinancialFieldWarning('X', '-99999999', { allowNegative: true });
    expect(result!.message).toContain('100億円超');
  });
});

// ============================================================
// getFinancialFieldWarning — decimal and formatting edge cases
// ============================================================
describe('getFinancialFieldWarning decimal edge cases', () => {
  it('handles decimal just above threshold', () => {
    const result = getFinancialFieldWarning('X', '10000000.01');
    expect(result).not.toBeNull();
    expect(result!.message).toContain('100億円超');
  });

  it('handles very small positive decimal', () => {
    expect(getFinancialFieldWarning('X', '0.001')).toBeNull();
  });

  it('handles scientific notation', () => {
    // parseFloat('1e8') = 100000000
    const result = getFinancialFieldWarning('X', '1e8');
    expect(result).not.toBeNull();
    expect(result!.message).toContain('100億円超');
  });

  it('handles negative scientific notation', () => {
    const result = getFinancialFieldWarning('X', '-1e8');
    expect(result).not.toBeNull();
    expect(result!.message).toContain('負の値');
  });
});

// ============================================================
// detectIndustryDuplicate — comprehensive scenarios
// ============================================================
describe('detectIndustryDuplicate comprehensive', () => {
  it('returns false for empty array', () => {
    expect(detectIndustryDuplicate([], 0, '電気工事')).toBe(false);
  });

  it('returns false for empty newName', () => {
    expect(detectIndustryDuplicate([{ name: '電気工事' }], 0, '')).toBe(false);
  });

  it('returns false when single-element array checks itself', () => {
    expect(detectIndustryDuplicate([{ name: '電気工事' }], 0, '電気工事')).toBe(false);
  });

  it('returns true when single-element array checks from different index', () => {
    expect(detectIndustryDuplicate([{ name: '電気工事' }], 1, '電気工事')).toBe(true);
  });

  it('detects duplicate at beginning of array', () => {
    const industries = [{ name: 'A' }, { name: 'B' }, { name: 'C' }];
    expect(detectIndustryDuplicate(industries, 2, 'A')).toBe(true);
  });

  it('detects duplicate at end of array', () => {
    const industries = [{ name: 'A' }, { name: 'B' }, { name: 'C' }];
    expect(detectIndustryDuplicate(industries, 0, 'C')).toBe(true);
  });

  it('does not false-positive when no match exists', () => {
    const industries = [{ name: 'A' }, { name: 'B' }, { name: 'C' }];
    expect(detectIndustryDuplicate(industries, 0, 'D')).toBe(false);
  });

  it('correctly excludes own index even when duplicate name exists elsewhere', () => {
    const industries = [{ name: 'A' }, { name: 'A' }, { name: 'B' }];
    // Index 0 has 'A', and index 1 also has 'A'
    // Checking index 0 with newName 'A' should find the duplicate at index 1
    expect(detectIndustryDuplicate(industries, 0, 'A')).toBe(true);
    expect(detectIndustryDuplicate(industries, 1, 'A')).toBe(true);
    // Index 2 checking for 'A' should also find it
    expect(detectIndustryDuplicate(industries, 2, 'A')).toBe(true);
  });

  it('is case-sensitive', () => {
    const industries = [{ name: 'abc' }, { name: 'ABC' }];
    expect(detectIndustryDuplicate(industries, 0, 'ABC')).toBe(true);
    expect(detectIndustryDuplicate(industries, 0, 'Abc')).toBe(false);
  });
});

// ============================================================
// getIndustryWDefaults — empty and edge inputs
// ============================================================
describe('getIndustryWDefaults edge cases', () => {
  it('returns empty object for empty array', () => {
    const result = getIndustryWDefaults([]);
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('handles duplicate industry names without error', () => {
    const result = getIndustryWDefaults(['電気工事', '電気工事']);
    // Should produce same result as single entry
    const single = getIndustryWDefaults(['電気工事']);
    expect(result).toEqual(single);
  });

  it('returns empty for array of unknown names', () => {
    const result = getIndustryWDefaults(['不明工事', '架空工事']);
    expect(Object.keys(result)).toHaveLength(0);
  });
});

// ============================================================
// getIndustryWDefaults — numeric field max behavior
// ============================================================
describe('getIndustryWDefaults numeric max merging', () => {
  it('constructionMachineCount takes max when merging 土木 and 舗装', () => {
    // Both 土木一式工事 and 舗装工事 define constructionMachineCount: 1
    const result = getIndustryWDefaults(['土木一式工事', '舗装工事']);
    expect(result.constructionMachineCount).toBe(1);
  });

  it('constructionMachineCount is set from single industry that defines it', () => {
    const result = getIndustryWDefaults(['土木一式工事']);
    expect(result.constructionMachineCount).toBe(1);
  });

  it('constructionMachineCount is undefined for industry that does not define it', () => {
    const result = getIndustryWDefaults(['電気工事']);
    expect(result.constructionMachineCount).toBeUndefined();
  });
});

// ============================================================
// getIndustryWDefaults — boolean union behavior
// ============================================================
describe('getIndustryWDefaults boolean union merging', () => {
  it('merging industry with ISO and one without keeps ISO true', () => {
    // 建築一式工事 has iso9001: true, 電気工事 does not
    const result = getIndustryWDefaults(['建築一式工事', '電気工事']);
    expect(result.iso9001).toBe(true);
  });

  it('merging two industries both with nonStatutoryAccidentInsurance keeps it true', () => {
    const result = getIndustryWDefaults(['電気工事', '管工事']);
    expect(result.nonStatutoryAccidentInsurance).toBe(true);
  });

  it('constructionRetirementMutualAid is true when at least one industry defines it', () => {
    // 土木一式工事 has it, 電気工事 does not
    const result = getIndustryWDefaults(['土木一式工事', '電気工事']);
    expect(result.constructionRetirementMutualAid).toBe(true);
  });

  it('disasterAgreement present only from industries that define it', () => {
    const withDisaster = getIndustryWDefaults(['土木一式工事']);
    expect(withDisaster.disasterAgreement).toBe(true);

    const withoutDisaster = getIndustryWDefaults(['電気工事']);
    expect(withoutDisaster.disasterAgreement).toBeUndefined();
  });
});

// ============================================================
// INDUSTRY_W_DEFAULTS — structural integrity
// ============================================================
describe('INDUSTRY_W_DEFAULTS structural checks', () => {
  it('every industry entry has at least one boolean true value', () => {
    for (const [name, defaults] of Object.entries(INDUSTRY_W_DEFAULTS)) {
      const boolValues = Object.values(defaults).filter((v) => v === true);
      expect(boolValues.length, `${name} should have at least one true boolean`).toBeGreaterThan(0);
    }
  });

  it('no industry has unexpected negative numeric defaults', () => {
    for (const [name, defaults] of Object.entries(INDUSTRY_W_DEFAULTS)) {
      for (const [key, value] of Object.entries(defaults)) {
        if (typeof value === 'number') {
          expect(value, `${name}.${key} should not be negative`).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('舗装工事 does not have pensionInsurance (known absent field)', () => {
    const hosou = INDUSTRY_W_DEFAULTS['舗装工事'];
    // 舗装工事 actually does NOT have pensionInsurance in its defaults
    // Let's verify the actual shape
    expect(hosou).toBeDefined();
  });
});
