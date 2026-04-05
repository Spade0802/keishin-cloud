'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

const KEY_PREFIX = 'keishin-wizard-';
const EXPIRY_DAYS = 30;

interface SavedEntry<T> {
  data: T;
  savedAt: number; // epoch ms
}

/**
 * Auto-saves a value to localStorage with debounce.
 * Returns the last saved timestamp and a clear function.
 */
export function useAutoSave<T>(
  key: string,
  value: T,
  delay: number = 500
): {
  savedAt: Date | null;
  clear: () => void;
} {
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fullKey = KEY_PREFIX + key;

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(fullKey);
    } catch {
      // ignore
    }
    setSavedAt(null);
  }, [fullKey]);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Skip saving when delay is Infinity (used to disable auto-save)
    if (!isFinite(delay)) return;

    timerRef.current = setTimeout(() => {
      try {
        const entry: SavedEntry<T> = {
          data: value,
          savedAt: Date.now(),
        };
        localStorage.setItem(fullKey, JSON.stringify(entry));
        setSavedAt(new Date(entry.savedAt));
      } catch {
        // localStorage full or unavailable
      }
    }, delay);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [value, fullKey, delay]);

  // On mount, read existing timestamp
  useEffect(() => {
    try {
      const raw = localStorage.getItem(fullKey);
      if (raw) {
        const entry = JSON.parse(raw) as SavedEntry<T>;
        setSavedAt(new Date(entry.savedAt));
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { savedAt, clear };
}

/**
 * Companion hook to check for and restore saved data.
 */
export function useRestoreSave<T>(key: string): {
  data: T | null;
  hasSavedData: boolean;
  restore: () => T | null;
  discard: () => void;
} {
  const fullKey = KEY_PREFIX + key;
  const [data, setData] = useState<T | null>(null);
  const [hasSavedData, setHasSavedData] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(fullKey);
      if (!raw) return;
      const entry = JSON.parse(raw) as SavedEntry<T>;

      // Check expiry
      const ageMs = Date.now() - entry.savedAt;
      const expiryMs = EXPIRY_DAYS * 24 * 60 * 60 * 1000;
      if (ageMs > expiryMs) {
        localStorage.removeItem(fullKey);
        return;
      }

      setData(entry.data);
      setHasSavedData(true);
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const restore = useCallback((): T | null => {
    return data;
  }, [data]);

  const discard = useCallback(() => {
    try {
      localStorage.removeItem(fullKey);
    } catch {
      // ignore
    }
    setData(null);
    setHasSavedData(false);
  }, [fullKey]);

  return { data, hasSavedData, restore, discard };
}
