import { createHash } from 'node:crypto';

/**
 * Single entry stored in the in-memory LRU cache with timestamp for TTL expiry.
 */
interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

/**
 * Configuration options for initializing an LlmCache.
 */
export interface LlmCacheOptions {
  maxEntries?: number;
  ttlMs?: number;
  now?: () => number;
}

/**
 * Deterministically serializes values with sorted object keys to ensure identical hash generation.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const entries = keys.map(
    (k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`,
  );
  return `{${entries.join(',')}}`;
}

/**
 * Thread-safe, in-memory LRU cache with TTL eviction for completed LLM tasks.
 * WHY: Avoids redundant provider round-trips for identical prompts and deterministic demo replays.
 */
export class LlmCache {
  private readonly maxEntries: number;
  private readonly ttlMs: number;
  private readonly now: () => number;
  private readonly store = new Map<string, CacheEntry<unknown>>();

  constructor(options?: LlmCacheOptions) {
    this.maxEntries = options?.maxEntries ?? 100;
    this.ttlMs = options?.ttlMs ?? 10 * 60 * 1000; // 10 minutes
    this.now = options?.now ?? (() => Date.now());
  }

  /**
   * Generates a stable SHA-256 cache key from task name and structured input.
   */
  computeKey(task: string, input: unknown): string {
    const serialized = stableStringify(input);
    return createHash('sha256').update(`${task}:${serialized}`).digest('hex');
  }

  /**
   * Retrieves a cached value if present and not expired, marking it as most-recently used.
   */
  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    const currentTime = this.now();
    if (currentTime - entry.timestamp > this.ttlMs) {
      this.store.delete(key);
      return undefined;
    }

    // Refresh position to head of LRU
    this.store.delete(key);
    this.store.set(key, entry);

    return entry.value as T;
  }

  /**
   * Stores a value in the cache, evicting the least-recently used entry if capacity is exceeded.
   */
  set<T>(key: string, value: T): void {
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxEntries) {
      // Evict oldest (first inserted in Map iterator)
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }

    this.store.set(key, {
      value,
      timestamp: this.now(),
    });
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }
}
