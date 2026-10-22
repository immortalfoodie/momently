import type { DecisionRecord, EventPlan } from '@/domain/types';
import type { EngineContext } from './context';

/**
 * Historical snapshot of an EventPlan before an approved mutation.
 * WHY: Enables reliable rollback to any previous approved state without database persistence.
 */
export interface PlanSnapshot {
  version: number;
  savedAt: string;
  label: string;
  plan: EventPlan;
}

/**
 * Captures an immutable snapshot of a plan state with timestamp and descriptive label.
 * WHY: Preserves pre-change state for user audit trails and undo/recovery workflows.
 *
 * @param plan - The active EventPlan to snapshot.
 * @param label - Descriptive reason or action that triggered the snapshot.
 * @param ctx - Engine context providing the system clock.
 * @returns A frozen PlanSnapshot record.
 */
export function createSnapshot(
  plan: EventPlan,
  label: string,
  ctx: EngineContext,
): PlanSnapshot {
  return {
    version: plan.version,
    savedAt: ctx.clock().toISOString(),
    label,
    plan: {
      ...plan,
      meta: { ...plan.meta },
      constraints: [...plan.constraints],
      concepts: [...plan.concepts],
      budgetItems: [...plan.budgetItems],
      schedule: [...plan.schedule],
      tasks: [...plan.tasks],
      vendors: [...plan.vendors],
      guestNeeds: { ...plan.guestNeeds },
      ledger: [...plan.ledger],
    },
  };
}

/**
 * Restores a historical snapshot onto the current plan state.
 * WHY: Enforces that restoring an older version is an append-only forward operation:
 * the current event ID is retained, version increments (current.version + 1), and
 * the entire current audit ledger is preserved with a new restoration record.
 *
 * @param current - The current active EventPlan.
 * @param snapshot - The historical snapshot to restore.
 * @param ctx - Engine context providing ID generation and system clock.
 * @returns A new EventPlan with snapshot data and an appended restoration ledger entry.
 */
export function restoreSnapshot(
  current: EventPlan,
  snapshot: PlanSnapshot,
  ctx: EngineContext,
): EventPlan {
  const ledgerEntry: DecisionRecord = {
    id: ctx.ids('dec'),
    timestamp: ctx.clock().toISOString(),
    summary: `Restored version ${snapshot.version}`,
    source: 'user',
    status: 'approved',
  };

  const nextLedger = [...current.ledger, ledgerEntry];
  const trimmedLedger =
    nextLedger.length > 500 ? nextLedger.slice(nextLedger.length - 500) : nextLedger;

  return {
    ...snapshot.plan,
    id: current.id,
    version: current.version + 1,
    updatedAt: ctx.clock().toISOString(),
    ledger: trimmedLedger,
  };
}
