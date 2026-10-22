import type { StateStorage } from 'zustand/middleware';

const inMemoryMap = new Map<string, string>();

/**
 * Accessor for the in-memory fallback storage map (used for test assertions and SSR isolation).
 */
export function getInMemoryStore(): Map<string, string> {
  return inMemoryMap;
}

/**
 * Clears the in-memory fallback store.
 */
export function clearInMemoryStore(): void {
  inMemoryMap.clear();
}

function isStorageAvailable(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }
  try {
    const testKey = '__momently_storage_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resilient StateStorage wrapper around localStorage.
 *
 * ARCHITECTURAL DECISION (WHY):
 * Direct access to window.localStorage throws exceptions in private browsing mode, disabled storage,
 * SSR prerendering, and when browser quota is exhausted (QuotaExceededError).
 * safeStorage intercepts every call with try/catch and falls back transparently to an in-memory map.
 * It NEVER throws an exception under any circumstance.
 */
export const safeStorage: StateStorage = {
  getItem: (name: string): string | null => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const value = window.localStorage.getItem(name);
        if (value !== null) {
          return value;
        }
      }
    } catch {
      // Storage access blocked or threw
    }
    return inMemoryMap.get(name) ?? null;
  },

  setItem: (name: string, value: string): void => {
    try {
      if (isStorageAvailable()) {
        window.localStorage.setItem(name, value);
        return;
      }
    } catch {
      // Storage quota exceeded or blocked
    }
    inMemoryMap.set(name, value);
  },

  removeItem: (name: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(name);
      }
    } catch {
      // Storage access blocked or threw
    }
    inMemoryMap.delete(name);
  },
};
