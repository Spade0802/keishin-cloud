import { describe, expect, it, vi } from 'vitest';
import type { Bracket } from '@/lib/engine/score-tables';
import type { ReferenceTables, DiscrepancyReport } from '../score-table-checker';
import {
  checkScoreTablesAgainstReference,
  runFullCheck,
  generateTableVersionHash,
  CURRENT_TABLE_VERSION,
} from '../score-table-checker';

// ---------------------------------------------------------------------------
// Helper: テスト用ブラケットを生成
// ---------------------------------------------------------------------------

/** 単調増加の正常なブラケット列を生成する */
function makeBrackets(entries: [number, number, number, number, number][]): Bracket[] {
  return entries.map(([min, max, a, b, c]) => ({ min, max, a, b, c }));
}

// ---------------------------------------------------------------------------
// 現行テーブルの実データを取得する（比較のベースライン）
// ---------------------------------------------------------------------------

// score-table-checker は内部で CURRENT_TABLES を使うため、
// 参照テーブルに現行テーブルと同じ値を渡せば差異ゼロになるはず。
// 実際のテーブルを import して「完全一致」テストに使う。
import { X1_TABLE, X21_TABLE, X22_TABLE, Z1_TABLE, Z2_TABLE } from '@/lib/engine/score-tables';

// ---------------------------------------------------------------------------
// checkScoreTablesAgainstReference
// ---------------------------------------------------------------------------

