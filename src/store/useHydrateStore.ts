import { useEffect } from 'react';
import { useEventsStore } from './eventsStore';

/**
 * Hydrates the persistent store once on component mount.
 * WHY: Prevents SSR/client hydration mismatches. While hydrated is false,
 * UI views render accessible skeletons until browser storage is fully parsed.
 */
export function useHydrateStore(): boolean {
  const hydrated = useEventsStore((s) => s.hydrated);

  useEffect(() => {
    if (!useEventsStore.getState().hydrated) {
      useEventsStore.getState().hydrate();
    }
  }, []);

  return hydrated;
}
