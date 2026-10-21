'use client';

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';

interface LiveRegionContextValue {
  announce: (message: string) => void;
}

const LiveRegionContext = createContext<LiveRegionContextValue | null>(null);

/**
 * Hook to dispatch accessible screen reader announcements across application components.
 */
export function useAnnouncer(): LiveRegionContextValue {
  const context = useContext(LiveRegionContext);
  if (!context) {
    return {
      announce: () => {
        // Fallback no-op if outside provider during unit tests
      },
    };
  }
  return context;
}

export interface LiveRegionProviderProps {
  children: ReactNode;
}

/**
 * Root provider hosting an aria-live region for non-visual event notifications.
 *
 * ACCESSIBILITY DECISION (WHY):
 * Provides a persistent `aria-live="polite"` container at the app root. When dynamic changes
 * occur (e.g. "Plan updated: guest count 80 to 110"), screen readers announce the update
 * without shifting visual focus or interrupting active interactions.
 */
export function LiveRegionProvider({ children }: LiveRegionProviderProps) {
  const [announcement, setAnnouncement] = useState<string>('');

  const announce = useCallback((message: string) => {
    // Clear first to guarantee re-announcement of identical sequential messages
    setAnnouncement('');
    requestAnimationFrame(() => {
      setAnnouncement(message);
    });
  }, []);

  return (
    <LiveRegionContext.Provider value={{ announce }}>
      {children}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>
    </LiveRegionContext.Provider>
  );
}
