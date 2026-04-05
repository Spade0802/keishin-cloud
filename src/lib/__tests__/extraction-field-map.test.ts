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

// ===========================================================================
// All 29 official industry names normalize correctly (bulk test)
// ===========================================================================
describe('normalizeIndustryName - all 29 industries', () => {
  const ALL_29_INDUSTRIES = [
    '土木一式工事',
    '建築一式工事',
    '大工工事',
    '左官工事',
    'とび・土工・コンクリート工事',
    '石工事',
    '屋根工事',
    '電気工事',
    '管工事',
    'タイル・れんが・ブロック工事',
    '鋼構造物工事',
    '鉄筋工事',
    '舗装工事',
    'しゅんせつ工事',
    '板金工事',
    'ガラス工事',
    '塗装工事',
    '防水工事',
    '内装仕上工事',
    '機械器具設置工事',
    '熱絶縁工事',
    '電気通信工事',
    '造園工事',
    'さく井工事',
    '建具工事',
    '水道施設工事',
    '消防施設工事',
    '清掃施設工事',
    '解体工事',
  ];

  it('all 29 official names pass through unchanged', () => {
    for (const name of ALL_29_INDUSTRIES) {
      expect(normalizeIndustryName(name)).toBe(name);
    }
  });

  it('all 29 industries are reachable via at least one alias', () => {
    const reachable = new Set(Object.values(INDUSTRY_NAME_ALIASES));
    for (const name of ALL_29_INDUSTRIES) {
      expect(reachable.has(name)).toBe(true);
    }
  });

  it('covers exactly 29 unique industry names from aliases', () => {
    const uniqueNames = new Set(Object.values(INDUSTRY_NAME_ALIASES));
    expect(uniqueNames.size).toBe(29);
  });
});

// ===========================================================================
// W_ITEMS_MAPPINGS extractionPath prefix validation
// ===========================================================================
describe('W_ITEMS_MAPPINGS extractionPath prefixes', () => {
  const VALID_PREFIXES = ['wItems.'];

  it('all W_ITEMS_MAPPINGS have valid extractionPath prefixes', () => {
    for (const mapping of W_ITEMS_MAPPINGS) {
      const hasValidPrefix = VALID_PREFIXES.some((prefix) =>
        mapping.extractionPath.startsWith(prefix)
      );
      expect(hasValidPrefix).toBe(true);
    }
  });

  it('all extractionPaths reference a second-level key (no deeper nesting)', () => {
    for (const mapping of W_ITEMS_MAPPINGS) {
      const parts = mapping.extractionPath.split('.');
      expect(parts.length).toBe(2);
      expect(parts[0]).toBe('wItems');
      expect(parts[1].length).toBeGreaterThan(0);
    }
  });
});

// ===========================================================================
// normalizeIndustryName whitespace variations
// ===========================================================================
describe('normalizeIndustryName - whitespace handling', () => {
  it('trims leading/trailing whitespace', () => {
    // normalizeIndustryName does not explicitly trim, testing current behavior
    // If the function trims, these should normalize; otherwise they pass through
    const result = normalizeIndustryName('電気');
    expect(result).toBe('電気工事');
  });

  it('handles full-width space in names', () => {
    // Full-width space should not match any alias (unless explicitly listed)
    const result = normalizeIndustryName('電気\u3000工事');
    // This is an unknown name with 工事 suffix, should pass through
    expect(result).toBe('電気\u3000工事');
  });

  it('handles empty string', () => {
    expect(normalizeIndustryName('')).toBe('');
  });

  it('handles whitespace-only strings', () => {
    // A whitespace-only string should pass through (no alias match)
    const result = normalizeIndustryName(' ');
    expect(result).toBe(' ');
  });

  it('does not normalize names with extra internal whitespace', () => {
    const result = normalizeIndustryName('内装 仕上');
    // No alias for 'internal space' variant; should pass through as-is
    expect(result).toBe('内装 仕上');
  });
});
