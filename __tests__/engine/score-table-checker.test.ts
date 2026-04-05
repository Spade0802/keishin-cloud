/**
 * 評点換算テーブル整合性チェッカーのテスト
 */
import { describe, it, expect } from 'vitest';
import {
  checkScoreTablesAgainstReference,
  generateTableVersionHash,
  CURRENT_TABLE_VERSION,
  runFullCheck,
  type ReferenceTables,
} from '@/lib/score-table-checker';
import {
  X1_TABLE,
  X21_TABLE,
  X22_TABLE,
  Z1_TABLE,
  Z2_TABLE,
  type Bracket,
} from '@/lib/engine/score-tables';

// ---------------------------------------------------------------------------
// ヘルパー: テーブルのディープコピー
// ---------------------------------------------------------------------------
function cloneBrackets(brackets: Bracket[]): Bracket[] {
  return brackets.map((b) => ({ ...b }));
}

// ---------------------------------------------------------------------------
// 同一テーブル比較 → 差異なし
// ---------------------------------------------------------------------------
describe('checkScoreTablesAgainstReference - identical tables', () => {
  it('returns no discrepancies when reference equals current (all tables)', () => {
    const reference: ReferenceTables = {
      X1: cloneBrackets(X1_TABLE),
      X21: cloneBrackets(X21_TABLE),
      X22: cloneBrackets(X22_TABLE),
      Z1: cloneBrackets(Z1_TABLE),
      Z2: cloneBrackets(Z2_TABLE),
    };
    const result = checkScoreTablesAgainstReference(reference);
    expect(result).toEqual([]);
  });

  it('returns no discrepancies when only a subset of tables is provided', () => {
    const reference: ReferenceTables = {
      Z1: cloneBrackets(Z1_TABLE),
    };
    const result = checkScoreTablesAgainstReference(reference);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// ブラケット値の変更検出
// ---------------------------------------------------------------------------
describe('checkScoreTablesAgainstReference - modified brackets', () => {
  it('detects a changed "a" coefficient', () => {
    const ref: ReferenceTables = {
      X1: cloneBrackets(X1_TABLE),
    };
    // 先頭ブラケットの a を変更
    ref.X1![0].a = 999;

    const result = checkScoreTablesAgainstReference(ref);
    expect(result.length).toBe(1);
    expect(result[0]).toMatchObject({
      tableName: 'X1',
      bracketIndex: 0,
      field: 'a',
      expected: '999',
      actual: '131',
    });
  });

  it('detects multiple field changes in the same bracket', () => {
    const ref: ReferenceTables = {
      X21: cloneBrackets(X21_TABLE),
    };
    // index 2 の a と c を変更
    ref.X21![2].a = 100;
    ref.X21![2].c = 200;

    const result = checkScoreTablesAgainstReference(ref);
    expect(result.length).toBe(2);
    expect(result.map((d) => d.field).sort()).toEqual(['a', 'c']);
    expect(result.every((d) => d.tableName === 'X21' && d.bracketIndex === 2)).toBe(true);
  });

  it('detects changes across multiple tables', () => {
    const ref: ReferenceTables = {
      Z1: cloneBrackets(Z1_TABLE),
      Z2: cloneBrackets(Z2_TABLE),
    };
    ref.Z1![0].b = 999;
    ref.Z2![0].c = 999;

    const result = checkScoreTablesAgainstReference(ref);
    expect(result.length).toBe(2);
    const tableNames = result.map((d) => d.tableName);
    expect(tableNames).toContain('Z1');
    expect(tableNames).toContain('Z2');
  });
});

// ---------------------------------------------------------------------------
// ブラケット数の差異検出 (missing / extra)
// ---------------------------------------------------------------------------
describe('checkScoreTablesAgainstReference - missing / extra brackets', () => {
  it('detects extra brackets in current table (reference is shorter)', () => {
    const ref: ReferenceTables = {
      X1: cloneBrackets(X1_TABLE).slice(0, 5), // 5個だけ
    };

    const result = checkScoreTablesAgainstReference(ref);
    // 残りの current brackets は _extra として報告される
    const extras = result.filter((d) => d.field === '_extra');
    expect(extras.length).toBe(X1_TABLE.length - 5);
    expect(extras[0].bracketIndex).toBe(5);
  });

  it('detects missing brackets in current table (reference is longer)', () => {
    const extended = cloneBrackets(Z1_TABLE);
    extended.push({ min: 9999, max: Infinity, a: 0, b: 1, c: 9999 });

    const ref: ReferenceTables = {
      Z1: extended,
    };

    const result = checkScoreTablesAgainstReference(ref);
    const missing = result.filter((d) => d.field === '_missing');
    expect(missing.length).toBe(1);
    expect(missing[0].bracketIndex).toBe(Z1_TABLE.length);
  });
});

// ---------------------------------------------------------------------------
// バージョンハッシュの安定性
// ---------------------------------------------------------------------------
describe('generateTableVersionHash', () => {
  it('returns a stable hash across multiple calls', () => {
    const hash1 = generateTableVersionHash();
    const hash2 = generateTableVersionHash();
    expect(hash1).toBe(hash2);
  });

  it('returns a 16-character hex string', () => {
    const hash = generateTableVersionHash();
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });
});

// ---------------------------------------------------------------------------
// CURRENT_TABLE_VERSION
// ---------------------------------------------------------------------------
describe('CURRENT_TABLE_VERSION', () => {
  it('is a date-format string', () => {
    expect(CURRENT_TABLE_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ---------------------------------------------------------------------------
// runFullCheck
// ---------------------------------------------------------------------------
describe('runFullCheck', () => {
  it('returns a complete CheckResult with no discrepancies for identical tables', () => {
    const ref: ReferenceTables = {
      X1: cloneBrackets(X1_TABLE),
    };
    const result = runFullCheck(ref);
    expect(result.discrepancies).toEqual([]);
    expect(result.currentVersion).toBe(CURRENT_TABLE_VERSION);
    expect(result.checkedAt).toBeTruthy();
  });

  it('includes discrepancies when tables differ', () => {
    const ref: ReferenceTables = {
      X22: cloneBrackets(X22_TABLE),
    };
    ref.X22![0].c = 12345;

    const result = runFullCheck(ref);
    expect(result.discrepancies.length).toBeGreaterThan(0);
    expect(result.currentVersion).toBe(CURRENT_TABLE_VERSION);
  });
});
