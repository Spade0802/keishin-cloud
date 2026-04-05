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

  // -----------------------------------------------------------------------
  // Multiple keys: independent tracking for many users
  // -----------------------------------------------------------------------
  describe('multiple keys (different users)', () => {
    it('exhausting one key does not affect others', () => {
      // Exhaust key "alice"
      limiter.consume('alice');
      limiter.consume('alice');
      limiter.consume('alice');
      expect(limiter.consume('alice').allowed).toBe(false);

      // "bob" and "carol" are still fully available
      const bobFirst = limiter.consume('bob');
      expect(bobFirst.allowed).toBe(true);
      expect(bobFirst.remaining).toBe(2);

      const carolFirst = limiter.consume('carol');
      expect(carolFirst.allowed).toBe(true);
      expect(carolFirst.remaining).toBe(2);
    });

    it('check on one key does not leak state to another', () => {
      limiter.consume('x');
      limiter.consume('x');

      // check "x" should show 1 remaining; "y" should show 3
      expect(limiter.check('x').remaining).toBe(1);
      expect(limiter.check('y').remaining).toBe(3);
      expect(limiter.check('y').allowed).toBe(true);
    });

    it('handles many keys without cross-contamination', () => {
      const keys = Array.from({ length: 50 }, (_, i) => `user-${i}`);
      for (const key of keys) {
        limiter.consume(key);
      }
      // Every key should have 2 remaining
      for (const key of keys) {
        const result = limiter.check(key);
        expect(result.remaining).toBe(2);
        expect(result.allowed).toBe(true);
      }
    });
  });

  // -----------------------------------------------------------------------
  // Rate limit reset behavior (sliding window)
  // -----------------------------------------------------------------------
  describe('rate limit reset behavior', () => {
    it('sliding window allows requests as old ones expire', () => {
      vi.useFakeTimers();
      try {
        const lim = new RateLimiter({ windowMs: 10_000, maxRequests: 2 });

        // t=0: first request
        lim.consume('u');
        // t=3s: second request
        vi.advanceTimersByTime(3_000);
        lim.consume('u');

        // t=3s: blocked
        expect(lim.consume('u').allowed).toBe(false);

        // t=11s: first request expired (was at t=0, window is 10s)
        vi.advanceTimersByTime(8_000);
        const result = lim.consume('u');
        expect(result.allowed).toBe(true);
        // second request (t=3s) is still in window, plus the new one at t=11s => remaining=0
        expect(result.remaining).toBe(0);

        // t=11s: blocked again
        expect(lim.consume('u').allowed).toBe(false);

        // t=14s: second request (t=3s) expires
        vi.advanceTimersByTime(3_000);
        const result2 = lim.consume('u');
        expect(result2.allowed).toBe(true);

        lim.destroy();
      } finally {
        vi.useRealTimers();
      }
    });

    it('all tokens restore after full window elapses with no activity', () => {
      vi.useFakeTimers();
      try {
        const lim = new RateLimiter({ windowMs: 5_000, maxRequests: 3 });

        lim.consume('k');
        lim.consume('k');
        lim.consume('k');
        expect(lim.consume('k').allowed).toBe(false);

        vi.advanceTimersByTime(6_000);

        const result = lim.check('k');
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(3);

        lim.destroy();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------
  describe('edge cases', () => {
    it('maxRequests=0 blocks all requests immediately', () => {
      const lim = new RateLimiter({ windowMs: 10_000, maxRequests: 0 });

      const result = lim.consume('any');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);

      const checkResult = lim.check('any');
      expect(checkResult.allowed).toBe(false);
      expect(checkResult.remaining).toBe(0);

      lim.destroy();
    });

    it('maxRequests=1 allows exactly one request', () => {
      const lim = new RateLimiter({ windowMs: 10_000, maxRequests: 1 });

      const r1 = lim.consume('single');
      expect(r1.allowed).toBe(true);
      expect(r1.remaining).toBe(0);

      const r2 = lim.consume('single');
      expect(r2.allowed).toBe(false);

      lim.destroy();
    });

    it('empty string key works as a valid key', () => {
      const r1 = limiter.consume('');
      expect(r1.allowed).toBe(true);
      expect(r1.remaining).toBe(2);
    });

    it('very short windowMs expires quickly', () => {
      vi.useFakeTimers();
      try {
        const lim = new RateLimiter({ windowMs: 1, maxRequests: 1 });

        lim.consume('fast');
        expect(lim.consume('fast').allowed).toBe(false);

        vi.advanceTimersByTime(2);

        expect(lim.consume('fast').allowed).toBe(true);

        lim.destroy();
      } finally {
        vi.useRealTimers();
      }
    });

    it('check on a never-seen key returns full capacity', () => {
      const result = limiter.check('never-seen');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(3);
      expect(result.resetAt).toBeInstanceOf(Date);
    });
  });

  // -----------------------------------------------------------------------
  // Concurrent access patterns (simulated)
  // -----------------------------------------------------------------------
  describe('concurrent access patterns', () => {
    it('rapid sequential consumes respect the limit exactly', () => {
      const lim = new RateLimiter({ windowMs: 60_000, maxRequests: 5 });
      const results = Array.from({ length: 10 }, () => lim.consume('burst'));

      const allowed = results.filter((r) => r.allowed);
      const blocked = results.filter((r) => !r.allowed);

      expect(allowed).toHaveLength(5);
      expect(blocked).toHaveLength(5);

      // remaining should decrease: 4, 3, 2, 1, 0, then 0 for blocked
      expect(allowed.map((r) => r.remaining)).toEqual([4, 3, 2, 1, 0]);
      expect(blocked.every((r) => r.remaining === 0)).toBe(true);

      lim.destroy();
    });

    it('interleaved consume and check are consistent', () => {
      limiter.consume('ic');
      expect(limiter.check('ic').remaining).toBe(2);

      limiter.consume('ic');
      expect(limiter.check('ic').remaining).toBe(1);

      limiter.consume('ic');
      expect(limiter.check('ic').remaining).toBe(0);
      expect(limiter.check('ic').allowed).toBe(false);

      // Another consume should also be blocked
      expect(limiter.consume('ic').allowed).toBe(false);
      // check still shows 0
      expect(limiter.check('ic').remaining).toBe(0);
    });

    it('multiple keys consumed in interleaved order', () => {
      limiter.consume('p');
      limiter.consume('q');
      limiter.consume('p');
      limiter.consume('q');
      limiter.consume('p');

      expect(limiter.check('p').remaining).toBe(0);
      expect(limiter.check('p').allowed).toBe(false);
      expect(limiter.check('q').remaining).toBe(1);
      expect(limiter.check('q').allowed).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // resetAt accuracy
  // -----------------------------------------------------------------------
  describe('resetAt accuracy', () => {
    it('resetAt equals first hit timestamp + windowMs after consume', () => {
      vi.useFakeTimers({ now: 1_000_000 });
      try {
        const lim = new RateLimiter({ windowMs: 10_000, maxRequests: 3 });

        const r1 = lim.consume('ra');
        // First hit at t=1_000_000, so resetAt = 1_000_000 + 10_000
        expect(r1.resetAt.getTime()).toBe(1_010_000);

        vi.advanceTimersByTime(2_000); // t=1_002_000
        const r2 = lim.consume('ra');
        // resetAt still based on first hit
        expect(r2.resetAt.getTime()).toBe(1_010_000);

        vi.advanceTimersByTime(3_000); // t=1_005_000
        const r3 = lim.consume('ra');
        expect(r3.resetAt.getTime()).toBe(1_010_000);

        lim.destroy();
      } finally {
        vi.useRealTimers();
      }
    });

    it('resetAt updates after oldest hit expires', () => {
      vi.useFakeTimers({ now: 1_000_000 });
      try {
        const lim = new RateLimiter({ windowMs: 10_000, maxRequests: 2 });

        lim.consume('rb'); // t=1_000_000
        vi.advanceTimersByTime(3_000); // t=1_003_000
        lim.consume('rb'); // t=1_003_000

        // blocked
        expect(lim.consume('rb').allowed).toBe(false);

        // Advance so first hit expires: t=1_011_000
        vi.advanceTimersByTime(8_000);
        const r = lim.consume('rb'); // new hit at t=1_011_000
        expect(r.allowed).toBe(true);
        // Now oldest hit in window is at t=1_003_000
        expect(r.resetAt.getTime()).toBe(1_003_000 + 10_000); // 1_013_000

        lim.destroy();
      } finally {
        vi.useRealTimers();
      }
    });

    it('check resetAt for unseen key equals now + windowMs', () => {
      vi.useFakeTimers({ now: 5_000_000 });
      try {
        const lim = new RateLimiter({ windowMs: 20_000, maxRequests: 5 });

        const result = lim.check('unseen');
        expect(result.resetAt.getTime()).toBe(5_020_000);

        lim.destroy();
      } finally {
        vi.useRealTimers();
      }
    });

    it('resetAt on blocked consume reflects when first slot opens', () => {
      vi.useFakeTimers({ now: 2_000_000 });
      try {
        const lim = new RateLimiter({ windowMs: 10_000, maxRequests: 2 });

        lim.consume('rc'); // t=2_000_000
        vi.advanceTimersByTime(1_000); // t=2_001_000
        lim.consume('rc'); // t=2_001_000

        const blocked = lim.consume('rc');
        expect(blocked.allowed).toBe(false);
        // resetAt should be when the oldest entry (t=2_000_000) expires
        expect(blocked.resetAt.getTime()).toBe(2_000_000 + 10_000);

        lim.destroy();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  // -----------------------------------------------------------------------
  // cleanup timer
  // -----------------------------------------------------------------------
  describe('cleanup', () => {
    it('cleanup timer removes expired entries', () => {
      vi.useFakeTimers();
      try {
        const lim = new RateLimiter({ windowMs: 5_000, maxRequests: 3 });

        lim.consume('cleanup-test');
        lim.consume('cleanup-test');

        // Advance past window so entries expire
        vi.advanceTimersByTime(6_000);

        // Advance to trigger cleanup (5 min interval)
        vi.advanceTimersByTime(5 * 60 * 1000);

        // After cleanup, key should have full capacity
        const result = lim.check('cleanup-test');
        expect(result.remaining).toBe(3);
        expect(result.allowed).toBe(true);

        lim.destroy();
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
