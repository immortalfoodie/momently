import { createId } from '@/lib/id';
import { LlmCache } from '@/llm/cache';
import { createProviderFromEnv } from '@/llm/factory';
import { MockProvider } from '@/llm/mock/mockProvider';
import type { LLMProvider } from '@/llm/types';
import {
  DEFAULT_RATE_LIMIT_PER_MINUTE,
  MAX_RATE_LIMIT_PER_MINUTE,
  MIN_RATE_LIMIT_PER_MINUTE,
} from './config';
import { createRateLimiter, type RateLimiter } from './rateLimit';

export interface Deps {
  provider: LLMProvider;
  mode: 'live' | 'demo';
  modeNote?: string;
  cache: LlmCache;
  rateLimiter: RateLimiter;
  clock: () => Date;
  ids: (prefix?: string) => string;
  mockProvider: LLMProvider;
}

let singletonDeps: Deps | null = null;

function parseRateLimitEnv(envValue?: string): number {
  if (!envValue) return DEFAULT_RATE_LIMIT_PER_MINUTE;
  const parsed = parseInt(envValue, 10);
  if (Number.isNaN(parsed)) return DEFAULT_RATE_LIMIT_PER_MINUTE;
  return Math.min(MAX_RATE_LIMIT_PER_MINUTE, Math.max(MIN_RATE_LIMIT_PER_MINUTE, parsed));
}

/**
 * Creates an instance of server dependencies, allowing partial overrides for unit tests.
 * WHY: Decouples server handlers from global process.env or static singletons.
 */
// eslint-disable-next-line complexity
export function createDeps(overrides?: Partial<Deps>): Deps {
  const factoryResult = createProviderFromEnv(process.env);
  const configuredLimit = parseRateLimitEnv(process.env.RATE_LIMIT_PER_MINUTE);
  const mode = overrides?.mode ?? factoryResult.mode;
  const limitPerMinute =
    mode === 'demo' ? Math.max(configuredLimit, 120) : configuredLimit;

  return {
    provider: overrides?.provider ?? factoryResult.provider,
    mode,
    modeNote: overrides?.modeNote ?? factoryResult.note,
    cache: overrides?.cache ?? new LlmCache(),
    rateLimiter: overrides?.rateLimiter ?? createRateLimiter({ limitPerMinute }),
    clock: overrides?.clock ?? (() => new Date()),
    ids: overrides?.ids ?? createId,
    mockProvider: overrides?.mockProvider ?? new MockProvider(),
  };
}

/**
 * Returns the lazily initialized server dependencies singleton for API routes.
 * WHY: Shares the in-memory cache and sliding-window rate limiter across warm serverless requests.
 */
export function getDeps(): Deps {
  if (!singletonDeps) {
    singletonDeps = createDeps();
  }
  return singletonDeps;
}

/**
 * Resets the server singleton (useful for test isolation).
 */
export function resetDeps(): void {
  singletonDeps = null;
}
