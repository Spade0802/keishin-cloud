/**
 * 管理者試算履歴 API route tests
 *
 * GET /api/admin/simulations
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockAuth = vi.fn();
const mockDbSelect = vi.fn();
const mockGetSimulations = vi.fn();

vi.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}));

vi.mock('@/lib/db', () => {
  // Build a chainable query builder mock
  const chainable = () => {
    const chain: Record<string, unknown> = {};
    chain.select = vi.fn().mockReturnValue(chain);
    chain.from = vi.fn().mockReturnValue(chain);
    chain.where = vi.fn().mockReturnValue(chain);
    chain.then = vi.fn((resolve: (v: unknown) => unknown) =>
      resolve(mockDbSelect()),
    );
    return chain;
  };
  const c = chainable();
  return {
    db: {
      select: c.select,
    },
  };
});

vi.mock('@/lib/db/schema', () => ({
  users: { id: 'id', role: 'role' },
}));

vi.mock('@/lib/admin/data', () => ({
  getSimulations: () => mockGetSimulations(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Import AFTER mocks
import { GET } from '@/app/api/admin/simulations/route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Simulate an authenticated admin session */
function mockAdminSession() {
  mockAuth.mockResolvedValue({
    user: { id: 'user-1', name: 'Admin', email: 'admin@test.com' },
  });
  // requireAdmin does db.select().from().where().then() to check role
  mockDbSelect.mockReturnValue([{ role: 'admin' }]);
}

/** Simulate an authenticated non-admin session */
function mockMemberSession() {
  mockAuth.mockResolvedValue({
    user: { id: 'user-2', name: 'Member', email: 'member@test.com' },
  });
  mockDbSelect.mockReturnValue([{ role: 'member' }]);
}

/** Simulate no session (unauthenticated) */
function mockNoSession() {
  mockAuth.mockResolvedValue(null);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/admin/simulations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── 認証・認可 ───────────────────────────────────────────

  test('未認証の場合は 403 を返す', async () => {
    mockNoSession();

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('権限がありません');
  });

  test('admin 以外のロールの場合は 403 を返す', async () => {
    mockMemberSession();

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('権限がありません');
  });

  test('セッションに user.id が無い場合は 403 を返す', async () => {
    mockAuth.mockResolvedValue({ user: {} });

    const response = await GET();

    expect(response.status).toBe(403);
  });

  // ─── 正常系 ───────────────────────────────────────────────

  test('admin ユーザーの場合は 200 と試算一覧を返す', async () => {
    mockAdminSession();

    const simulationData = [
      {
        id: 'sim-1',
        createdAt: '2026-01-15T00:00:00.000Z',
        organizationName: 'テスト法人',
        fiscalYear: '2025年度',
        mainIndustry: '建設業',
        pScore: 800,
      },
      {
        id: 'sim-2',
        createdAt: '2026-02-10T00:00:00.000Z',
        organizationName: 'サンプル法人',
        fiscalYear: '2024年度',
        mainIndustry: '土木',
        pScore: 650,
      },
    ];
    mockGetSimulations.mockResolvedValue(simulationData);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.simulations).toEqual(simulationData);
    expect(body.simulations).toHaveLength(2);
  });

  test('試算が 0 件でも 200 と空配列を返す', async () => {
    mockAdminSession();
    mockGetSimulations.mockResolvedValue([]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.simulations).toEqual([]);
  });

  // ─── エラー系 ─────────────────────────────────────────────

  test('getSimulations が例外を投げた場合は 500 を返す', async () => {
    mockAdminSession();
    mockGetSimulations.mockRejectedValue(new Error('DB connection lost'));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('内部エラーが発生しました');
  });

  test('内部エラー時にエラーがログに記録される', async () => {
    mockAdminSession();
    const dbError = new Error('query timeout');
    mockGetSimulations.mockRejectedValue(dbError);

    const { logger } = await import('@/lib/logger');

    await GET();

    expect(logger.error).toHaveBeenCalledWith(
      '[admin/simulations] GET error:',
      dbError,
    );
  });

  // ─── レスポンス形式 ───────────────────────────────────────

  test('正常レスポンスの Content-Type は application/json', async () => {
    mockAdminSession();
    mockGetSimulations.mockResolvedValue([]);

    const response = await GET();

    expect(response.headers.get('content-type')).toContain('application/json');
  });

  test('403 レスポンスの本文に error フィールドのみ含まれる', async () => {
    mockNoSession();

    const response = await GET();
    const body = await response.json();

    expect(Object.keys(body)).toEqual(['error']);
  });

  test('500 レスポンスの本文に error フィールドのみ含まれる', async () => {
    mockAdminSession();
    mockGetSimulations.mockRejectedValue(new Error('fail'));

    const response = await GET();
    const body = await response.json();

    expect(Object.keys(body)).toEqual(['error']);
  });
});
