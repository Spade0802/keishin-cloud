/**
 * Health check API route tests
 *
 * GET /api/health
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockExecute = vi.fn();

vi.mock('@/lib/db', () => ({
  db: { execute: (...args: unknown[]) => mockExecute(...args) },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Import AFTER mocks are set up
import { GET } from '@/app/api/health/route';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('DB 正常時は 200 と status:"ok" を返す', async () => {
    mockExecute.mockResolvedValue([{ '?column?': 1 }]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.db).toBe('ok');
  });

  test('DB 障害時は 503 と status:"degraded" を返す', async () => {
    mockExecute.mockRejectedValue(new Error('connection refused'));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe('degraded');
    expect(body.db).toBe('error');
  });

  test('レスポンスに timestamp が ISO 8601 形式で含まれる', async () => {
    mockExecute.mockResolvedValue([{ '?column?': 1 }]);

    const before = new Date().toISOString();
    const response = await GET();
    const body = await response.json();
    const after = new Date().toISOString();

    expect(body.timestamp).toBeDefined();
    // ISO 8601 format check
    expect(() => new Date(body.timestamp)).not.toThrow();
    expect(body.timestamp >= before).toBe(true);
    expect(body.timestamp <= after).toBe(true);
  });

  test('レスポンスに version が含まれる', async () => {
    mockExecute.mockResolvedValue([{ '?column?': 1 }]);

    const response = await GET();
    const body = await response.json();

    expect(body.version).toBeDefined();
    expect(typeof body.version).toBe('string');
  });

  test('レスポンス JSON は正確に 4 つのフィールドを持つ', async () => {
    mockExecute.mockResolvedValue([{ '?column?': 1 }]);

    const response = await GET();
    const body = await response.json();

    const keys = Object.keys(body);
    expect(keys).toHaveLength(4);
    expect(keys).toContain('status');
    expect(keys).toContain('timestamp');
    expect(keys).toContain('version');
    expect(keys).toContain('db');
  });

  test('Content-Type は application/json', async () => {
    mockExecute.mockResolvedValue([{ '?column?': 1 }]);

    const response = await GET();

    expect(response.headers.get('content-type')).toContain('application/json');
  });

  test('DB 障害時にエラーがログに記録される', async () => {
    const dbError = new Error('timeout');
    mockExecute.mockRejectedValue(dbError);

    const { logger } = await import('@/lib/logger');

    await GET();

    expect(logger.error).toHaveBeenCalledWith(
      '[Health] DB connectivity check failed:',
      dbError,
    );
  });

  test('npm_package_version が設定されている場合はそれを返す', async () => {
    const original = process.env.npm_package_version;
    process.env.npm_package_version = '1.2.3';

    mockExecute.mockResolvedValue([{ '?column?': 1 }]);

    // Re-import to pick up new env value — but since the module is cached,
    // the version is read at call time via process.env, so it should work.
    const response = await GET();
    const body = await response.json();

    expect(body.version).toBe('1.2.3');

    // Restore
    if (original === undefined) {
      delete process.env.npm_package_version;
    } else {
      process.env.npm_package_version = original;
    }
  });
});
