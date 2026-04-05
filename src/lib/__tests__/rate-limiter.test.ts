import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { RateLimiter } from '../rate-limiter';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter({ windowMs: 10_000, maxRequests: 3 });
  });

  afterEach(() => {
    limiter.destroy();
  });

  // -----------------------------------------------------------------------
  // consume: under limit
  // -----------------------------------------------------------------------
  it('allows requests under the limit', () => {
    const r1 = limiter.consume('user-1');
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = limiter.consume('user-1');
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = limiter.consume('user-1');
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  // -----------------------------------------------------------------------
  // consume: over limit
  // -----------------------------------------------------------------------
  it('blocks requests over the limit', () => {
    limiter.consume('user-1');
    limiter.consume('user-1');
    limiter.consume('user-1');

    const r4 = limiter.consume('user-1');
    expect(r4.allowed).toBe(false);
    expect(r4.remaining).toBe(0);
  });

  // -----------------------------------------------------------------------
  // check: does not decrement tokens
  // -----------------------------------------------------------------------
  it('check does not consume a token', () => {
    limiter.consume('user-2');

    const checkResult = limiter.check('user-2');
    expect(checkResult.allowed).toBe(true);
    expect(checkResult.remaining).toBe(2);

    // Consume again - should still allow (check didn't eat a token)
    const r2 = limiter.consume('user-2');
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);
  });

  it('check returns allowed true when no requests made yet', () => {
    const result = limiter.check('new-user');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(3);
  });

  // -----------------------------------------------------------------------
  // reset after window expires
  // -----------------------------------------------------------------------
  it('resets after the time window expires', () => {
    vi.useFakeTimers();
    try {
      const timedLimiter = new RateLimiter({ windowMs: 5_000, maxRequests: 2 });

      timedLimiter.consume('user-3');
      timedLimiter.consume('user-3');

      const blocked = timedLimiter.consume('user-3');
      expect(blocked.allowed).toBe(false);

      // Advance past the window
      vi.advanceTimersByTime(6_000);

      const afterWindow = timedLimiter.consume('user-3');
      expect(afterWindow.allowed).toBe(true);
      expect(afterWindow.remaining).toBe(1);

      timedLimiter.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  // -----------------------------------------------------------------------
  // different keys are independent
  // -----------------------------------------------------------------------
  it('tracks keys independently', () => {
    limiter.consume('a');
    limiter.consume('a');
    limiter.consume('a');

    const rA = limiter.consume('a');
    expect(rA.allowed).toBe(false);

    const rB = limiter.consume('b');
    expect(rB.allowed).toBe(true);
    expect(rB.remaining).toBe(2);
  });

  // -----------------------------------------------------------------------
  // resetAt is a Date in the future
  // -----------------------------------------------------------------------
  it('returns a resetAt Date', () => {
    const result = limiter.consume('user-4');
    expect(result.resetAt).toBeInstanceOf(Date);
    expect(result.resetAt.getTime()).toBeGreaterThanOrEqual(Date.now());
  });
});
