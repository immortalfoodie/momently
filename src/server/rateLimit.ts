import { DEFAULT_RATE_LIMIT_PER_MINUTE, MAX_TRACKED_CLIENTS } from './config';

export interface RateLimiterOptions {
  limitPerMinute?: number;
  clock?: () => number;
  maxClients?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export interface RateLimiter {
  check(key: string): RateLimitResult;
  size(): number;
  clear(): void;
}

/**
 * Extracts a client identifier from incoming HTTP request headers.
 *
 * SECURITY NOTE:
 * The `x-forwarded-for` and `x-real-ip` headers can be spoofed by clients if the application
 * is directly exposed to the internet without a reverse proxy. In production environments,
 * this application must sit behind a trusted reverse proxy (e.g., Cloudflare, AWS ALB, Nginx)
 * that strips or sanitizes client headers, or edge rate limiting should be utilized.
 */
export function clientKey(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }

  const realIp = req.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;

  return 'local';
}

/**
 * Creates an in-memory sliding-window rate limiter per client key with bounded memory capacity.
 * WHY: Protects AI endpoints from brute-force token depletion and denial-of-service spikes.
 */
export function createRateLimiter(options?: RateLimiterOptions): RateLimiter {
  const limit = options?.limitPerMinute ?? DEFAULT_RATE_LIMIT_PER_MINUTE;
  const maxClients = options?.maxClients ?? MAX_TRACKED_CLIENTS;
  const nowFn = options?.clock ?? (() => Date.now());
  const windowMs = 60_000;

  // Map of clientKey -> array of request timestamps
  const store = new Map<string, number[]>();

  function evictOldestIfFull(): void {
    if (store.size >= maxClients) {
      const oldestKey = store.keys().next().value;
      if (oldestKey !== undefined) {
        store.delete(oldestKey);
      }
    }
  }

  return {
    check(key: string): RateLimitResult {
      const now = nowFn();
      const cutoff = now - windowMs;

      // Fetch or initialize client's request window
      const history = store.get(key) ?? [];
      const active = history.filter((t) => t > cutoff);

      if (active.length === 0) {
        store.delete(key);
      } else {
        store.set(key, active);
      }

      if (active.length >= limit) {
        const oldestInWindow = active[0] ?? now;
        const retryAfterSeconds = Math.max(1, Math.ceil((oldestInWindow + windowMs - now) / 1000));
        return {
          allowed: false,
          retryAfterSeconds,
        };
      }

      // Record this request
      active.push(now);
      evictOldestIfFull();
      store.set(key, active);

      return {
        allowed: true,
        retryAfterSeconds: 0,
      };
    },

    size(): number {
      return store.size;
    },

    clear(): void {
      store.clear();
    },
  };
}