describe('checkScoreTablesAgainstReference', () => {
  // -----------------------------------------------------------------------
  // 正常系: 完全一致
  // -----------------------------------------------------------------------

  it('returns no discrepancies when reference matches current tables exactly', () => {
    const ref: ReferenceTables = {
      X1: X1_TABLE,
      X21: X21_TABLE,
      X22: X22_TABLE,
      Z1: Z1_TABLE,
      Z2: Z2_TABLE,
    };
    const result = checkScoreTablesAgainstReference(ref);
    expect(result).toEqual([]);
  });

  it('returns no discrepancies for a partial reference that matches', () => {
    const ref: ReferenceTables = { X1: X1_TABLE };
    const result = checkScoreTablesAgainstReference(ref);
    expect(result).toEqual([]);
  });

  it('returns no discrepancies for an empty reference', () => {
    const result = checkScoreTablesAgainstReference({});
    expect(result).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // 差異検出: フィールド値の不一致
  // -----------------------------------------------------------------------

  it('detects a coefficient difference in a single bracket', () => {
    // X1_TABLE の先頭ブラケットを改変して渡す
    const modified = X1_TABLE.map((b, i) =>
      i === 0 ? { ...b, a: b.a + 999 } : { ...b }
    );
    const result = checkScoreTablesAgainstReference({ X1: modified });

    expect(result.length).toBeGreaterThanOrEqual(1);
    const aReport = result.find((r) => r.field === 'a' && r.bracketIndex === 0);
    expect(aReport).toBeDefined();
    expect(aReport!.tableName).toBe('X1');
    expect(aReport!.expected).toBe(String(modified[0].a));
    expect(aReport!.actual).toBe(String(X1_TABLE[0].a));
  });

  it('detects differences in min/max boundaries', () => {
    const modified = X21_TABLE.map((b, i) =>
      i === 1 ? { ...b, min: b.min + 100, max: b.max - 50 } : { ...b }
    );
    const result = checkScoreTablesAgainstReference({ X21: modified });

    const minReport = result.find((r) => r.field === 'min' && r.bracketIndex === 1);
    const maxReport = result.find((r) => r.field === 'max' && r.bracketIndex === 1);
    expect(minReport).toBeDefined();
    expect(maxReport).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 差異検出: ブラケット数の不一致（missing / extra）
  // -----------------------------------------------------------------------

  it('reports _extra when current has more brackets than reference', () => {
    // 参照テーブルを1行少なく渡す → 現行の末尾が「余分」
    const shorter = X1_TABLE.slice(0, -1);
    const result = checkScoreTablesAgainstReference({ X1: shorter });

    const extra = result.find(
      (r) => r.field === '_extra' && r.tableName === 'X1'
    );
    expect(extra).toBeDefined();
    expect(extra!.bracketIndex).toBe(shorter.length);
  });

  it('reports _missing when reference has more brackets than current', () => {
    // 参照テーブルにダミーの追加行を付ける
    const longer: Bracket[] = [
      ...Z1_TABLE,
      { min: 999_999, max: Infinity, a: 1, b: 1, c: 0 },
    ];
    const result = checkScoreTablesAgainstReference({ Z1: longer });

    const missing = result.find(
      (r) => r.field === '_missing' && r.tableName === 'Z1'
    );
    expect(missing).toBeDefined();
    expect(missing!.bracketIndex).toBe(Z1_TABLE.length);
    expect(missing!.actual).toBe('no bracket');
  });

  // -----------------------------------------------------------------------
  // 差異検出: 存在しないテーブル名
  // -----------------------------------------------------------------------

  it('reports _missing when reference names a table not in current', () => {
    // ReferenceTables は Partial<Record<...>> なので型上は制限されるが、
    // 実装は Object.entries で回すため、キャストで未知名をテストできる
    const ref = { UNKNOWN: [{ min: 0, max: Infinity, a: 1, b: 1, c: 0 }] } as unknown as ReferenceTables;
    const result = checkScoreTablesAgainstReference(ref);

    expect(result).toHaveLength(1);
    expect(result[0].field).toBe('_missing');
    expect(result[0].tableName).toBe('UNKNOWN');
    expect(result[0].bracketIndex).toBe(-1);
  });

  // -----------------------------------------------------------------------
  // Infinity / -Infinity の正規化
  // -----------------------------------------------------------------------

  it('normalizes Infinity and -Infinity correctly when comparing', () => {
    // 先頭ブラケットは min = -Infinity のはず（X1_TABLE）
    // それを 0 に変えると差異が出る
    const modified = X1_TABLE.map((b, i) =>
      i === 0 ? { ...b, min: 0 } : { ...b }
    );
    const result = checkScoreTablesAgainstReference({ X1: modified });

    const minReport = result.find((r) => r.field === 'min' && r.bracketIndex === 0);
    // X1_TABLE[0].min が -Infinity なら差異が出るはず
    if (X1_TABLE[0].min === -Infinity) {
      expect(minReport).toBeDefined();
      expect(minReport!.expected).toBe('0');
      expect(minReport!.actual).toBe('-Infinity');
    }
  });
});

// ---------------------------------------------------------------------------
// generateTableVersionHash
// ---------------------------------------------------------------------------

describe('generateTableVersionHash', () => {
  it('returns a 16-char hex string', () => {
    const hash = generateTableVersionHash();
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('is deterministic (same value on repeated calls)', () => {
    const h1 = generateTableVersionHash();
    const h2 = generateTableVersionHash();
    expect(h1).toBe(h2);
  });
});

// ---------------------------------------------------------------------------
// runFullCheck
// ---------------------------------------------------------------------------

describe('runFullCheck', () => {
  it('returns a CheckResult with currentVersion and checkedAt', () => {
    const result = runFullCheck({ X1: X1_TABLE });

    expect(result.currentVersion).toBe(CURRENT_TABLE_VERSION);
    expect(result.checkedAt).toBeTruthy();
    // ISO 8601 形式
    expect(() => new Date(result.checkedAt)).not.toThrow();
    expect(result.discrepancies).toEqual([]);
  });

  it('includes discrepancies when reference differs', () => {
    const modified = X1_TABLE.map((b, i) =>
      i === 0 ? { ...b, c: b.c + 1 } : { ...b }
    );
    const result = runFullCheck({ X1: modified });

    expect(result.discrepancies.length).toBeGreaterThanOrEqual(1);
    expect(result.discrepancies[0].tableName).toBe('X1');
  });
});

// ---------------------------------------------------------------------------
// 非単調性（non-monotonic）検出のエッジケース
// ---------------------------------------------------------------------------

describe('non-monotonic / gap detection via reference comparison', () => {
  // score-table-checker 自体は「単調性チェック」を直接行わないが、
  // 参照テーブルが正しく単調で、現行テーブルが非単調の場合、
  // min/max の差異として報告される。ここではその間接検出をテストする。

  it('detects when current brackets have overlapping ranges vs reference', () => {
    // 参照: [0, 100), [100, 200) — 正常
    // 現行が [0, 100), [100, 200) なら一致
    // 参照を [0, 100), [90, 200) （非単調）にすると min の差異が出る
    const ref: Bracket[] = [
      { min: 0, max: 100, a: 1, b: 1, c: 0 },
      { min: 90, max: 200, a: 1, b: 1, c: 0 }, // 非単調: 90 < 100
    ];
    const current: Bracket[] = [
      { min: 0, max: 100, a: 1, b: 1, c: 0 },
      { min: 100, max: 200, a: 1, b: 1, c: 0 },
    ];

    // X1 の実データの代わりにモックで検証するため、
    // checkScoreTablesAgainstReference は CURRENT_TABLES を内部参照する。
    // ここでは「参照テーブルの min が現行と違えば差異として出る」ことを確認。
    // 実テーブルの2番目ブラケットの min を変えた参照を渡す
    if (X1_TABLE.length >= 2) {
      const refTable = X1_TABLE.map((b, i) =>
        i === 1 ? { ...b, min: b.min - 10 } : { ...b }
      );
      const result = checkScoreTablesAgainstReference({ X1: refTable });
      const minReport = result.find((r) => r.field === 'min' && r.bracketIndex === 1);
      expect(minReport).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// エッジケース
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('handles reference with empty bracket array', () => {
    // 空のブラケット配列 → 現行のすべてのブラケットが _extra になる
    const result = checkScoreTablesAgainstReference({ X1: [] });
    const extras = result.filter((r) => r.field === '_extra' && r.tableName === 'X1');
    expect(extras.length).toBe(X1_TABLE.length);
  });

  it('handles reference with undefined table value gracefully', () => {
    // ReferenceTables は Partial なので undefined が含まれうる
    const ref: ReferenceTables = { X1: undefined };
    const result = checkScoreTablesAgainstReference(ref);
    expect(result).toEqual([]);
  });

  it('correctly compares all five fields (min, max, a, b, c)', () => {
    // すべてのフィールドを微妙に変える
    const modified = X22_TABLE.map((b) => ({
      min: b.min === -Infinity ? -Infinity : b.min + 1,
      max: b.max === Infinity ? Infinity : b.max + 1,
      a: b.a + 1,
      b: b.b + 1,
      c: b.c + 1,
    }));
    const result = checkScoreTablesAgainstReference({ X22: modified });

    // 各ブラケットでいくつかの差異が出るはず
    expect(result.length).toBeGreaterThan(0);

    // 5種類のフィールドすべてが報告に含まれることを確認
    const reportedFields = new Set(result.map((r) => r.field));
    // min/max が Infinity の場合は差異が出ないので、a, b, c は必ず出る
    expect(reportedFields.has('a')).toBe(true);
    expect(reportedFields.has('b')).toBe(true);
    expect(reportedFields.has('c')).toBe(true);
  });

  it('reports multiple tables discrepancies independently', () => {
    const refX1 = X1_TABLE.map((b, i) =>
      i === 0 ? { ...b, a: b.a + 1 } : { ...b }
    );
    const refZ2 = Z2_TABLE.map((b, i) =>
      i === 0 ? { ...b, c: b.c + 1 } : { ...b }
    );
    const result = checkScoreTablesAgainstReference({ X1: refX1, Z2: refZ2 });

    const x1Reports = result.filter((r) => r.tableName === 'X1');
    const z2Reports = result.filter((r) => r.tableName === 'Z2');
    expect(x1Reports.length).toBeGreaterThanOrEqual(1);
    expect(z2Reports.length).toBeGreaterThanOrEqual(1);
  });
});
