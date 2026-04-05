import { describe, expect, it } from 'vitest';
import {
  normalizeIndustryName,
  getNestedValue,
  INDUSTRY_NAME_ALIASES,
  W_ITEMS_MAPPINGS,
  BASIC_INFO_MAPPINGS,
  FINANCIAL_MAPPINGS,
  TECH_STAFF_MAPPINGS,
  ALL_MAPPINGS,
  type FieldMapping,
} from '../extraction-field-map';

// ===========================================================================
// normalizeIndustryName
// ===========================================================================
describe('normalizeIndustryName', () => {
  it('returns empty string for empty input', () => {
    expect(normalizeIndustryName('')).toBe('');
  });

  it('normalizes short names to full names', () => {
    expect(normalizeIndustryName('土木')).toBe('土木一式工事');
    expect(normalizeIndustryName('建築')).toBe('建築一式工事');
    expect(normalizeIndustryName('電気')).toBe('電気工事');
    expect(normalizeIndustryName('管')).toBe('管工事');
    expect(normalizeIndustryName('舗装')).toBe('舗装工事');
    expect(normalizeIndustryName('解体')).toBe('解体工事');
  });

  it('normalizes alternate kanji forms', () => {
    expect(normalizeIndustryName('ほ装')).toBe('舗装工事');
    expect(normalizeIndustryName('内装仕上')).toBe('内装仕上工事');
    expect(normalizeIndustryName('水道施設')).toBe('水道施設工事');
  });

  it('passes through already-official names unchanged', () => {
    expect(normalizeIndustryName('電気工事')).toBe('電気工事');
    expect(normalizeIndustryName('解体工事')).toBe('解体工事');
    expect(normalizeIndustryName('管工事')).toBe('管工事');
  });

  it('passes through names ending in 工事 that are not in aliases', () => {
    expect(normalizeIndustryName('土木一式工事')).toBe('土木一式工事');
    expect(normalizeIndustryName('未知の工事')).toBe('未知の工事');
  });

  it('passes through completely unknown names unchanged', () => {
    expect(normalizeIndustryName('不明な業種')).toBe('不明な業種');
    expect(normalizeIndustryName('abc')).toBe('abc');
  });

  it('handles names that are aliases AND end with 工事 (e.g. 内装仕上工事)', () => {
    // 内装仕上工事 is in ALIASES → maps to 内装仕上工事
    expect(normalizeIndustryName('内装')).toBe('内装仕上工事');
  });

  it('covers all defined aliases', () => {
    for (const [alias, fullName] of Object.entries(INDUSTRY_NAME_ALIASES)) {
      expect(normalizeIndustryName(alias)).toBe(fullName);
    }
  });
});

// ===========================================================================
// getNestedValue
// ===========================================================================
describe('getNestedValue', () => {
  it('retrieves top-level values', () => {
    expect(getNestedValue({ foo: 42 }, 'foo')).toBe(42);
    expect(getNestedValue({ name: 'test' }, 'name')).toBe('test');
  });

  it('retrieves nested values with dot paths', () => {
    const obj = { a: { b: { c: 'deep' } } };
    expect(getNestedValue(obj, 'a.b.c')).toBe('deep');
  });

  it('returns undefined for missing paths', () => {
    expect(getNestedValue({}, 'foo')).toBeUndefined();
    expect(getNestedValue({ a: 1 }, 'b')).toBeUndefined();
    expect(getNestedValue({ a: { b: 1 } }, 'a.c')).toBeUndefined();
  });

  it('returns undefined when traversing through non-object', () => {
    expect(getNestedValue({ a: 42 }, 'a.b')).toBeUndefined();
    expect(getNestedValue({ a: 'str' }, 'a.b')).toBeUndefined();
    expect(getNestedValue({ a: null } as Record<string, unknown>, 'a.b')).toBeUndefined();
  });

  it('handles paths with array-like objects', () => {
    const obj = { items: { 0: 'first', 1: 'second' } };
    expect(getNestedValue(obj, 'items.0')).toBe('first');
  });

  it('retrieves boolean and zero values correctly', () => {
    const obj = { flag: false, count: 0 };
    expect(getNestedValue(obj, 'flag')).toBe(false);
    expect(getNestedValue(obj, 'count')).toBe(0);
  });

  it('works with real extraction paths from mappings', () => {
    const pdfResult = {
      basicInfo: { companyName: 'テスト建設', permitNumber: '123456' },
      wItems: { employmentInsurance: true, businessYears: 20 },
      equity: 50000,
    };
    expect(getNestedValue(pdfResult, 'basicInfo.companyName')).toBe('テスト建設');
    expect(getNestedValue(pdfResult, 'wItems.employmentInsurance')).toBe(true);
    expect(getNestedValue(pdfResult, 'equity')).toBe(50000);
  });
});

