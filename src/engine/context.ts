import type { IdFactory } from '@/lib/id';

/**
 * Shared execution context carrying injected clock and deterministic ID generator.
 * WHY: Adheres to the strict architectural purity constraint: no Math.random(), no Date.now(),
 * and 100% deterministic reproducibility across all engine operations.
 */
export interface EngineContext {
  ids: IdFactory;
  clock: () => Date;
}
