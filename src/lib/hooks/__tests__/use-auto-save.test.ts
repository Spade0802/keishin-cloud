// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutoSave, useRestoreSave } from '../use-auto-save';

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

const KEY_PREFIX = 'keishin-wizard-';

let storage: Record<string, string> = {};

const localStorageMock = {
  getItem: vi.fn((key: string) => storage[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    storage[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete storage[key];
  }),
  clear: vi.fn(() => {
    storage = {};
  }),
  get length() {
    return Object.keys(storage).length;
  },
  key: vi.fn((index: number) => Object.keys(storage)[index] ?? null),
};

beforeEach(() => {
  storage = {};
  vi.useFakeTimers();
  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageMock,
    writable: true,
    configurable: true,
  });
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// useAutoSave
// ---------------------------------------------------------------------------

describe('useAutoSave', () => {
  it('saves value to localStorage after debounce delay', () => {
    const { result } = renderHook(() =>
      useAutoSave('test-key', { name: 'hello' }, 300),
    );

    // Before delay, nothing saved
    expect(localStorageMock.setItem).not.toHaveBeenCalled();

    // Advance past debounce
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      `${KEY_PREFIX}test-key`,
      expect.any(String),
    );

    // savedAt should be set
    expect(result.current.savedAt).toBeInstanceOf(Date);
  });

  it('debounces rapid value changes', () => {
    const { rerender } = renderHook(
      ({ value }) => useAutoSave('debounce-key', value, 500),
      { initialProps: { value: 'a' } },
    );

    act(() => {
      vi.advanceTimersByTime(200);
    });

    rerender({ value: 'b' });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    rerender({ value: 'c' });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Only one final write
    const calls = localStorageMock.setItem.mock.calls.filter(
      ([key]: [string, string]) => key === `${KEY_PREFIX}debounce-key`,
    );
    expect(calls.length).toBe(1);

    // Verify the saved value is the latest
    const saved = JSON.parse(calls[0][1]);
    expect(saved.data).toBe('c');
  });

  it('clear removes the entry from localStorage', () => {
    const { result } = renderHook(() =>
      useAutoSave('clear-key', 'data', 100),
    );

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current.savedAt).not.toBeNull();

    act(() => {
      result.current.clear();
    });

    expect(localStorageMock.removeItem).toHaveBeenCalledWith(
      `${KEY_PREFIX}clear-key`,
    );
    expect(result.current.savedAt).toBeNull();
  });

  it('does not save when delay is Infinity', () => {
    renderHook(() => useAutoSave('inf-key', 'data', Infinity));

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(localStorageMock.setItem).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// useRestoreSave
// ---------------------------------------------------------------------------

describe('useRestoreSave', () => {
  it('restores previously saved data', () => {
    const savedEntry = {
      data: { foo: 'bar' },
      savedAt: Date.now(),
    };
    storage[`${KEY_PREFIX}restore-key`] = JSON.stringify(savedEntry);

    const { result } = renderHook(() =>
      useRestoreSave<{ foo: string }>('restore-key'),
    );

    expect(result.current.hasSavedData).toBe(true);
    expect(result.current.data).toEqual({ foo: 'bar' });
    expect(result.current.restore()).toEqual({ foo: 'bar' });
  });

  it('returns null when no saved data exists', () => {
    const { result } = renderHook(() => useRestoreSave('nonexistent'));

    expect(result.current.hasSavedData).toBe(false);
    expect(result.current.data).toBeNull();
    expect(result.current.restore()).toBeNull();
  });

  it('discards saved data', () => {
    storage[`${KEY_PREFIX}discard-key`] = JSON.stringify({
      data: 'old',
      savedAt: Date.now(),
    });

    const { result } = renderHook(() => useRestoreSave('discard-key'));

    expect(result.current.hasSavedData).toBe(true);

    act(() => {
      result.current.discard();
    });

    expect(result.current.hasSavedData).toBe(false);
    expect(result.current.data).toBeNull();
    expect(localStorageMock.removeItem).toHaveBeenCalledWith(
      `${KEY_PREFIX}discard-key`,
    );
  });
});

// ---------------------------------------------------------------------------
// Expiry behavior
// ---------------------------------------------------------------------------

describe('expiry behavior', () => {
  it('removes data older than 30 days', () => {
    const thirtyOneDaysAgo = Date.now() - 31 * 24 * 60 * 60 * 1000;
    storage[`${KEY_PREFIX}expired-key`] = JSON.stringify({
      data: 'stale',
      savedAt: thirtyOneDaysAgo,
    });

    const { result } = renderHook(() => useRestoreSave('expired-key'));

    expect(result.current.hasSavedData).toBe(false);
    expect(result.current.data).toBeNull();
    expect(localStorageMock.removeItem).toHaveBeenCalledWith(
      `${KEY_PREFIX}expired-key`,
    );
  });

  it('keeps data within 30 days', () => {
    const twentyNineDaysAgo = Date.now() - 29 * 24 * 60 * 60 * 1000;
    storage[`${KEY_PREFIX}fresh-key`] = JSON.stringify({
      data: 'fresh',
      savedAt: twentyNineDaysAgo,
    });

    const { result } = renderHook(() => useRestoreSave('fresh-key'));

    expect(result.current.hasSavedData).toBe(true);
    expect(result.current.data).toBe('fresh');
  });
});

// ---------------------------------------------------------------------------
// Save/restore cycle
// ---------------------------------------------------------------------------

describe('save/restore cycle', () => {
  it('data saved by useAutoSave can be restored by useRestoreSave', () => {
    // Step 1: save
    renderHook(() => useAutoSave('cycle-key', { count: 42 }, 100));

    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Step 2: restore in a new hook instance
    const { result } = renderHook(() =>
      useRestoreSave<{ count: number }>('cycle-key'),
    );

    expect(result.current.hasSavedData).toBe(true);
    expect(result.current.data).toEqual({ count: 42 });
  });
});

// ---------------------------------------------------------------------------
// localStorage unavailable graceful degradation
// ---------------------------------------------------------------------------

describe('localStorage unavailable graceful degradation', () => {
  it('useAutoSave does not throw when localStorage.setItem throws', () => {
    localStorageMock.setItem.mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    const { result } = renderHook(() =>
      useAutoSave('error-key', 'data', 100),
    );

    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Should not crash; savedAt remains null
    expect(result.current.savedAt).toBeNull();
  });

  it('useAutoSave clear does not throw when localStorage.removeItem throws', () => {
    localStorageMock.removeItem.mockImplementation(() => {
      throw new Error('SecurityError');
    });

    const { result } = renderHook(() =>
      useAutoSave('error-clear', 'data', 100),
    );

    expect(() => {
      act(() => {
        result.current.clear();
      });
    }).not.toThrow();
  });

  it('useRestoreSave does not throw when localStorage.getItem throws', () => {
    localStorageMock.getItem.mockImplementation(() => {
      throw new Error('SecurityError');
    });

    const { result } = renderHook(() => useRestoreSave('broken'));

    expect(result.current.hasSavedData).toBe(false);
    expect(result.current.data).toBeNull();
  });

  it('useRestoreSave handles malformed JSON gracefully', () => {
    storage[`${KEY_PREFIX}bad-json`] = '{not-valid-json';

    const { result } = renderHook(() => useRestoreSave('bad-json'));

    expect(result.current.hasSavedData).toBe(false);
    expect(result.current.data).toBeNull();
  });
});
