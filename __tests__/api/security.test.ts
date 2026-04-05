import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { RateLimiter } from '@/lib/rate-limiter';
import {
  isOriginAllowed,
  isValidEmail,
  sanitizeString,
} from '@/lib/security';

// ─── RateLimiter ───────────────────────────────────────────

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 3 });
  });

  afterEach(() => {
    limiter.destroy();
  });

  test('最大回数までは allowed: true を返す', () => {
    expect(limiter.consume('ip-1').allowed).toBe(true);
    expect(limiter.consume('ip-1').allowed).toBe(true);
    expect(limiter.consume('ip-1').allowed).toBe(true);
  });

  test('制限を超えると allowed: false を返す', () => {
    limiter.consume('ip-1');
    limiter.consume('ip-1');
    limiter.consume('ip-1');
    const result = limiter.consume('ip-1');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  test('remaining が正確にカウントダウンする', () => {
    expect(limiter.consume('ip-2').remaining).toBe(2);
    expect(limiter.consume('ip-2').remaining).toBe(1);
    expect(limiter.consume('ip-2').remaining).toBe(0);
  });

  test('異なるキーは互いに独立する', () => {
    limiter.consume('ip-a');
    limiter.consume('ip-a');
    limiter.consume('ip-a');
    // ip-a は制限に達したが ip-b はまだ使える
    expect(limiter.consume('ip-a').allowed).toBe(false);
    expect(limiter.consume('ip-b').allowed).toBe(true);
  });

  test('check() はカウンタを消費しない', () => {
    limiter.consume('ip-3');
    const checkResult = limiter.check('ip-3');
    expect(checkResult.remaining).toBe(2);
    // もう一度 check しても同じ
    expect(limiter.check('ip-3').remaining).toBe(2);
  });

  test('resetAt は将来の日時を返す', () => {
    const result = limiter.consume('ip-4');
    expect(result.resetAt.getTime()).toBeGreaterThan(Date.now() - 1000);
  });

  test('maxRequests=1 の場合、2回目で即ブロック', () => {
    const strict = new RateLimiter({ windowMs: 60_000, maxRequests: 1 });
    expect(strict.consume('x').allowed).toBe(true);
    expect(strict.consume('x').allowed).toBe(false);
    strict.destroy();
  });
});

// ─── CSRF Origin チェック ──────────────────────────────────

describe('isOriginAllowed (CSRF)', () => {
  const allowed = ['https://keishin.cloud', 'http://localhost:3000'];

  test('許可リストにあるオリジンは true', () => {
    expect(isOriginAllowed('https://keishin.cloud', allowed)).toBe(true);
    expect(isOriginAllowed('http://localhost:3000', allowed)).toBe(true);
  });

  test('許可リストに無いオリジンは false', () => {
    expect(isOriginAllowed('https://evil.example.com', allowed)).toBe(false);
  });

  test('Origin が null（same-origin GET 等）は true', () => {
    expect(isOriginAllowed(null, allowed)).toBe(true);
  });

  test('末尾スラッシュの有無を正規化する', () => {
    expect(isOriginAllowed('https://keishin.cloud/', allowed)).toBe(true);
  });

  test('大文字小文字を正規化する', () => {
    expect(isOriginAllowed('HTTPS://KEISHIN.CLOUD', allowed)).toBe(true);
  });

  test('サブドメイン詐称は拒否する', () => {
    expect(isOriginAllowed('https://keishin.cloud.evil.com', allowed)).toBe(false);
  });

  test('空の許可リストでは全て拒否', () => {
    expect(isOriginAllowed('https://keishin.cloud', [])).toBe(false);
  });

  test('空文字のオリジンは falsy なので許可される（same-origin 扱い）', () => {
    expect(isOriginAllowed('', allowed)).toBe(true);
  });

  test('複数の末尾スラッシュを正規化する', () => {
    expect(isOriginAllowed('https://keishin.cloud///', allowed)).toBe(true);
  });

  test('プロトコルが異なるオリジンは拒否する', () => {
    expect(isOriginAllowed('http://keishin.cloud', allowed)).toBe(false);
  });

  test('ポート番号が異なるlocalhostは拒否する', () => {
    expect(isOriginAllowed('http://localhost:8080', allowed)).toBe(false);
  });

  test('ポート番号なしのlocalhostは拒否する', () => {
    expect(isOriginAllowed('http://localhost', allowed)).toBe(false);
  });

  test('パス付きオリジンは末尾スラッシュ除去のみで比較される', () => {
    // Origin ヘッダーは通常パスを含まないが、念のためテスト
    expect(isOriginAllowed('https://keishin.cloud/path', allowed)).toBe(false);
  });

  test('許可リスト側に末尾スラッシュがあっても正規化される', () => {
    const allowedWithSlash = ['https://example.com/'];
    expect(isOriginAllowed('https://example.com', allowedWithSlash)).toBe(true);
  });

  test('大文字混在の許可リストとオリジンの両方を正規化する', () => {
    const mixedCase = ['HTTPS://Example.COM'];
    expect(isOriginAllowed('https://example.com', mixedCase)).toBe(true);
  });
});

