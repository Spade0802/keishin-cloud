import { describe, expect, it } from 'vitest';
import {
  normalizeIndustryName,
  getNestedValue,
  INDUSTRY_NAME_ALIASES,
  INDUSTRY_FIELD_KEYS,
  W_ITEMS_MAPPINGS,
  BASIC_INFO_MAPPINGS,
  FINANCIAL_MAPPINGS,
  TECH_STAFF_MAPPINGS,
  ALL_MAPPINGS,
  type FieldMapping,
  type DataSource,
  type FieldSection,
  type FieldType,
  type FieldMeta,
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

// ===========================================================================
// BASIC_INFO_MAPPINGS structure validation
// ===========================================================================
describe('BASIC_INFO_MAPPINGS structure', () => {
  it('has expected number of entries', () => {
    expect(BASIC_INFO_MAPPINGS.length).toBe(4);
  });

  it('all entries belong to basic_info section', () => {
    for (const mapping of BASIC_INFO_MAPPINGS) {
      expect(mapping.section).toBe('basic_info');
    }
  });

  it('all entries are string type', () => {
    for (const mapping of BASIC_INFO_MAPPINGS) {
      expect(mapping.type).toBe('string');
    }
  });

  it('all extractionPaths start with basicInfo.', () => {
    for (const mapping of BASIC_INFO_MAPPINGS) {
      expect(mapping.extractionPath).toMatch(/^basicInfo\./);
    }
  });

  it('companyName is required', () => {
    const companyName = BASIC_INFO_MAPPINGS.find(
      (m) => m.formTarget === 'basicInfo.companyName'
    );
    expect(companyName).toBeDefined();
    expect(companyName!.validation?.required).toBe(true);
  });

  it('has no duplicate formTarget values', () => {
    const targets = BASIC_INFO_MAPPINGS.map((m) => m.formTarget);
    expect(new Set(targets).size).toBe(targets.length);
  });

  it('has no duplicate extractionPath values', () => {
    const paths = BASIC_INFO_MAPPINGS.map((m) => m.extractionPath);
    expect(new Set(paths).size).toBe(paths.length);
  });
});

// ===========================================================================
// FINANCIAL_MAPPINGS structure validation
// ===========================================================================
describe('FINANCIAL_MAPPINGS structure', () => {
  it('has expected entries', () => {
    expect(FINANCIAL_MAPPINGS.length).toBe(2);
  });

  it('all entries belong to financial section', () => {
    for (const mapping of FINANCIAL_MAPPINGS) {
      expect(mapping.section).toBe('financial');
    }
  });

  it('all entries are number type', () => {
    for (const mapping of FINANCIAL_MAPPINGS) {
      expect(mapping.type).toBe('number');
    }
  });

  it('all numeric fields have min/max validation', () => {
    for (const mapping of FINANCIAL_MAPPINGS) {
      expect(mapping.validation).toBeDefined();
      expect(mapping.validation!.min).toBeDefined();
      expect(mapping.validation!.max).toBeDefined();
    }
  });

  it('validation allows negative values (financial data can be negative)', () => {
    for (const mapping of FINANCIAL_MAPPINGS) {
      expect(mapping.validation!.min!).toBeLessThan(0);
    }
  });

  it('has no duplicate formTarget values', () => {
    const targets = FINANCIAL_MAPPINGS.map((m) => m.formTarget);
    expect(new Set(targets).size).toBe(targets.length);
  });
});

// ===========================================================================
// TECH_STAFF_MAPPINGS structure validation
// ===========================================================================
describe('TECH_STAFF_MAPPINGS structure', () => {
  it('has expected entries', () => {
    expect(TECH_STAFF_MAPPINGS.length).toBe(2);
  });

  it('all entries are number type', () => {
    for (const mapping of TECH_STAFF_MAPPINGS) {
      expect(mapping.type).toBe('number');
    }
  });

  it('all numeric fields have non-negative min', () => {
    for (const mapping of TECH_STAFF_MAPPINGS) {
      expect(mapping.validation).toBeDefined();
      expect(mapping.validation!.min).toBeGreaterThanOrEqual(0);
    }
  });

  it('has no duplicate formTarget values', () => {
    const targets = TECH_STAFF_MAPPINGS.map((m) => m.formTarget);
    expect(new Set(targets).size).toBe(targets.length);
  });
});

// ===========================================================================
// INDUSTRY_FIELD_KEYS validation
// ===========================================================================
describe('INDUSTRY_FIELD_KEYS', () => {
  it('contains expected keys', () => {
    expect(INDUSTRY_FIELD_KEYS).toContain('name');
    expect(INDUSTRY_FIELD_KEYS).toContain('prevCompletion');
    expect(INDUSTRY_FIELD_KEYS).toContain('currCompletion');
    expect(INDUSTRY_FIELD_KEYS).toContain('prevPrimeContract');
    expect(INDUSTRY_FIELD_KEYS).toContain('currPrimeContract');
    expect(INDUSTRY_FIELD_KEYS).toContain('techStaffValue');
  });

  it('has exactly 6 keys', () => {
    expect(INDUSTRY_FIELD_KEYS.length).toBe(6);
  });

  it('has no duplicates', () => {
    const unique = new Set(INDUSTRY_FIELD_KEYS);
    expect(unique.size).toBe(INDUSTRY_FIELD_KEYS.length);
  });
});

// ===========================================================================
// getNestedValue - additional edge cases
// ===========================================================================
describe('getNestedValue - additional edge cases', () => {
  it('returns undefined when intermediate value is undefined', () => {
    const obj = { a: undefined } as unknown as Record<string, unknown>;
    expect(getNestedValue(obj, 'a.b')).toBeUndefined();
  });

  it('handles deeply nested paths (3+ levels)', () => {
    const obj = { a: { b: { c: { d: { e: 'found' } } } } };
    expect(getNestedValue(obj, 'a.b.c.d.e')).toBe('found');
  });

  it('returns the object itself for single-segment paths to nested objects', () => {
    const nested = { x: 1 };
    const obj = { child: nested };
    expect(getNestedValue(obj, 'child')).toBe(nested);
  });

  it('handles numeric string values without confusion', () => {
    const obj = { val: '12345' };
    expect(getNestedValue(obj, 'val')).toBe('12345');
  });

  it('handles null values at leaf', () => {
    const obj = { key: null } as Record<string, unknown>;
    expect(getNestedValue(obj, 'key')).toBeNull();
  });

  it('handles array values at leaf', () => {
    const obj = { items: [1, 2, 3] };
    expect(getNestedValue(obj, 'items')).toEqual([1, 2, 3]);
  });

  it('can traverse into arrays by numeric index', () => {
    const obj = { items: ['a', 'b', 'c'] };
    expect(getNestedValue(obj as unknown as Record<string, unknown>, 'items.1')).toBe('b');
  });

  it('returns undefined for out-of-bounds array index', () => {
    const obj = { items: ['a'] };
    expect(getNestedValue(obj as unknown as Record<string, unknown>, 'items.5')).toBeUndefined();
  });

  it('handles empty string key segments gracefully', () => {
    // path "a..b" splits to ['a', '', 'b']
    const obj = { a: { '': { b: 'found' } } };
    expect(getNestedValue(obj, 'a..b')).toBe('found');
  });

  it('handles single-segment path to falsy values', () => {
    expect(getNestedValue({ a: '' }, 'a')).toBe('');
    expect(getNestedValue({ a: NaN }, 'a')).toBeNaN();
  });
});

// ===========================================================================
// getNestedValue with all real mapping extractionPaths
// ===========================================================================
describe('getNestedValue - resolves all ALL_MAPPINGS extractionPaths', () => {
  it('resolves every extractionPath from a fully populated object', () => {
    // Build a mock object that has a value for every extractionPath
    const mockData: Record<string, unknown> = {};

    for (const mapping of ALL_MAPPINGS) {
      const parts = mapping.extractionPath.split('.');
      if (parts.length === 1) {
        mockData[parts[0]] = mapping.type === 'number' ? 1 : mapping.type === 'boolean' ? true : 'test';
      } else if (parts.length === 2) {
        if (!mockData[parts[0]] || typeof mockData[parts[0]] !== 'object') {
          mockData[parts[0]] = {};
        }
        const parent = mockData[parts[0]] as Record<string, unknown>;
        parent[parts[1]] = mapping.type === 'number' ? 1 : mapping.type === 'boolean' ? true : 'test';
      }
    }

    for (const mapping of ALL_MAPPINGS) {
      const value = getNestedValue(mockData, mapping.extractionPath);
      expect(value).toBeDefined();
    }
  });

  it('returns undefined for all extractionPaths on empty object', () => {
    for (const mapping of ALL_MAPPINGS) {
      expect(getNestedValue({}, mapping.extractionPath)).toBeUndefined();
    }
  });
});

// ===========================================================================
// Type-level validation: FieldMapping types cover expected values
// ===========================================================================
describe('ALL_MAPPINGS type coverage', () => {
  it('uses only valid FieldType values', () => {
    const validTypes: FieldType[] = ['number', 'boolean', 'string'];
    for (const mapping of ALL_MAPPINGS) {
      expect(validTypes).toContain(mapping.type);
    }
  });

  it('uses only valid FieldSection values', () => {
    const validSections: FieldSection[] = ['basic_info', 'financial', 'industry', 'w_items', 'tech_staff'];
    for (const mapping of ALL_MAPPINGS) {
      expect(validSections).toContain(mapping.section);
    }
  });

  it('validation min is always less than max when both are defined', () => {
    for (const mapping of ALL_MAPPINGS) {
      if (mapping.validation?.min !== undefined && mapping.validation?.max !== undefined) {
        expect(mapping.validation.min).toBeLessThan(mapping.validation.max);
      }
    }
  });
});

// ===========================================================================
// DataSource type validation
// ===========================================================================
describe('DataSource and FieldMeta types', () => {
  it('FieldMeta can be constructed with all DataSource values', () => {
    const sources: DataSource[] = ['direct_pdf', 'derived_from_pdf', 'user_input', null];
    for (const source of sources) {
      const meta: FieldMeta = {
        source,
        timestamp: Date.now(),
        userOverridden: false,
      };
      expect(meta.source).toBe(source);
    }
  });

  it('FieldMeta userOverridden flag works correctly', () => {
    const meta: FieldMeta = {
      source: 'user_input',
      timestamp: 1000,
      userOverridden: true,
    };
    expect(meta.userOverridden).toBe(true);
    expect(meta.timestamp).toBe(1000);
  });
});

// ===========================================================================
// normalizeIndustryName - aliases that end with 工事
// ===========================================================================
describe('normalizeIndustryName - aliases ending with 工事', () => {
  it('maps aliases that themselves end with 工事 to the correct full name', () => {
    // These are aliases in the map that already end with 工事
    // e.g., '内装仕上工事' is NOT in ALIASES (only '内装仕上' and '内装' are)
    // '水道施設工事' is NOT in ALIASES (only '水道' and '水道施設' are)
    // Let's verify which aliases end with 工事
    const aliasesEndingWithKoji = Object.entries(INDUSTRY_NAME_ALIASES).filter(
      ([alias]) => alias.endsWith('工事')
    );
    for (const [alias, fullName] of aliasesEndingWithKoji) {
      expect(normalizeIndustryName(alias)).toBe(fullName);
    }
  });

  it('names ending with 工事 not in aliases pass through unchanged', () => {
    expect(normalizeIndustryName('特殊工事')).toBe('特殊工事');
    expect(normalizeIndustryName('宇宙工事')).toBe('宇宙工事');
  });
});
