/**
 * 評点換算テーブル整合性チェッカー
 *
 * 管理者が国交省の公式テーブルと現行ハードコードテーブルを比較し、
 * 差異を検出するためのユーティリティ。
 *
 * 重要: このモジュールはテーブルを自動更新しない。
 * 差異の検出と報告のみを行い、修正は人間がレビューして行う。
 */
import { createHash } from 'crypto';
import type { Bracket } from '@/lib/engine/score-tables';
import {
  X1_TABLE,
  X21_TABLE,
  X22_TABLE,
  Z1_TABLE,
  Z2_TABLE,
} from '@/lib/engine/score-tables';

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

/** 1件の差異レポート */
export interface DiscrepancyReport {
  tableName: string;
  bracketIndex: number;
  field: keyof Bracket | '_missing' | '_extra';
  expected: number | string;
  actual: number | string;
}

/** テーブル名 → ブラケット配列のマップ */
export type ReferenceTables = Partial<
  Record<'X1' | 'X21' | 'X22' | 'Z1' | 'Z2', Bracket[]>
>;

/** チェック結果 */
export interface CheckResult {
  discrepancies: DiscrepancyReport[];
  currentVersion: string;
  checkedAt: string;
}

// ---------------------------------------------------------------------------
// 定数
// ---------------------------------------------------------------------------

/** 現行テーブルのバージョン（最終確認日ベース） */
export const CURRENT_TABLE_VERSION = '2024-04-01';

/** テーブル名 → 実データのマッピング */
const CURRENT_TABLES: Record<string, Bracket[]> = {
  X1: X1_TABLE,
  X21: X21_TABLE,
  X22: X22_TABLE,
  Z1: Z1_TABLE,
  Z2: Z2_TABLE,
};

// ---------------------------------------------------------------------------
// ハッシュ生成
// ---------------------------------------------------------------------------

/**
 * テーブル群の内容から決定論的なハッシュを生成する。
 * テーブルの値が1つでも変われば異なるハッシュになるため、
 * 「前回チェック時と同じか？」の高速判定に使える。
 */
export function generateTableVersionHash(): string {
  const content = JSON.stringify(
    Object.entries(CURRENT_TABLES)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, brackets]) => ({
        name,
        brackets: brackets.map((b) => ({
          min: b.min === -Infinity ? '-Infinity' : b.min,
          max: b.max === Infinity ? 'Infinity' : b.max,
          a: b.a,
          b: b.b,
          c: b.c,
        })),
      }))
  );
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

// ---------------------------------------------------------------------------
// 比較ロジック
// ---------------------------------------------------------------------------

/**
 * ブラケットの数値を比較用文字列に正規化する。
 * Infinity / -Infinity を文字列として扱う。
 */
function normalizeValue(v: number): string {
  if (v === Infinity) return 'Infinity';
  if (v === -Infinity) return '-Infinity';
  return String(v);
}

/**
 * 参照テーブル（国交省の最新版など）と現行テーブルを比較し、
 * 差異を報告する。
 *
 * @param referenceTables 比較元のテーブル群（部分指定可）
 * @returns 差異リスト（空なら一致）
 */
export function checkScoreTablesAgainstReference(
  referenceTables: ReferenceTables
): DiscrepancyReport[] {
  const discrepancies: DiscrepancyReport[] = [];

  for (const [tableName, refBrackets] of Object.entries(referenceTables)) {
    if (!refBrackets) continue;

    const currentBrackets = CURRENT_TABLES[tableName];
    if (!currentBrackets) {
      // 現行テーブルに存在しない名前が指定された場合
      discrepancies.push({
        tableName,
        bracketIndex: -1,
        field: '_missing',
        expected: `table "${tableName}" in reference`,
        actual: 'not found in current tables',
      });
      continue;
    }

    const maxLen = Math.max(refBrackets.length, currentBrackets.length);

    for (let i = 0; i < maxLen; i++) {
      const ref = refBrackets[i];
      const cur = currentBrackets[i];

      if (!ref && cur) {
        // 現行にはあるが参照にはないブラケット
        discrepancies.push({
          tableName,
          bracketIndex: i,
          field: '_extra',
          expected: 'no bracket',
          actual: `[${normalizeValue(cur.min)}, ${normalizeValue(cur.max)})`,
        });
        continue;
      }

      if (ref && !cur) {
        // 参照にはあるが現行にはないブラケット
        discrepancies.push({
          tableName,
          bracketIndex: i,
          field: '_missing',
          expected: `[${normalizeValue(ref.min)}, ${normalizeValue(ref.max)})`,
          actual: 'no bracket',
        });
        continue;
      }

      if (!ref || !cur) continue;

      // フィールド単位で比較
      const fields: (keyof Bracket)[] = ['min', 'max', 'a', 'b', 'c'];
      for (const field of fields) {
        const refVal = normalizeValue(ref[field]);
        const curVal = normalizeValue(cur[field]);
        if (refVal !== curVal) {
          discrepancies.push({
            tableName,
            bracketIndex: i,
            field,
            expected: refVal,
            actual: curVal,
          });
        }
      }
    }
  }

  return discrepancies;
}

/**
 * 全テーブルのチェックを実行し、結果オブジェクトを返す。
 */
export function runFullCheck(
  referenceTables: ReferenceTables
): CheckResult {
  return {
    discrepancies: checkScoreTablesAgainstReference(referenceTables),
    currentVersion: CURRENT_TABLE_VERSION,
    checkedAt: new Date().toISOString(),
  };
}