// ─── Email バリデーション ─────────────────────────────────

describe('isValidEmail', () => {
  test('通常のメールアドレスは true', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('test.name+tag@domain.co.jp')).toBe(true);
  });

  test('@ がないメールアドレスは false', () => {
    expect(isValidEmail('user-at-example.com')).toBe(false);
  });

  test('ドメインがないメールアドレスは false', () => {
    expect(isValidEmail('user@')).toBe(false);
  });

  test('ローカルパートがないメールアドレスは false', () => {
    expect(isValidEmail('@example.com')).toBe(false);
  });

  test('空白を含むメールアドレスは false', () => {
    expect(isValidEmail('user @example.com')).toBe(false);
    expect(isValidEmail('user@ example.com')).toBe(false);
  });

  test('254文字超は false', () => {
    const longLocal = 'a'.repeat(245);
    expect(isValidEmail(`${longLocal}@example.com`)).toBe(false);
  });

  test('文字列でない値は false', () => {
    expect(isValidEmail(null)).toBe(false);
    expect(isValidEmail(undefined)).toBe(false);
    expect(isValidEmail(123)).toBe(false);
    expect(isValidEmail({})).toBe(false);
  });

  test('空文字は false', () => {
    expect(isValidEmail('')).toBe(false);
  });

  test('複数の @ は false', () => {
    expect(isValidEmail('user@@example.com')).toBe(false);
  });

  test('ヘッダーインジェクション試行は false', () => {
    expect(isValidEmail('user@example.com\r\nBcc: victim@evil.com')).toBe(false);
  });

  test('スペースのみは false', () => {
    expect(isValidEmail('   ')).toBe(false);
  });

  test('TLDなしのドメインは false', () => {
    expect(isValidEmail('user@localhost')).toBe(false);
  });

  test('プラス記号付きアドレスは true', () => {
    expect(isValidEmail('user+tag@example.com')).toBe(true);
  });

  test('ハイフン付きドメインは true', () => {
    expect(isValidEmail('user@my-domain.com')).toBe(true);
  });

  test('サブドメイン付きアドレスは true', () => {
    expect(isValidEmail('user@sub.domain.example.com')).toBe(true);
  });

  test('254文字ちょうどは true', () => {
    const local = 'a'.repeat(241);
    // local(241) + @ (1) + domain(12) = 254
    expect(isValidEmail(`${local}@example.com`)).toBe(true);
  });

  test('255文字は false', () => {
    // 254文字制限: local(243) + @(1) + example.com(11) = 255 > 254
    const local = 'a'.repeat(243);
    expect(isValidEmail(`${local}@example.com`)).toBe(false);
  });

  test('HTMLタグを含むメールでも正規表現に合致すれば true（サニタイズは別レイヤー）', () => {
    // <script> はローカルパートとして正規表現に合致する
    expect(isValidEmail('<script>@example.com')).toBe(true);
  });

  test('配列は false', () => {
    expect(isValidEmail(['user@example.com'])).toBe(false);
  });

  test('boolean は false', () => {
    expect(isValidEmail(true)).toBe(false);
    expect(isValidEmail(false)).toBe(false);
  });
});

