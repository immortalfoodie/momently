import type { EventMeta, EventPlan, Money } from '@/domain/types';
import { budgetTotal, itemTotal } from './budget';

export interface PlanMetaDiff {
  field: string;
  before: string | number | null;
  after: string | number | null;
}

export interface PlanItemDiff {
  label: string;
  before: Money;
  after: Money;
}

export interface PlanItemTotalDiff {
  label: string;
  total: Money;
}

export interface PlanDiff {
  meta: PlanMetaDiff[];
  budgetTotalBefore: Money;
  budgetTotalAfter: Money;
  items: {
    added: PlanItemTotalDiff[];
    removed: PlanItemTotalDiff[];
    changed: PlanItemDiff[];
  };
  concept: { before: string | null; after: string | null } | null;
  scheduleChanges: number;
  taskChanges: number;
}

const META_FIELDS_TO_COMPARE: Array<keyof EventMeta> = [
  'title',
  'type',
  'city',
  'dateIso',
  'guestCount',
  'setting',
];

/**
 * Computes the full structural and financial diff between two versions of an EventPlan.
 * WHY: Powers Version History audit tables and comparison dialogs without mutating inputs.
 *
 * @param before - Baseline EventPlan snapshot.
 * @param after - Current or comparative EventPlan state.
 * @returns Complete PlanDiff record.
 */
// eslint-disable-next-line complexity
export function diffPlans(before: EventPlan, after: EventPlan): PlanDiff {
  const budgetTotalBefore = budgetTotal(before.budgetItems, before.meta.guestCount);
  const budgetTotalAfter = budgetTotal(after.budgetItems, after.meta.guestCount);

  // 1. Meta differences
  const meta: PlanMetaDiff[] = [];
  for (const field of META_FIELDS_TO_COMPARE) {
    const bVal = before.meta[field] ?? null;
    const aVal = after.meta[field] ?? null;
    if (bVal !== aVal) {
      meta.push({
        field,
        before: bVal,
        after: aVal,
      });
    }
  }

  // 2. Budget items: added, removed, changed (matching by ID)
  const beforeMap = new Map(before.budgetItems.map((i) => [i.id, i]));
  const afterMap = new Map(after.budgetItems.map((i) => [i.id, i]));

  const added: PlanItemTotalDiff[] = [];
  const removed: PlanItemTotalDiff[] = [];
  const changed: PlanItemDiff[] = [];

  for (const [id, afterItem] of afterMap) {
    const afterCost = itemTotal(afterItem, after.meta.guestCount);
    const beforeItem = beforeMap.get(id);

    if (!beforeItem) {
      added.push({ label: afterItem.label, total: afterCost });
    } else {
      const beforeCost = itemTotal(beforeItem, before.meta.guestCount);
      if (beforeCost !== afterCost) {
        changed.push({
          label: afterItem.label,
          before: beforeCost,
          after: afterCost,
        });
      }
    }
  }

  for (const [id, beforeItem] of beforeMap) {
    if (!afterMap.has(id)) {
      removed.push({
        label: beforeItem.label,
        total: itemTotal(beforeItem, before.meta.guestCount),
      });
    }
  }

  // 3. Concept change
  let concept: PlanDiff['concept'] = null;
  if (before.selectedConceptId !== after.selectedConceptId) {
    const beforeTitle =
      before.concepts.find((c) => c.id === before.selectedConceptId)?.title ??
      before.selectedConceptId ??
      null;
    const afterTitle =
      after.concepts.find((c) => c.id === after.selectedConceptId)?.title ??
      after.selectedConceptId ??
      null;
    concept = { before: beforeTitle, after: afterTitle };
  }

  // 4. Schedule changes count
  const beforeSlots = new Map(before.schedule.map((s) => [s.id, s]));
  const afterSlots = new Map(after.schedule.map((s) => [s.id, s]));
  let scheduleChanges = 0;

  for (const [id, aSlot] of afterSlots) {
    const bSlot = beforeSlots.get(id);
    if (!bSlot) {
      scheduleChanges++;
    } else if (
      bSlot.startMinute !== aSlot.startMinute ||
      bSlot.durationMinutes !== aSlot.durationMinutes ||
      bSlot.title !== aSlot.title ||
      bSlot.priority !== aSlot.priority ||
      bSlot.flexible !== aSlot.flexible
    ) {
      scheduleChanges++;
    }
  }

  for (const id of beforeSlots.keys()) {
    if (!afterSlots.has(id)) {
      scheduleChanges++;
    }
  }

  // 5. Task changes count
  const beforeTasks = new Map(before.tasks.map((t) => [t.id, t]));
  const afterTasks = new Map(after.tasks.map((t) => [t.id, t]));
  let taskChanges = 0;

  for (const [id, aTask] of afterTasks) {
    const bTask = beforeTasks.get(id);
    if (!bTask) {
      taskChanges++;
    } else if (
      bTask.title !== aTask.title ||
      bTask.status !== aTask.status ||
      bTask.priority !== aTask.priority ||
      bTask.category !== aTask.category ||
      bTask.dueDaysBefore !== aTask.dueDaysBefore
    ) {
      taskChanges++;
    }
  }

  for (const id of beforeTasks.keys()) {
    if (!afterTasks.has(id)) {
      taskChanges++;
    }
  }

  return {
    meta,
    budgetTotalBefore,
    budgetTotalAfter,
    items: {
      added,
      removed,
      changed,
    },
    concept,
    scheduleChanges,
    taskChanges,
  };
}
