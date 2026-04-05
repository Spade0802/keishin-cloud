import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
  generateInputHash,
  getCachedAnalysis,
  setCachedAnalysis,
  clearAnalysisCache,
  getCacheStats,
} from '../ai-cache';
import type { AnalysisResult } from '../ai-analysis-types';

// ---------------------------------------------------------------------------
// Helper: minimal AnalysisResult stub
// ---------------------------------------------------------------------------
function stubResult(summary = 'test'): AnalysisResult {
  return {
    reclassificationReview: [],
    simulationComparison: [],
    itemAssessments: [],
    riskPoints: [],
    impactRanking: [],
    checklistItems: [],
    summary,
    disclaimer: 'test disclaimer',
  };
}

/** Create a stub with a large summary string of approximately `sizeBytes` bytes */
function largeStubResult(sizeBytes: number): AnalysisResult {
  const largeSummary = 'x'.repeat(sizeBytes);
  return stubResult(largeSummary);
}

describe('ai-cache', () => {
  beforeEach(() => {
    clearAnalysisCache();
  });

  // -----------------------------------------------------------------------
  // get / set basic operations
  // -----------------------------------------------------------------------
  it('returns undefined for a cache miss', () => {
    const result = getCachedAnalysis('nonexistent-hash');
    expect(result).toBeUndefined();
  });

  it('stores and retrieves a cached result', () => {
    const expected = stubResult('stored');
    setCachedAnalysis('hash-1', expected);
    const cached = getCachedAnalysis('hash-1');
    expect(cached).toBeDefined();
    expect(cached!.summary).toBe('stored');
  });

  it('generateInputHash produces consistent hashes for same input', () => {
    const input = {
      companyName: 'テスト',
      period: '第30期',
      industries: [],
      Y: 100,
      X2: 200,
      X21: 100,
      X22: 100,
      W: 300,
      wTotal: 30,
      yResult: {
        indicators: {},
        indicatorsRaw: {},
        A: 50,
        Y: 100,
        operatingCF: 1000,
      },
    };
    const h1 = generateInputHash(input as never);
    const h2 = generateInputHash(input as never);
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64); // SHA-256 hex
  });

  it('generateInputHash produces different hashes for different input', () => {
    const input1 = { companyName: 'A', period: '1', industries: [], Y: 1, X2: 1, X21: 1, X22: 1, W: 1, wTotal: 1, yResult: { indicators: {}, indicatorsRaw: {}, A: 1, Y: 1, operatingCF: 1 } };
    const input2 = { companyName: 'B', period: '1', industries: [], Y: 1, X2: 1, X21: 1, X22: 1, W: 1, wTotal: 1, yResult: { indicators: {}, indicatorsRaw: {}, A: 1, Y: 1, operatingCF: 1 } };
    expect(generateInputHash(input1 as never)).not.toBe(generateInputHash(input2 as never));
  });

  it('generateInputHash is stable regardless of key insertion order', () => {
    const input1 = { companyName: 'A', period: '1', industries: [], Y: 1, X2: 1, X21: 1, X22: 1, W: 1, wTotal: 1, yResult: { indicators: {}, indicatorsRaw: {}, A: 1, Y: 1, operatingCF: 1 } };
    // Same data, different property order
    const input2 = { wTotal: 1, W: 1, X22: 1, X21: 1, X2: 1, Y: 1, industries: [], period: '1', companyName: 'A', yResult: { operatingCF: 1, Y: 1, A: 1, indicatorsRaw: {}, indicators: {} } };
    expect(generateInputHash(input1 as never)).toBe(generateInputHash(input2 as never));
  });

  // -----------------------------------------------------------------------
  // MAX_ENTRIES eviction
  // -----------------------------------------------------------------------
  it('evicts oldest entry when exceeding MAX_ENTRIES (100)', () => {
    // Fill cache to 100 entries
    for (let i = 0; i < 100; i++) {
      setCachedAnalysis(`hash-${i}`, stubResult(`result-${i}`));
    }

    // The first entry should still be there
    expect(getCachedAnalysis('hash-0')).toBeDefined();

    // Adding entry 101 should evict hash-0 (the oldest)
    setCachedAnalysis('hash-100', stubResult('result-100'));

    expect(getCachedAnalysis('hash-0')).toBeUndefined();
    expect(getCachedAnalysis('hash-100')).toBeDefined();

    const stats = getCacheStats();
    expect(stats.size).toBe(100);
  });

  it('evicts multiple oldest entries as new ones are added beyond limit', () => {
    for (let i = 0; i < 100; i++) {
      setCachedAnalysis(`hash-${i}`, stubResult(`result-${i}`));
    }

    // Add 5 more entries, evicting hash-0 through hash-4
    for (let i = 100; i < 105; i++) {
      setCachedAnalysis(`hash-${i}`, stubResult(`result-${i}`));
    }

    for (let i = 0; i < 5; i++) {
      expect(getCachedAnalysis(`hash-${i}`)).toBeUndefined();
    }
    // hash-5 should still exist (it was 6th oldest)
    expect(getCachedAnalysis('hash-5')).toBeDefined();
    // All new entries should exist
    for (let i = 100; i < 105; i++) {
      expect(getCachedAnalysis(`hash-${i}`)).toBeDefined();
    }

    expect(getCacheStats().size).toBe(100);
  });

  it('does not evict when updating an existing key at max capacity', () => {
    for (let i = 0; i < 100; i++) {
      setCachedAnalysis(`hash-${i}`, stubResult(`result-${i}`));
    }

    // Update an existing key -- should NOT evict anything
    setCachedAnalysis('hash-50', stubResult('updated-50'));

    expect(getCachedAnalysis('hash-0')).toBeDefined();
    expect(getCachedAnalysis('hash-50')!.summary).toBe('updated-50');
    expect(getCacheStats().size).toBe(100);
  });

  // -----------------------------------------------------------------------
  // TTL expiration
  // -----------------------------------------------------------------------
  describe('TTL expiration', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      clearAnalysisCache();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('expires entries after TTL', () => {
      const shortTtl = 5_000; // 5 seconds
      setCachedAnalysis('ttl-hash', stubResult('ttl-test'), shortTtl);

      // Should be available immediately
      expect(getCachedAnalysis('ttl-hash')).toBeDefined();

      // Advance past TTL
      vi.advanceTimersByTime(6_000);

      // Should be expired now
      expect(getCachedAnalysis('ttl-hash')).toBeUndefined();
    });

    it('does not expire entries before TTL elapses', () => {
      setCachedAnalysis('ttl-hash', stubResult('still-valid'), 10_000);

      vi.advanceTimersByTime(9_999);
      expect(getCachedAnalysis('ttl-hash')).toBeDefined();
      expect(getCachedAnalysis('ttl-hash')!.summary).toBe('still-valid');
    });

    it('expires entry at exact TTL boundary (1ms past)', () => {
      setCachedAnalysis('boundary', stubResult('boundary'), 5_000);

      vi.advanceTimersByTime(5_000);
      // At exactly TTL, Date.now() - createdAt === ttlMs, which is NOT > ttlMs
      expect(getCachedAnalysis('boundary')).toBeDefined();

      vi.advanceTimersByTime(1);
      // Now 5001ms > 5000ms ttl
      expect(getCachedAnalysis('boundary')).toBeUndefined();
    });

    it('entries with different TTLs expire independently', () => {
      setCachedAnalysis('short', stubResult('short'), 3_000);
      setCachedAnalysis('long', stubResult('long'), 10_000);

      vi.advanceTimersByTime(4_000);
      expect(getCachedAnalysis('short')).toBeUndefined();
      expect(getCachedAnalysis('long')).toBeDefined();

      vi.advanceTimersByTime(7_000);
      expect(getCachedAnalysis('long')).toBeUndefined();
    });

    it('getCacheStats purges expired entries from size count', () => {
      setCachedAnalysis('a', stubResult('a'), 2_000);
      setCachedAnalysis('b', stubResult('b'), 5_000);
      setCachedAnalysis('c', stubResult('c'), 10_000);

      expect(getCacheStats().size).toBe(3);

      vi.advanceTimersByTime(3_000);
      // 'a' should be purged by getCacheStats
      expect(getCacheStats().size).toBe(2);

      vi.advanceTimersByTime(3_000);
      expect(getCacheStats().size).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // Key collision handling
  // -----------------------------------------------------------------------
  describe('key collision handling', () => {
    it('overwrites value when same key is set again', () => {
      setCachedAnalysis('same-key', stubResult('first'));
      setCachedAnalysis('same-key', stubResult('second'));

      const cached = getCachedAnalysis('same-key');
      expect(cached).toBeDefined();
      expect(cached!.summary).toBe('second');
    });

    it('overwriting a key resets its TTL', () => {
      vi.useFakeTimers();
      try {
        clearAnalysisCache();

        setCachedAnalysis('refresh-key', stubResult('old'), 5_000);
        vi.advanceTimersByTime(4_000);

        // Overwrite with fresh TTL
        setCachedAnalysis('refresh-key', stubResult('new'), 5_000);
        vi.advanceTimersByTime(4_000);

        // 8s total, but only 4s since last set -- should still be valid
        expect(getCachedAnalysis('refresh-key')).toBeDefined();
        expect(getCachedAnalysis('refresh-key')!.summary).toBe('new');

        vi.advanceTimersByTime(2_000);
        // 6s since last set -- should be expired
        expect(getCachedAnalysis('refresh-key')).toBeUndefined();
      } finally {
        vi.useRealTimers();
      }
    });

    it('different hashes do not collide', () => {
      setCachedAnalysis('aaa', stubResult('value-a'));
      setCachedAnalysis('bbb', stubResult('value-b'));

      expect(getCachedAnalysis('aaa')!.summary).toBe('value-a');
      expect(getCachedAnalysis('bbb')!.summary).toBe('value-b');
    });
  });

  // -----------------------------------------------------------------------
  // Large values
  // -----------------------------------------------------------------------
  describe('large values', () => {
    it('stores and retrieves a result with a large summary (~1MB)', () => {
      const large = largeStubResult(1_000_000);
      setCachedAnalysis('large-key', large);

      const cached = getCachedAnalysis('large-key');
      expect(cached).toBeDefined();
      expect(cached!.summary.length).toBe(1_000_000);
    });

    it('stores multiple large entries up to MAX_ENTRIES', () => {
      // 50 entries of ~100KB each
      for (let i = 0; i < 50; i++) {
        setCachedAnalysis(`large-${i}`, largeStubResult(100_000));
      }

      expect(getCacheStats().size).toBe(50);
      expect(getCachedAnalysis('large-0')).toBeDefined();
      expect(getCachedAnalysis('large-49')).toBeDefined();
    });

    it('eviction works correctly with large entries', () => {
      for (let i = 0; i < 100; i++) {
        setCachedAnalysis(`big-${i}`, largeStubResult(10_000));
      }

      // Adding one more should evict the oldest
      setCachedAnalysis('big-100', largeStubResult(10_000));
      expect(getCachedAnalysis('big-0')).toBeUndefined();
      expect(getCachedAnalysis('big-100')).toBeDefined();
      expect(getCacheStats().size).toBe(100);
    });
  });

  // -----------------------------------------------------------------------
  // Cache clear / reset
  // -----------------------------------------------------------------------
  describe('clearAnalysisCache', () => {
    it('removes all entries', () => {
      setCachedAnalysis('a', stubResult('a'));
      setCachedAnalysis('b', stubResult('b'));
      setCachedAnalysis('c', stubResult('c'));

      clearAnalysisCache();

      expect(getCachedAnalysis('a')).toBeUndefined();
      expect(getCachedAnalysis('b')).toBeUndefined();
      expect(getCachedAnalysis('c')).toBeUndefined();
      expect(getCacheStats().size).toBe(0);
    });

    it('resets hit/miss stats to zero', () => {
      setCachedAnalysis('x', stubResult('x'));
      getCachedAnalysis('x');          // hit
      getCachedAnalysis('missing');    // miss

      clearAnalysisCache();
      const stats = getCacheStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe('0%');
    });

    it('allows new entries after clear', () => {
      setCachedAnalysis('before', stubResult('before'));
      clearAnalysisCache();

      setCachedAnalysis('after', stubResult('after'));
      expect(getCachedAnalysis('after')).toBeDefined();
      expect(getCachedAnalysis('after')!.summary).toBe('after');
    });

    it('double clear does not throw', () => {
      clearAnalysisCache();
      expect(() => clearAnalysisCache()).not.toThrow();
      expect(getCacheStats().size).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Memory management / stats accuracy
  // -----------------------------------------------------------------------
  describe('memory management and stats', () => {
    it('stats size reflects actual number of live entries', () => {
      for (let i = 0; i < 10; i++) {
        setCachedAnalysis(`key-${i}`, stubResult(`val-${i}`));
      }
      expect(getCacheStats().size).toBe(10);
    });

    it('hitRate is calculated correctly over many operations', () => {
      setCachedAnalysis('only', stubResult('only'));

      // 3 hits
      getCachedAnalysis('only');
      getCachedAnalysis('only');
      getCachedAnalysis('only');
      // 1 miss
      getCachedAnalysis('nope');

      const stats = getCacheStats();
      expect(stats.hits).toBe(3);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe('75.0%');
    });

    it('expired entry lookup counts as a miss', () => {
      vi.useFakeTimers();
      try {
        clearAnalysisCache();

        setCachedAnalysis('exp', stubResult('exp'), 1_000);
        getCachedAnalysis('exp'); // hit

        vi.advanceTimersByTime(2_000);
        getCachedAnalysis('exp'); // miss (expired)

        const stats = getCacheStats();
        expect(stats.hits).toBe(1);
        expect(stats.misses).toBe(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it('eviction under pressure maintains correct size', () => {
      // Fill to max, then replace all entries
      for (let i = 0; i < 100; i++) {
        setCachedAnalysis(`wave1-${i}`, stubResult(`w1-${i}`));
      }
      for (let i = 0; i < 100; i++) {
        setCachedAnalysis(`wave2-${i}`, stubResult(`w2-${i}`));
      }

      const stats = getCacheStats();
      expect(stats.size).toBe(100);

      // All wave1 keys should be gone
      for (let i = 0; i < 100; i++) {
        expect(getCachedAnalysis(`wave1-${i}`)).toBeUndefined();
      }
      // All wave2 keys should exist
      for (let i = 0; i < 100; i++) {
        expect(getCachedAnalysis(`wave2-${i}`)).toBeDefined();
      }
    });
  });

  // -----------------------------------------------------------------------
  // Cache stats
  // -----------------------------------------------------------------------
  it('tracks hits and misses in stats', () => {
    clearAnalysisCache();
    setCachedAnalysis('stat-hash', stubResult('stat'));

    getCachedAnalysis('stat-hash');      // hit
    getCachedAnalysis('nonexistent');     // miss

    const stats = getCacheStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBe('50.0%');
  });
});