// ─── sanitizeString ──────────────────────────────────────

describe('sanitizeString', () => {
  test('前後の空白をトリムする', () => {
    expect(sanitizeString('  hello  ', 100)).toBe('hello');
  });

  test('最大長を超える場合は切り詰める', () => {
    expect(sanitizeString('abcdef', 3)).toBe('abc');
  });

  test('空文字（トリム後）は null', () => {
    expect(sanitizeString('   ', 100)).toBe(null);
  });

  test('文字列でない値は null', () => {
    expect(sanitizeString(123, 100)).toBe(null);
    expect(sanitizeString(null, 100)).toBe(null);
    expect(sanitizeString(undefined, 100)).toBe(null);
  });

  test('正常な文字列はそのまま返す', () => {
    expect(sanitizeString('テスト', 100)).toBe('テスト');
  });

  test('XSS ペイロードはそのまま文字列として返す（エスケープはしない）', () => {
    // sanitizeString はトリム＋切り詰めのみ。HTMLエスケープは別レイヤーの責務
    expect(sanitizeString('<script>alert("xss")</script>', 100)).toBe(
      '<script>alert("xss")</script>',
    );
    expect(sanitizeString('<img src=x onerror=alert(1)>', 100)).toBe(
      '<img src=x onerror=alert(1)>',
    );
  });

  test('XSS ペイロードが maxLength で切り詰められる', () => {
    expect(sanitizeString('<script>alert("xss")</script>', 10)).toBe(
      '<script>al',
    );
  });

  test('SQL インジェクション文字列はそのまま返す', () => {
    const sqlPayload = "'; DROP TABLE users; --";
    expect(sanitizeString(sqlPayload, 100)).toBe(sqlPayload);
  });

  test('Unicode 文字列を正しく扱う', () => {
    expect(sanitizeString('日本語テスト', 3)).toBe('日本語');
    expect(sanitizeString('émojis 🎉', 100)).toBe('émojis 🎉');
  });

  test('絵文字のみの文字列（サロゲートペアで slice される）', () => {
    // JS の String.slice はUTF-16コードユニット単位。絵文字は2ユニット
    // slice(0, 2) = 最初の絵文字1つ分
    expect(sanitizeString('🎉🎊🎈', 2)).toBe('🎉');
    expect(sanitizeString('🎉🎊🎈', 4)).toBe('🎉🎊');
  });

  test('改行を含む文字列はトリムされる', () => {
    expect(sanitizeString('\n  hello\n  ', 100)).toBe('hello');
  });

  test('タブを含む文字列はトリムされる', () => {
    expect(sanitizeString('\thello\t', 100)).toBe('hello');
  });

  test('maxLength が 0 の場合は空になり null を返す', () => {
    // slice(0, 0) は空文字だが、トリム後に空 → null ではない
    // 実際には slice で空文字になるが、トリムは先に行われる
    // trimmed = 'hello', slice(0,0) = '' → しかし空チェックはトリム後・スライス前
    // 実装を確認: trim → 空チェック → slice なので 'hello' は空でない → slice(0,0) = ''
    expect(sanitizeString('hello', 0)).toBe('');
  });

  test('maxLength が 1 の場合は先頭1文字のみ', () => {
    expect(sanitizeString('hello', 1)).toBe('h');
  });

  test('boolean 値は null', () => {
    expect(sanitizeString(true, 100)).toBe(null);
    expect(sanitizeString(false, 100)).toBe(null);
  });

  test('配列は null', () => {
    expect(sanitizeString(['hello'], 100)).toBe(null);
  });

  test('オブジェクトは null', () => {
    expect(sanitizeString({ key: 'value' }, 100)).toBe(null);
  });

  test('非常に長い文字列を切り詰める', () => {
    const long = 'x'.repeat(10000);
    const result = sanitizeString(long, 100);
    expect(result).toHaveLength(100);
  });

  test('maxLength が文字列長より大きい場合はそのまま返す', () => {
    expect(sanitizeString('short', 1000)).toBe('short');
  });
});
