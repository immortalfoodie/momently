import { useMemo } from 'react';
import type { EngineContext } from '@/engine/context';
import { createId } from '@/lib/id';

const defaultContext: EngineContext = {
  ids: createId,
  clock: () => new Date(),
};

/**
 * Hook providing a stable pure EngineContext.
 * WHY: Decouples UI callers from directly constructing clock and ID factories.
 */
export function useEngineContext(): EngineContext {
  return useMemo(() => defaultContext, []);
}

export { defaultContext as engineContext };
