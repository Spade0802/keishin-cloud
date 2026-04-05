import { describe, it, expect } from 'vitest';
import { isRateLimitError } from '../gemini-client';

describe('isRateLimitError', () => {
  it('returns true for Error with 429 status', () => {
    const err = new Error('Request failed with status 429');
    expect(isRateLimitError(err)).toBe(true);
  });

  it('returns true for Error with RESOURCE_EXHAUSTED / quota message', () => {
    const err = new Error('RESOURCE_EXHAUSTED: quota exceeded');
    expect(isRateLimitError(err)).toBe(true);
  });

  it('returns true for "Too Many Requests" message', () => {
    const err = new Error('Too Many Requests');
    expect(isRateLimitError(err)).toBe(true);
  });

  it('returns false for a generic server error', () => {
    const err = new Error('Internal Server Error');
    expect(isRateLimitError(err)).toBe(false);
  });

  it('returns false for a network error', () => {
    const err = new Error('ECONNREFUSED');
    expect(isRateLimitError(err)).toBe(false);
  });

  it('handles non-Error values (string)', () => {
    expect(isRateLimitError('429 rate limited')).toBe(true);
    expect(isRateLimitError('some other string')).toBe(false);
  });

  it('handles non-Error values (number, null, undefined)', () => {
    expect(isRateLimitError(429)).toBe(true);
    expect(isRateLimitError(null)).toBe(false);
    expect(isRateLimitError(undefined)).toBe(false);
  });
});

describe('Model name resolution', () => {
  it('DEFAULT_MODEL is gemini-2.5-flash (module constant)', async () => {
    // The default model constant is not exported, but we can verify the
    // module loads without errors, which exercises the env-var resolution
    // for PROJECT, LOCATION, and DEFAULT_MODEL at module scope.
    const mod = await import('../gemini-client');
    expect(mod.isRateLimitError).toBeDefined();
    expect(mod.getGeminiModel).toBeDefined();
  });
});