// ===========================================================================
// W_ITEMS_MAPPINGS structure validation
// ===========================================================================
describe('W_ITEMS_MAPPINGS structure', () => {
  it('has at least 20 entries', () => {
    expect(W_ITEMS_MAPPINGS.length).toBeGreaterThanOrEqual(20);
  });

  it('all entries have required fields', () => {
    for (const mapping of W_ITEMS_MAPPINGS) {
      expect(mapping.extractionPath).toBeTruthy();
      expect(mapping.formTarget).toBeTruthy();
      expect(mapping.section).toBe('w_items');
      expect(['number', 'boolean', 'string']).toContain(mapping.type);
      expect(mapping.label).toBeTruthy();
    }
  });

  it('all extractionPaths start with wItems.', () => {
    for (const mapping of W_ITEMS_MAPPINGS) {
      expect(mapping.extractionPath).toMatch(/^wItems\./);
    }
  });

  it('has no duplicate formTarget values', () => {
    const targets = W_ITEMS_MAPPINGS.map((m) => m.formTarget);
    expect(new Set(targets).size).toBe(targets.length);
  });

  it('numeric fields have validation with min/max', () => {
    const numericMappings = W_ITEMS_MAPPINGS.filter((m) => m.type === 'number');
    for (const mapping of numericMappings) {
      expect(mapping.validation).toBeDefined();
      expect(mapping.validation!.min).toBeDefined();
      expect(mapping.validation!.max).toBeDefined();
      expect(mapping.validation!.min!).toBeLessThan(mapping.validation!.max!);
    }
  });

  it('boolean fields have no min/max validation', () => {
    const boolMappings = W_ITEMS_MAPPINGS.filter((m) => m.type === 'boolean');
    for (const mapping of boolMappings) {
      // Boolean fields should not have min/max
      if (mapping.validation) {
        expect(mapping.validation.min).toBeUndefined();
        expect(mapping.validation.max).toBeUndefined();
      }
    }
  });
});

// ===========================================================================
// ALL_MAPPINGS integration
// ===========================================================================
describe('ALL_MAPPINGS', () => {
  it('includes all sub-mapping arrays', () => {
    expect(ALL_MAPPINGS.length).toBe(
      BASIC_INFO_MAPPINGS.length +
        FINANCIAL_MAPPINGS.length +
        W_ITEMS_MAPPINGS.length +
        TECH_STAFF_MAPPINGS.length
    );
  });

  it('all entries have valid section values', () => {
    const validSections = ['basic_info', 'financial', 'industry', 'w_items', 'tech_staff'];
    for (const mapping of ALL_MAPPINGS) {
      expect(validSections).toContain(mapping.section);
    }
  });

  it('all entries have non-empty labels', () => {
    for (const mapping of ALL_MAPPINGS) {
      expect(mapping.label.length).toBeGreaterThan(0);
    }
  });

  it('extractionPaths are unique across all mappings (except known duplicates)', () => {
    const paths = ALL_MAPPINGS.map((m) => m.extractionPath);
    const duplicates = paths.filter((p, i) => paths.indexOf(p) !== i);
    // Some paths may intentionally appear in multiple mapping groups
    // but each should map to the same formTarget
    for (const dup of duplicates) {
      const mappings = ALL_MAPPINGS.filter((m) => m.extractionPath === dup);
      // If same path appears multiple times, formTargets should match
      const targets = new Set(mappings.map((m) => m.formTarget));
      expect(targets.size).toBe(1);
    }
  });
});
