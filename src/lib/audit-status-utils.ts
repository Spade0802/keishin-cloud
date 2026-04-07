/**
 * 監査受審状況の値を正規化するユーティリティ
 *
 * クライアントサイド（extraction-validator）でも使用するため、
 * Node.js 依存のある keishin-pdf-parser.ts から分離。
 */

/**
 * 監査受審状況の生の値を公式の 0-4 スケールに正規化する。
 * 数値 0-4 はそのまま、全角数字・文字列ラベルも正しくマッピングする。
 */
export function normalizeAuditStatusValue(raw: unknown): number {
  // すでに正しい数値の場合
  if (typeof raw === 'number') {
    if (raw >= 0 && raw <= 4) return raw;
    return 0; // 範囲外は 0 にフォールバック
  }

  if (typeof raw !== 'string') return 0;

  // 全角数字を半角に変換
  const s = raw
    .replace(/[０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
    .trim();

  // 数字文字列の場合
  const num = parseInt(s, 10);
  if (!isNaN(num) && num >= 0 && num <= 4) return num;

  // テキストラベルによるマッピング
  if (/会計監査人/.test(s)) return 4;
  if (/経理処理の適正|経理士.*監査|自主監査/.test(s)) return 3;
  if (/会計参与/.test(s)) return 2;
  if (/社内.*監査|社内監査/.test(s)) return 1;
  if (/無|なし|該当なし/.test(s)) return 0;

  return 0;
}
