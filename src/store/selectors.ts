import { useMemo } from 'react';
import type { Conflict } from '@/engine/conflicts';
import { findConflicts } from '@/engine/conflicts';
import type { ForgottenCost } from '@/engine/forgottenCosts';
import { findForgottenCosts } from '@/engine/forgottenCosts';
import type { GuestMetrics } from '@/engine/guestMetrics';
import { deriveGuestMetrics } from '@/engine/guestMetrics';
import type { RiskReport } from '@/engine/risk';
import { scoreRisks } from '@/engine/risk';
import type { EventStage } from '@/engine/stage';
import { eventStage } from '@/engine/stage';
import type { BudgetStatus } from '@/engine/budget';
import { getBudgetStatus } from '@/engine/budget';
import { engineContext } from './engineContext';
import { useEventsStore } from './eventsStore';
import type { EventRecord } from './persistSchema';

export interface EventDerivedMetrics {
  budgetStatus: BudgetStatus;
  scoreRisks: RiskReport;
  findConflicts: Conflict[];
  findForgottenCosts: ForgottenCost[];
  deriveGuestMetrics: GuestMetrics;
  stage: EventStage;
}

/**
 * Retrieves an event record by its unique ID.
 */
export function useEvent(id: string): EventRecord | undefined {
  return useEventsStore((s) => s.events[id]);
}

/**
 * Retrieves all stored event records ordered by recency of last update.
 */
export function useEventList(): EventRecord[] {
  const events = useEventsStore((s) => s.events);
  const order = useEventsStore((s) => s.order);

  return useMemo(() => {
    return order.map((id) => events[id]).filter((e): e is EventRecord => Boolean(e));
  }, [events, order]);
}

/**
 * Indicates whether the persistent store has completed hydration from storage.
 */
export function useStoreReady(): boolean {
  return useEventsStore((s) => s.hydrated);
}

/**
 * Memoized selector deriving all pure engine metrics from the active plan version.
 * WHY: Recomputes only when plan.version changes. Zero network overhead or duplicate runs.
 */
export function useEventDerived(id: string): EventDerivedMetrics | undefined {
  const event = useEvent(id);
  const version = event?.plan.version;

  return useMemo(() => {
    if (!event) return undefined;
    const plan = event.plan;
    const today = new Date().toISOString().slice(0, 10);

    return {
      budgetStatus: getBudgetStatus(plan),
      scoreRisks: scoreRisks(plan, engineContext),
      findConflicts: findConflicts(plan, engineContext),
      findForgottenCosts: findForgottenCosts(plan),
      deriveGuestMetrics: deriveGuestMetrics(plan.meta.guestCount, plan.guestNeeds),
      stage: eventStage(plan, today),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, version]);
}
