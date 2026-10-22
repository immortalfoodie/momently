'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { EventPlan } from '@/domain/types';
import type { EventRecord } from '@/store/persistSchema';
import type { EventDerivedMetrics } from '@/store/selectors';

export interface EventContextValue {
  event: EventRecord;
  plan: EventPlan;
  derived: EventDerivedMetrics;
}

const EventContext = createContext<EventContextValue | null>(null);

export interface EventContextProviderProps {
  value: EventContextValue;
  children: ReactNode;
}

/**
 * Context provider exposing active event data and memoized derived metrics.
 */
export function EventContextProvider({ value, children }: EventContextProviderProps) {
  return <EventContext.Provider value={value}>{children}</EventContext.Provider>;
}

/**
 * Hook providing access to the current event workspace context.
 * WHY: Enables child routes (/events/[id]/budget, checklist, etc.) to consume active plan state
 * without drilling props or duplicate engine derivations.
 */
export function useCurrentEvent(): EventContextValue {
  const context = useContext(EventContext);
  if (!context) {
    throw new Error('useCurrentEvent must be used within an EventContextProvider');
  }
  return context;
}

/**
 * Optional variant of useCurrentEvent that returns null if outside provider.
 */
export function useOptionalCurrentEvent(): EventContextValue | null {
  return useContext(EventContext);
}
