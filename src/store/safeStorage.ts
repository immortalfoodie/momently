import type { StateStorage } from 'zustand/middleware';

const inMemoryMap = new Map<string, string>();
let fallbackTriggered = false;
let suppressWriteDepth = 0;
let suppressNextWrites = 0;

/**
 * Clears the in-memory fallback store and resets fallback tracking.
 * WHY: Provides clean isolation between test runs.
 */
export function clearInMemoryStore(): void {
  inMemoryMap.clear();
  fallbackTriggered = false;
  suppressWriteDepth = 0;
  suppressNextWrites = 0;
}

/**
 * Suppresses the next N safeStorage.setItem calls.
 * WHY: Prevents Zustand persist.rehydrate() from overwriting incompatible raw storage after migrate().
 */
export function suppressNextStorageWrite(count = 1): void {
  if (suppressWriteDepth === 0) {
    suppressNextWrites += count;
  }
}

/**
 * Executes a callback while suppressing safeStorage.setItem writes.
 * WHY: Prevents hydration or version-mismatch notices from overwriting raw persisted data in storage.
 */
export function withSuppressedStorageWrite<T>(fn: () => T): T {
  suppressWriteDepth++;
  try {
    return fn();
  } finally {
    suppressWriteDepth = Math.max(0, suppressWriteDepth - 1);
  }
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
 * Reports whether browser localStorage is currently available and persistent.
 * WHY: Enables the application shell to warn the host when storage falls back to volatile memory.
 */
export function isPersistent(): boolean {
  if (fallbackTriggered) return false;
  return isStorageAvailable();
}

export interface SafeStateStorage extends StateStorage {
  isPersistent: () => boolean;
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
export const safeStorage: SafeStateStorage = {
  isPersistent,

  getItem: (name: string): string | null => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const value = window.localStorage.getItem(name);
        if (value !== null) {
          return value;
        }
      }
    } catch {
      fallbackTriggered = true;
    }
    return inMemoryMap.get(name) ?? null;
  },

  setItem: (name: string, value: string): void => {
    if (suppressWriteDepth > 0) {
      return;
    }
    if (suppressNextWrites > 0) {
      suppressNextWrites--;
      return;
    }
    try {
      if (isStorageAvailable()) {
        window.localStorage.setItem(name, value);
        return;
      }
    } catch {
      // Storage quota exceeded or blocked
    }
    fallbackTriggered = true;
    inMemoryMap.set(name, value);
  },

  removeItem: (name: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(name);
      }
    } catch {
      fallbackTriggered = true;
    }
    inMemoryMap.delete(name);
  },
};
