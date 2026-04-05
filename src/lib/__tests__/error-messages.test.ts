import { describe, expect, it } from 'vitest';
import * as ErrorMessages from '../error-messages';

// カテゴリ別にエクスポート名を分類
const CATEGORIES: Record<string, RegExp> = {
  AUTH: /^ERR_AUTH_|^ERR_UNAUTHORIZED$|^ERR_FORBIDDEN$/,
  FILE: /^ERR_FILE_|^ERR_UNSUPPORTED_FILE_FORMAT$|^ERR_PDF_ONLY$|^ERR_EXCEL_ONLY$|^ERR_PDF_PARSE|^ERR_EXCEL_PARSE|^ERR_KEISHIN_PDF_PARSE|^ERR_PDF_TEXT_EXTRACTION|^ERR_RESULT_PDF_PARSE/,
  AI: /^ERR_AI_/,
  CALCULATION: /^ERR_SCORE_|^ERR_SALES_|^ERR_CALCULATION_/,
  EXCEL_EXPORT: /^ERR_EXCEL_EXPORT_|^ERR_EXCEL_DOWNLOAD_/,
  STRIPE: /^ERR_STRIPE_/,
  ORG: /^ERR_ORG_/,
  COMPANY: /^ERR_COMPANY_/,
  SIMULATION: /^ERR_SIMULATION_/,
  SIGNUP: /^ERR_SIGNUP_|^ERR_PASSWORD_|^ERR_EMAIL_ALREADY/,
  ADMIN: /^ERR_ADMIN_/,
  REQUEST: /^ERR_INVALID_REQUEST$|^ERR_JSON_PARSE$/,
  GENERIC: /^ERR_GENERIC$|^ERR_PARSE_FAILED$/,
};

const allExports = Object.entries(ErrorMessages) as [string, unknown][];
const allKeys = allExports.map(([key]) => key);

describe('error-messages', () => {
  // ── カテゴリ存在確認 ──────────────────────────────────
  describe('全カテゴリにメッセージが存在する', () => {
    for (const [category, pattern] of Object.entries(CATEGORIES)) {
      it(`${category} カテゴリにメッセージが1件以上ある`, () => {
        const matched = allKeys.filter((k) => pattern.test(k));
        expect(matched.length).toBeGreaterThan(0);
      });
    }
  });

  // ── 全メッセージが非空文字列 ──────────────────────────
  describe('全メッセージが非空文字列である', () => {
    for (const [key, value] of allExports) {
      it(`${key} は非空文字列`, () => {
        expect(typeof value).toBe('string');
        expect((value as string).trim().length).toBeGreaterThan(0);
      });
    }
  });

  // ── 重複メッセージがない ──────────────────────────────
  it('カテゴリを横断してメッセージの重複がない', () => {
    const values = allExports.map(([, v]) => v as string);
    const duplicates = values.filter(
      (v, i) => values.indexOf(v) !== i,
    );
    expect(duplicates).toEqual([]);
  });

  // ── キー命名規則 ──────────────────────────────────────
  describe('キー命名規則', () => {
    it('全てのキーが ERR_ プレフィックスで始まる', () => {
      for (const key of allKeys) {
        expect(key).toMatch(/^ERR_/);
      }
    });

    it('全てのキーが UPPER_SNAKE_CASE である', () => {
      for (const key of allKeys) {
        expect(key).toMatch(/^[A-Z][A-Z0-9_]*$/);
      }
    });
  });

  // ── 全エクスポートがいずれかのカテゴリに属する ────────
  it('全てのエクスポートがいずれかのカテゴリに分類される', () => {
    const uncategorized = allKeys.filter(
      (key) => !Object.values(CATEGORIES).some((re) => re.test(key)),
    );
    expect(uncategorized).toEqual([]);
  });

  // ── スナップショット ──────────────────────────────────
  it('メッセージ内容のスナップショット', () => {
    const snapshot: Record<string, string> = {};
    for (const [key, value] of allExports) {
      snapshot[key] = value as string;
    }
    expect(snapshot).toMatchSnapshot();
  });
});
