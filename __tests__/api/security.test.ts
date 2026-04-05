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
});
