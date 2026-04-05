import { describe, expect, it, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted state for mocks (vi.mock factories are hoisted above imports)
// ---------------------------------------------------------------------------

const { mockState } = vi.hoisted(() => {
  const mockState = {
    rows: [] as Array<{ key: string; value: string; description: string | null; updatedAt: Date | null }>,
    lastQueriedKey: '',
  };
  return { mockState };
});

vi.mock('drizzle-orm', () => ({
  eq: (_col: unknown, value: string) => {
    mockState.lastQueriedKey = value;
    return value;
  },
}));

vi.mock('../db', () => ({
  db: {
    select: (fields?: unknown) => {
      if (!fields) {
        // getAllSettings path: db.select().from(systemSettings)
        return {
          from: () => Promise.resolve(mockState.rows),
        };
      }
      // getSetting path: db.select({ value }).from().where().then()
      return {
        from: () => ({
          where: () => ({
            then: (cb: (rows: unknown[]) => unknown) => {
              const matchingRow = mockState.rows.find(
                (r) => r.key === mockState.lastQueriedKey,
              );
              const mapped = matchingRow ? [{ value: matchingRow.value }] : [];
              return Promise.resolve(cb(mapped));
            },
          }),
        }),
      };
    },
  },
}));

vi.mock('../db/schema', () => ({
  systemSettings: {
    key: 'key',
    value: 'value',
  },
}));

// Import after mocks
import {
  getSetting,
  getAIProvider,
  getAIConfig,
  getAllSettings,
  invalidateSettingsCache,
} from '../settings';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setDbRows(
  rows: Array<{ key: string; value: string; description?: string | null; updatedAt?: Date | null }>,
) {
  mockState.rows = rows.map((r) => ({
    key: r.key,
    value: r.value,
    description: r.description ?? null,
    updatedAt: r.updatedAt ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('settings', () => {
  beforeEach(() => {
    mockState.rows = [];
    mockState.lastQueriedKey = '';
    invalidateSettingsCache();
  });

  // -----------------------------------------------------------------------
  // Default values
  // -----------------------------------------------------------------------
  describe('default values', () => {
    it('returns default ai_provider when not in DB', async () => {
      const value = await getSetting('ai_provider');
      expect(value).toBe('gemini');
    });

    it('returns default gemini_model when not in DB', async () => {
      const value = await getSetting('gemini_model');
      expect(value).toBe('gemini-2.5-flash');
    });

    it('returns default openai_model when not in DB', async () => {
      const value = await getSetting('openai_model');
      expect(value).toBe('gpt-4o');
    });

    it('returns default max_file_size_mb when not in DB', async () => {
      const value = await getSetting('max_file_size_mb');
      expect(value).toBe('50');
    });

    it('returns default ai_analysis_enabled when not in DB', async () => {
      const value = await getSetting('ai_analysis_enabled');
      expect(value).toBe('true');
    });

    it('returns empty string default for gemini_api_key', async () => {
      const value = await getSetting('gemini_api_key');
      expect(value).toBe('');
    });

    it('returns null for unknown key with no default', async () => {
      const value = await getSetting('nonexistent_key');
      expect(value).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // DB value overrides defaults
  // -----------------------------------------------------------------------
  describe('loading from DB', () => {
    it('returns DB value instead of default', async () => {
      setDbRows([{ key: 'ai_provider', value: 'openai' }]);
      const value = await getSetting('ai_provider');
      expect(value).toBe('openai');
    });

    it('returns DB value for key with no default', async () => {
      setDbRows([{ key: 'custom_setting', value: 'custom_value' }]);
      const value = await getSetting('custom_setting');
      expect(value).toBe('custom_value');
    });
  });

  // -----------------------------------------------------------------------
  // Cache behavior
  // -----------------------------------------------------------------------
  describe('cache', () => {
    it('uses cached value on second call', async () => {
      setDbRows([{ key: 'ai_provider', value: 'openai' }]);

      const first = await getSetting('ai_provider');
      expect(first).toBe('openai');

      // Change DB value — should still get cached value
      setDbRows([{ key: 'ai_provider', value: 'gemini' }]);
      const second = await getSetting('ai_provider');
      expect(second).toBe('openai');
    });

    it('invalidateSettingsCache clears all cached values', async () => {
      setDbRows([{ key: 'ai_provider', value: 'openai' }]);
      await getSetting('ai_provider');

      // Change DB and invalidate
      setDbRows([{ key: 'ai_provider', value: 'gemini-paid' }]);
      invalidateSettingsCache();

      const value = await getSetting('ai_provider');
      expect(value).toBe('gemini-paid');
    });

    it('cache expires after TTL', async () => {
      setDbRows([{ key: 'ai_provider', value: 'openai' }]);
      await getSetting('ai_provider');

      // Advance time past the 60s TTL
      const realDateNow = Date.now;
      Date.now = () => realDateNow() + 61_000;

      setDbRows([{ key: 'ai_provider', value: 'gemini-paid' }]);
      const value = await getSetting('ai_provider');
      expect(value).toBe('gemini-paid');

      // Restore
      Date.now = realDateNow;
    });
  });

  // -----------------------------------------------------------------------
  // getAIProvider
  // -----------------------------------------------------------------------
  describe('getAIProvider', () => {
    it('returns "gemini" by default', async () => {
      const provider = await getAIProvider();
      expect(provider).toBe('gemini');
    });

    it('returns "openai" when set', async () => {
      setDbRows([{ key: 'ai_provider', value: 'openai' }]);
      const provider = await getAIProvider();
      expect(provider).toBe('openai');
    });

    it('returns "gemini-paid" when set', async () => {
      setDbRows([{ key: 'ai_provider', value: 'gemini-paid' }]);
      const provider = await getAIProvider();
      expect(provider).toBe('gemini-paid');
    });

    it('falls back to "gemini" for invalid provider value', async () => {
      setDbRows([{ key: 'ai_provider', value: 'invalid-provider' }]);
      const provider = await getAIProvider();
      expect(provider).toBe('gemini');
    });
  });

  // -----------------------------------------------------------------------
  // getAIConfig
  // -----------------------------------------------------------------------
  describe('getAIConfig', () => {
    it('returns gemini config by default', async () => {
      const config = await getAIConfig();
      expect(config.provider).toBe('gemini');
      expect(config.model).toBe('gemini-2.5-flash');
      expect(config.apiKey).toBeUndefined();
    });

    it('returns openai config with apiKey and model', async () => {
      setDbRows([
        { key: 'ai_provider', value: 'openai' },
        { key: 'openai_api_key', value: 'sk-test-key' },
        { key: 'openai_model', value: 'gpt-4o-mini' },
      ]);
      const config = await getAIConfig();
      expect(config.provider).toBe('openai');
      expect(config.apiKey).toBe('sk-test-key');
      expect(config.model).toBe('gpt-4o-mini');
    });

    it('returns gemini-paid config with apiKey', async () => {
      setDbRows([
        { key: 'ai_provider', value: 'gemini-paid' },
        { key: 'gemini_api_key', value: 'gm-test-key' },
        { key: 'gemini_model', value: 'gemini-pro' },
      ]);
      const config = await getAIConfig();
      expect(config.provider).toBe('gemini-paid');
      expect(config.apiKey).toBe('gm-test-key');
      expect(config.model).toBe('gemini-pro');
    });

    it('returns undefined apiKey for free gemini', async () => {
      setDbRows([
        { key: 'ai_provider', value: 'gemini' },
        { key: 'gemini_api_key', value: 'should-be-ignored' },
      ]);
      const config = await getAIConfig();
      expect(config.provider).toBe('gemini');
      expect(config.apiKey).toBeUndefined();
    });

    it('returns undefined apiKey when openai key is empty', async () => {
      setDbRows([
        { key: 'ai_provider', value: 'openai' },
        { key: 'openai_api_key', value: '' },
      ]);
      const config = await getAIConfig();
      expect(config.provider).toBe('openai');
      expect(config.apiKey).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // getAllSettings
  // -----------------------------------------------------------------------
  describe('getAllSettings', () => {
    it('returns all defaults when DB is empty', async () => {
      setDbRows([]);
      const all = await getAllSettings();

      expect(all.ai_provider.value).toBe('gemini');
      expect(all.gemini_model.value).toBe('gemini-2.5-flash');
      expect(all.openai_model.value).toBe('gpt-4o');
      expect(all.max_file_size_mb.value).toBe('50');
      expect(all.ai_analysis_enabled.value).toBe('true');
      expect(all.ai_provider.description).toBeNull();
      expect(all.ai_provider.updatedAt).toBeNull();
    });

    it('overrides defaults with DB values', async () => {
      const now = new Date('2026-04-01T00:00:00Z');
      setDbRows([
        { key: 'ai_provider', value: 'openai', description: 'AI provider setting', updatedAt: now },
      ]);
      const all = await getAllSettings();

      expect(all.ai_provider.value).toBe('openai');
      expect(all.ai_provider.description).toBe('AI provider setting');
      expect(all.ai_provider.updatedAt).toEqual(now);
      // Other defaults remain
      expect(all.gemini_model.value).toBe('gemini-2.5-flash');
    });

    it('includes DB-only keys not in defaults', async () => {
      setDbRows([
        { key: 'custom_key', value: 'custom_val', description: 'custom', updatedAt: null },
      ]);
      const all = await getAllSettings();
      expect(all.custom_key).toBeDefined();
      expect(all.custom_key.value).toBe('custom_val');
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------
  describe('edge cases', () => {
    it('does not cache null values', async () => {
      const first = await getSetting('unknown_key');
      expect(first).toBeNull();

      setDbRows([{ key: 'unknown_key', value: 'now_exists' }]);
      invalidateSettingsCache();

      const second = await getSetting('unknown_key');
      expect(second).toBe('now_exists');
    });

    it('caches non-null values from defaults', async () => {
      const first = await getSetting('ai_provider');
      expect(first).toBe('gemini');

      // DB change without invalidation should not affect result
      setDbRows([{ key: 'ai_provider', value: 'openai' }]);
      const second = await getSetting('ai_provider');
      expect(second).toBe('gemini');
    });

    it('handles empty string DB values', async () => {
      setDbRows([{ key: 'ai_provider', value: '' }]);
      const value = await getSetting('ai_provider');
      expect(value).toBe('');
    });
  });
});
