import { describe, expect, it, beforeEach, vi } from 'vitest';
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

  // -----------------------------------------------------------------------
  // TTL expiration
  // -----------------------------------------------------------------------
  it('expires entries after TTL', () => {
    vi.useFakeTimers();
    try {
      clearAnalysisCache();

      const shortTtl = 5_000; // 5 seconds
      setCachedAnalysis('ttl-hash', stubResult('ttl-test'), shortTtl);

      // Should be available immediately
      expect(getCachedAnalysis('ttl-hash')).toBeDefined();

      // Advance past TTL
      vi.advanceTimersByTime(6_000);

      // Should be expired now
      expect(getCachedAnalysis('ttl-hash')).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
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
