/**
 * セキュリティユーティリティ
 *
 * CSRF オリジン検証、入力サニタイズなど。
 */

/**
 * CSRF: リクエストの Origin ヘッダーを検証する。
 *
 * 許可されたオリジンのリストに含まれていれば true。
 * Origin ヘッダーが無い場合は same-origin とみなし true。
 */
export function isOriginAllowed(
  origin: string | null,
  allowedOrigins: string[],
): boolean {
  // ブラウザが Origin を送らない場合（same-origin GET 等）は許可
  if (!origin) return true;

  // 正規化して比較（末尾スラッシュ除去、小文字化）
  const normalized = origin.replace(/\/+$/, '').toLowerCase();
  return allowedOrigins.some(
    (allowed) => allowed.replace(/\/+$/, '').toLowerCase() === normalized,
  );
}

/** メールアドレスフォーマット検証用正規表現 */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * メールアドレスの形式を検証する。
 * 長さ制限（254文字）も含む。
 */
export function isValidEmail(email: unknown): email is string {
  if (typeof email !== 'string') return false;
  if (email.length > 254) return false;
  return EMAIL_REGEX.test(email);
}

/**
 * 文字列入力をサニタイズする。
 * - 前後の空白をトリム
 * - 最大長を超える場合は切り詰め
 * - 文字列でない場合は null を返す
 */
export function sanitizeString(
  input: unknown,
  maxLength: number,
): string | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, maxLength);
}
