import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock xlsx before importing the module under test
vi.mock('xlsx', () => {
  const sheetToJson = vi.fn().mockReturnValue([]);
  return {
    read: vi.fn().mockReturnValue({
      SheetNames: [],
      Sheets: {},
    }),
    utils: {
      sheet_to_json: sheetToJson,
    },
  };
});

import * as XLSX from 'xlsx';
import { parseExcel, parseExcelFromBase64 } from '../excel-parser';

// Helper: build a mock workbook with given sheets
function mockWorkbook(
  sheets: { name: string; rows: unknown[][] }[]
) {
  const Sheets: Record<string, object> = {};
  const SheetNames: string[] = [];

  for (const s of sheets) {
    SheetNames.push(s.name);
    Sheets[s.name] = { __rows: s.rows }; // sentinel for sheet_to_json mock
  }

  vi.mocked(XLSX.read).mockReturnValue({
    SheetNames,
    Sheets,
  } as unknown as XLSX.WorkBook);

  vi.mocked(XLSX.utils.sheet_to_json).mockImplementation((sheet: unknown) => {
    const s = sheet as { __rows?: unknown[][] };
    return (s.__rows ?? []) as unknown[];
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Exported function signatures
// ---------------------------------------------------------------------------
describe('exported functions', () => {
  it('parseExcel is a function accepting ArrayBuffer', () => {
    expect(typeof parseExcel).toBe('function');
    // Should accept an ArrayBuffer and return without throwing
    mockWorkbook([]);
    const result = parseExcel(new ArrayBuffer(0));
    expect(result).toBeDefined();
  });

  it('parseExcelFromBase64 is a function accepting string', () => {
    expect(typeof parseExcelFromBase64).toBe('function');
    mockWorkbook([]);
    const result = parseExcelFromBase64(btoa(''));
    expect(result).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Return shape
// ---------------------------------------------------------------------------
describe('parseExcel return shape', () => {
  it('returns data, warnings, and mappings', () => {
    mockWorkbook([]);
    const result = parseExcel(new ArrayBuffer(0));
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('warnings');
    expect(result).toHaveProperty('mappings');
    expect(Array.isArray(result.warnings)).toBe(true);
    expect(Array.isArray(result.mappings)).toBe(true);
  });

  it('initializes all top-level data sections', () => {
    mockWorkbook([]);
    const { data } = parseExcel(new ArrayBuffer(0));
    expect(data.bs).toBeDefined();
    expect(data.pl).toBeDefined();
    expect(data.manufacturing).toBeDefined();
    expect(data.sga).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Empty / no-data edge cases
// ---------------------------------------------------------------------------
describe('edge cases - empty data', () => {
  it('warns when no data is recognized (no sheets)', () => {
    mockWorkbook([]);
    const { warnings, mappings } = parseExcel(new ArrayBuffer(0));
    expect(mappings).toHaveLength(0);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toContain('自動認識できませんでした');
  });

  it('warns when sheets exist but contain no parseable rows', () => {
    mockWorkbook([{ name: 'BS', rows: [] }]);
    const { warnings, mappings } = parseExcel(new ArrayBuffer(0));
    expect(mappings).toHaveLength(0);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('handles sheet with rows shorter than 2 columns', () => {
    mockWorkbook([{ name: 'BS', rows: [['現金']] }]);
    const { data } = parseExcel(new ArrayBuffer(0));
    // Should not crash; no value extracted
    expect(Object.keys(data.bs!.currentAssets)).toHaveLength(0);
  });

  it('handles null / undefined rows gracefully', () => {
    mockWorkbook([
      {
        name: 'BS',
        rows: [null as unknown as unknown[], undefined as unknown as unknown[]],
      },
    ]);
    expect(() => parseExcel(new ArrayBuffer(0))).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// BS parsing
// ---------------------------------------------------------------------------
describe('BS sheet parsing', () => {
  it('recognizes BS sheet by name containing "BS"', () => {
    mockWorkbook([
      {
        name: 'BS',
        rows: [['現金', 1000000]],
      },
    ]);
    const { data, mappings } = parseExcel(new ArrayBuffer(0));
    expect(data.bs!.currentAssets['現金']).toBe(1000000);
    expect(mappings).toContainEqual({
      source: '現金',
      target: '流動資産/現金',
      value: 1000000,
    });
  });

  it('recognizes BS sheet by name containing "貸借"', () => {
    mockWorkbook([
      {
        name: '貸借対照表',
        rows: [['普通預金', 5000000]],
      },
    ]);
    const { data } = parseExcel(new ArrayBuffer(0));
    expect(data.bs!.currentAssets['普通預金']).toBe(5000000);
  });

  it('recognizes BS sheet by name containing "バランス"', () => {
    mockWorkbook([
      {
        name: 'バランスシート',
        rows: [['土地', 30000000]],
      },
    ]);
    const { data } = parseExcel(new ArrayBuffer(0));
    expect(data.bs!.tangibleFixed['土地']).toBe(30000000);
  });

  it('parses current asset items', () => {
    mockWorkbook([
      {
        name: 'BS',
        rows: [
          ['受取手形', 200000],
          ['完成工事未収入金', 500000],
          ['未成工事支出金', 100000],
        ],
      },
    ]);
    const { data } = parseExcel(new ArrayBuffer(0));
    expect(data.bs!.currentAssets['受取手形']).toBe(200000);
    expect(data.bs!.currentAssets['完成工事未収入金']).toBe(500000);
    expect(data.bs!.currentAssets['未成工事支出金']).toBe(100000);
  });

  it('parses tangible fixed asset items', () => {
    mockWorkbook([
      {
        name: 'BS',
        rows: [
          ['建物', 10000000],
          ['機械装置', 3000000],
          ['車両運搬具', 500000],
        ],
      },
    ]);
    const { data } = parseExcel(new ArrayBuffer(0));
    expect(data.bs!.tangibleFixed['建物']).toBe(10000000);
    expect(data.bs!.tangibleFixed['機械装置']).toBe(3000000);
    expect(data.bs!.tangibleFixed['車両運搬具']).toBe(500000);
  });

  it('parses current liability items', () => {
    mockWorkbook([
      {
        name: 'BS',
        rows: [
          ['支払手形', 800000],
          ['工事未払金', 400000],
          ['未払法人税等', 150000],
        ],
      },
    ]);
    const { data } = parseExcel(new ArrayBuffer(0));
    expect(data.bs!.currentLiabilities['支払手形']).toBe(800000);
    expect(data.bs!.currentLiabilities['工事未払金']).toBe(400000);
    expect(data.bs!.currentLiabilities['未払法人税等']).toBe(150000);
  });

  it('parses equity items', () => {
    mockWorkbook([
      {
        name: 'BS',
        rows: [
          ['資本金', 10000000],
          ['利益準備金', 2000000],
          ['繰越利益剰余金', 5000000],
          ['自己株式', -1000000],
        ],
      },
    ]);
    const { data, mappings } = parseExcel(new ArrayBuffer(0));
    expect(data.bs!.equity['資本金']).toBe(10000000);
    expect(data.bs!.equity['利益準備金']).toBe(2000000);
    expect(data.bs!.equity['繰越利益剰余金']).toBe(5000000);
    expect(data.bs!.equity['自己株式']).toBe(-1000000);
    expect(mappings).toContainEqual({
      source: '資本金',
      target: '純資産/資本金',
      value: 10000000,
    });
  });

  it('parses fixed liabilities', () => {
    mockWorkbook([
      { name: 'BS', rows: [['長期借入金', 20000000]] },
    ]);
    const { data } = parseExcel(new ArrayBuffer(0));
    expect(data.bs!.fixedLiabilities['長期借入金']).toBe(20000000);
  });

  it('parses investment items', () => {
    mockWorkbook([
      {
        name: 'BS',
        rows: [
          ['保険積立金', 3000000],
          ['長期前払費用', 500000],
        ],
      },
    ]);
    const { data } = parseExcel(new ArrayBuffer(0));
    expect(data.bs!.investments['保険積立金']).toBe(3000000);
    expect(data.bs!.investments['長期前払費用']).toBe(500000);
  });

  it('parses total rows', () => {
    mockWorkbook([
      {
        name: 'BS',
        rows: [
          ['流動資産合計', 50000000],
          ['有形固定資産合計', 30000000],
          ['無形固定資産合計', 1000000],
          ['投資その他の資産合計', 5000000],
          ['固定資産合計', 36000000],
          ['資産合計', 86000000],
          ['流動負債合計', 20000000],
          ['固定負債合計', 15000000],
          ['負債合計', 35000000],
          ['純資産合計', 51000000],
        ],
      },
    ]);
    const { data } = parseExcel(new ArrayBuffer(0));
    const t = data.bs!.totals;
    expect(t.currentAssets).toBe(50000000);
    expect(t.tangibleFixed).toBe(30000000);
    expect(t.intangibleFixed).toBe(1000000);
    expect(t.investments).toBe(5000000);
    expect(t.fixedAssets).toBe(36000000);
    expect(t.totalAssets).toBe(86000000);
    expect(t.currentLiabilities).toBe(20000000);
    expect(t.fixedLiabilities).toBe(15000000);
    expect(t.totalLiabilities).toBe(35000000);
    expect(t.totalEquity).toBe(51000000);
  });

  it('also matches "資産の部合計" and "負債の部合計" and "純資産の部合計"', () => {
    mockWorkbook([
      {
        name: 'BS',
        rows: [
          ['資産の部合計', 100000000],
          ['負債の部合計', 40000000],
          ['純資産の部合計', 60000000],
        ],
      },
    ]);
    const { data } = parseExcel(new ArrayBuffer(0));
    expect(data.bs!.totals.totalAssets).toBe(100000000);
    expect(data.bs!.totals.totalLiabilities).toBe(40000000);
    expect(data.bs!.totals.totalEquity).toBe(60000000);
  });

  it('picks the first numeric non-zero cell as value (skips label column)', () => {
    mockWorkbook([
      {
        name: 'BS',
        // Row format: [label, sub-label, value]
        rows: [['現金', '(内訳)', 999]],
      },
    ]);
    const { data } = parseExcel(new ArrayBuffer(0));
    expect(data.bs!.currentAssets['現金']).toBe(999);
  });

  it('skips rows where all non-label cells are zero', () => {
    mockWorkbook([
      {
        name: 'BS',
        rows: [['現金', 0, 0]],
      },
    ]);
    const { data } = parseExcel(new ArrayBuffer(0));
    // value cell search requires cell !== 0 for BS, so nothing matched
    expect(data.bs!.currentAssets['現金']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// PL parsing
// ---------------------------------------------------------------------------
describe('PL sheet parsing', () => {
  it('recognizes PL sheet by name containing "PL"', () => {
    mockWorkbook([
      {
        name: 'PL',
        rows: [['完成工事高', 100000000]],
      },
    ]);
    const { data, mappings } = parseExcel(new ArrayBuffer(0));
    expect(data.pl!.completedConstruction).toBe(100000000);
    expect(mappings).toContainEqual({
      source: '完成工事高',
      target: 'PL/完成工事高',
      value: 100000000,
    });
  });

  it('recognizes PL sheet by name containing "損益"', () => {
    mockWorkbook([
      {
        name: '損益計算書',
        rows: [['営業利益', 5000000]],
      },
    ]);
    const { data } = parseExcel(new ArrayBuffer(0));
    expect(data.pl!.operatingProfit).toBe(5000000);
  });

  it('parses full PL line items', () => {
    mockWorkbook([
      {
        name: 'PL',
        rows: [
          ['完成工事高', 100000000],
          ['出来高工事高', 20000000],
          ['売上高', 120000000],
          ['完成工事原価', 80000000],
          ['売上総利益', 40000000],
          ['販売費及び一般管理費合計', 10000000],
          ['営業利益', 30000000],
          ['受取利息', 100000],
          ['受取配当金', 50000],
          ['支払利息', 200000],
          ['経常利益', 29950000],
          ['特別利益', 500000],
          ['特別損失', 300000],
          ['法人税等', 9000000],
          ['当期純利益', 21150000],
        ],
      },
    ]);
    const { data } = parseExcel(new ArrayBuffer(0));
    expect(data.pl!.completedConstruction).toBe(100000000);
    expect(data.pl!.progressConstruction).toBe(20000000);
    expect(data.pl!.totalSales).toBe(120000000);
    expect(data.pl!.costOfSales).toBe(80000000);
    expect(data.pl!.grossProfit).toBe(40000000);
    expect(data.pl!.sgaTotal).toBe(10000000);
    expect(data.pl!.operatingProfit).toBe(30000000);
    expect(data.pl!.interestIncome).toBe(100000);
    expect(data.pl!.dividendIncome).toBe(50000);
    expect(data.pl!.interestExpense).toBe(200000);
    expect(data.pl!.ordinaryProfit).toBe(29950000);
    expect(data.pl!.specialGain).toBe(500000);
    expect(data.pl!.specialLoss).toBe(300000);
    expect(data.pl!.corporateTax).toBe(9000000);
    expect(data.pl!.netIncome).toBe(21150000);
  });

  it('PL allows zero values (unlike BS which skips zeros)', () => {
    mockWorkbook([
      {
        name: 'PL',
        rows: [['受取利息', 0]],
      },
    ]);
    const { data } = parseExcel(new ArrayBuffer(0));
    expect(data.pl!.interestIncome).toBe(0);
  });

  it('"未払法人税等" is not mistaken for corporate tax', () => {
    mockWorkbook([
      {
        name: 'PL',
        rows: [['未払法人税等', 999]],
      },
    ]);
    const { data } = parseExcel(new ArrayBuffer(0));
    // The label contains '法人税' but also '未払' so it should NOT set corporateTax
    expect(data.pl!.corporateTax).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Manufacturing (原価) parsing
// ---------------------------------------------------------------------------
describe('Manufacturing sheet parsing', () => {
  it('recognizes sheet by name containing "原価"', () => {
    mockWorkbook([
      {
        name: '工事原価報告書',
        rows: [['材料費', 10000000]],
      },
    ]);
    const { data, mappings } = parseExcel(new ArrayBuffer(0));
    expect(data.manufacturing!.materials).toBe(10000000);
    expect(mappings).toContainEqual({
      source: '材料費',
      target: '原価/材料費',
      value: 10000000,
    });
  });

  it('recognizes sheet by name containing "製造"', () => {
    mockWorkbook([
      {
        name: '製造原価',
        rows: [['労務費', 5000000]],
      },
    ]);
    const { data } = parseExcel(new ArrayBuffer(0));
    expect(data.manufacturing!.labor).toBe(5000000);
  });

  it('parses all manufacturing line items', () => {
    mockWorkbook([
      {
        name: '原価',
        rows: [
          ['材料費', 10000000],
          ['労務費', 5000000],
          ['外注費', 20000000],
          ['経費', 3000000],
          ['減価償却費', 1000000],
          ['期首未成工事支出金', 2000000],
          ['期末未成工事支出金', 1500000],
          ['完成工事原価', 38500000],
        ],
      },
    ]);
    const { data } = parseExcel(new ArrayBuffer(0));
    const m = data.manufacturing!;
    expect(m.materials).toBe(10000000);
    expect(m.labor).toBe(5000000);
    expect(m.subcontract).toBe(20000000);
    expect(m.expenses).toBe(3000000);
    expect(m.mfgDepreciation).toBe(1000000);
    expect(m.wipBeginning).toBe(2000000);
    expect(m.wipEnding).toBe(1500000);
    expect(m.totalCost).toBe(38500000);
  });

  it('accepts "製造経費" as an alias for expenses', () => {
    mockWorkbook([
      { name: '原価', rows: [['製造経費', 7000000]] },
    ]);
    const { data } = parseExcel(new ArrayBuffer(0));
    expect(data.manufacturing!.expenses).toBe(7000000);
  });

  it('accepts "当期製造原価" as totalCost', () => {
    mockWorkbook([
      { name: '原価', rows: [['当期製造原価', 50000000]] },
    ]);
    const { data } = parseExcel(new ArrayBuffer(0));
    expect(data.manufacturing!.totalCost).toBe(50000000);
  });
});

// ---------------------------------------------------------------------------
// Sheet name fallback (content-based detection)
// ---------------------------------------------------------------------------
describe('content-based sheet detection', () => {
  it('detects BS from content when sheet name is unrecognized', () => {
    mockWorkbook([
      {
        name: 'Sheet1',
        rows: [
          ['流動資産', '', ''],
          ['現金', 500000],
        ],
      },
    ]);
    const { data } = parseExcel(new ArrayBuffer(0));
    expect(data.bs!.currentAssets['現金']).toBe(500000);
  });

  it('detects PL from content when "完成工事高" appears in first 10 rows', () => {
    mockWorkbook([
      {
        name: 'Sheet1',
        rows: [
          ['完成工事高', 100000000],
          ['営業利益', 5000000],
        ],
      },
    ]);
    const { data } = parseExcel(new ArrayBuffer(0));
    expect(data.pl!.completedConstruction).toBe(100000000);
  });

  it('detects PL from content when "売上" appears', () => {
    mockWorkbook([
      {
        name: 'UnknownSheet',
        rows: [
          ['売上高', 90000000],
        ],
      },
    ]);
    const { data } = parseExcel(new ArrayBuffer(0));
    expect(data.pl!.totalSales).toBe(90000000);
  });

  it('does not parse unrecognized sheets with no financial keywords', () => {
    mockWorkbook([
      {
        name: 'Notes',
        rows: [
          ['メモ', 'テスト'],
          ['some label', 12345],
        ],
      },
    ]);
    const { mappings } = parseExcel(new ArrayBuffer(0));
    expect(mappings).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Multiple sheets
// ---------------------------------------------------------------------------
describe('multiple sheets', () => {
  it('parses BS, PL, and manufacturing from separate sheets', () => {
    mockWorkbook([
      { name: 'BS', rows: [['現金', 1000000]] },
      { name: 'PL', rows: [['完成工事高', 50000000]] },
      { name: '原価', rows: [['材料費', 8000000]] },
    ]);
    const { data, mappings } = parseExcel(new ArrayBuffer(0));
    expect(data.bs!.currentAssets['現金']).toBe(1000000);
    expect(data.pl!.completedConstruction).toBe(50000000);
    expect(data.manufacturing!.materials).toBe(8000000);
    expect(mappings.length).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Malformed input
// ---------------------------------------------------------------------------
describe('malformed input', () => {
  it('handles rows with non-string labels (numbers as labels)', () => {
    mockWorkbook([
      {
        name: 'BS',
        rows: [[12345, 999]],
      },
    ]);
    // Should not crash; "12345" is not a recognized keyword
    expect(() => parseExcel(new ArrayBuffer(0))).not.toThrow();
  });

  it('handles rows with undefined cells', () => {
    mockWorkbook([
      {
        name: 'BS',
        rows: [[undefined, undefined, undefined]],
      },
    ]);
    expect(() => parseExcel(new ArrayBuffer(0))).not.toThrow();
  });

  it('handles rows with mixed types', () => {
    mockWorkbook([
      {
        name: 'PL',
        rows: [['完成工事高', 'not-a-number', true, null, 75000000]],
      },
    ]);
    const { data } = parseExcel(new ArrayBuffer(0));
    // Should find 75000000 as the first numeric cell
    expect(data.pl!.completedConstruction).toBe(75000000);
  });

  it('handles labels with leading/trailing whitespace', () => {
    mockWorkbook([
      {
        name: 'BS',
        rows: [['  現金  ', 1234]],
      },
    ]);
    const { data } = parseExcel(new ArrayBuffer(0));
    // Label is trimmed to '現金'
    expect(data.bs!.currentAssets['現金']).toBe(1234);
  });
});

// ---------------------------------------------------------------------------
// parseExcelFromBase64
// ---------------------------------------------------------------------------
describe('parseExcelFromBase64', () => {
  it('decodes base64 and delegates to parseExcel', () => {
    mockWorkbook([
      { name: 'BS', rows: [['現金', 42]] },
    ]);
    const result = parseExcelFromBase64(btoa('fake excel data'));
    expect(XLSX.read).toHaveBeenCalledTimes(1);
    expect(result.data.bs!.currentAssets['現金']).toBe(42);
  });

  it('XLSX.read receives an ArrayBuffer from decoded base64', () => {
    mockWorkbook([]);
    parseExcelFromBase64(btoa('test'));
    const call = vi.mocked(XLSX.read).mock.calls[0];
    expect(call[0]).toBeInstanceOf(ArrayBuffer);
    expect(call[1]).toEqual({ type: 'array' });
  });
});
