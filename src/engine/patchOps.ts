import type { Constraint, EventPlan, PlanImpact, PlanPatchOp } from '@/domain/types';
import type { Result } from '@/lib/result';
import { err, ok } from '@/lib/result';
import { contingencyPercent, refreshContingency } from './budget';
import type { BudgetPatchOp } from './patchBudgetOps';
import { handleBudgetItemOps } from './patchBudgetOps';
import {
  clampGuestNeedsToCount,
  handleSetGuestNeeds,
  handleVendorOps,
} from './patchGuestVendorOps';
import { handleScheduleOps, isScheduleOp } from './patchScheduleOps';
import { reestimateEstimates, reestimateForGuestCount } from './propagate';
import { tierForCity } from './pricing';

export interface PatchError {
  code:
    | 'not_approved'
    | 'item_not_found'
    | 'item_locked'
    | 'concept_not_found'
    | 'slot_not_found'
    | 'task_not_found'
    | 'vendor_not_found'
    | 'schedule_overflow'
    | 'hard_constraint_violation'
    | 'invalid_change';
  message: string;
  impact?: PlanImpact;
}

export type OpResult = Result<{ plan: EventPlan; notes: string[] }, PatchError>;

type MetaOpType = 'set_meta' | 'set_setting';
type MetaPatchOp = Extract<PlanPatchOp, { type: MetaOpType }>;

function isBudgetOp(op: PlanPatchOp): op is BudgetPatchOp {
  return (
    op.type === 'add_budget_item' ||
    op.type === 'update_budget_item' ||
    op.type === 'remove_budget_item' ||
    op.type === 'scale_category'
  );
}

function isMetaOp(op: PlanPatchOp): op is MetaPatchOp {
  return op.type === 'set_meta' || op.type === 'set_setting';
}

function handleGuestCountChange(
  plan: EventPlan,
  newCount: number,
): { plan: EventPlan; notes: string[] } {
  const reestimate = reestimateForGuestCount(plan, newCount);
  const updatedConstraints = plan.constraints.map((c) =>
    c.kind === 'guest_count' ? { ...c, numericValue: newCount } : c,
  );
  const { needs, clampedFields } = clampGuestNeedsToCount(plan.guestNeeds, newCount);
  const notes = [...reestimate.notes];
  if (clampedFields.length > 0) {
    notes.push(`Guest needs clamped to new count: ${clampedFields.join(', ')}`);
  }
  return {
    plan: {
      ...plan,
      meta: { ...plan.meta, guestCount: newCount },
      guestNeeds: needs,
      constraints: updatedConstraints,
      budgetItems: reestimate.items,
    },
    notes,
  };
}

function handleBudgetCapChange(
  plan: EventPlan,
  amount: number,
  ids: (prefix?: string) => string,
): { plan: EventPlan; notes: string[] } {
  const hasCap = plan.constraints.some((c) => c.kind === 'budget_cap');
  const capConstraint: Constraint = {
    id: ids('c_cap'),
    kind: 'budget_cap',
    severity: 'hard',
    description: 'Maximum budget cap',
    numericValue: amount,
  };
  const constraints = hasCap
    ? plan.constraints.map((c) =>
        c.kind === 'budget_cap' ? { ...c, numericValue: amount } : c,
      )
    : [...plan.constraints, capConstraint];
  return { plan: { ...plan, constraints }, notes: [] };
}

function handleMetaOps(plan: EventPlan, op: MetaPatchOp): OpResult {
  if (op.type === 'set_setting') {
    const pct = contingencyPercent(plan.meta.type, op.setting);
    const budgetItems = refreshContingency(plan.budgetItems, plan.meta.guestCount, pct);
    return ok({
      plan: { ...plan, meta: { ...plan.meta, setting: op.setting }, budgetItems },
      notes: [],
    });
  }

  if (op.changes.type !== undefined && op.changes.type !== plan.meta.type) {
    return err({
      code: 'invalid_change',
      message: "The event type can't be changed after planning starts; create a new event instead",
    });
  }

  let workingPlan = plan;
  const accumulatedNotes: string[] = [];

  if (
    typeof op.changes.guestCount === 'number' &&
    op.changes.guestCount !== workingPlan.meta.guestCount
  ) {
    const interim = handleGuestCountChange(workingPlan, op.changes.guestCount);
    workingPlan = interim.plan;
    accumulatedNotes.push(...interim.notes);
  }

  if (op.changes.city !== undefined && op.changes.city !== workingPlan.meta.city) {
    const oldTier = tierForCity(workingPlan.meta.city);
    const newTier = tierForCity(op.changes.city);
    if (oldTier !== newTier) {
      const planWithNewCity: EventPlan = {
        ...workingPlan,
        meta: { ...workingPlan.meta, ...op.changes, city: op.changes.city },
      };
      const reestimate = reestimateEstimates(planWithNewCity);
      workingPlan = {
        ...planWithNewCity,
        budgetItems: reestimate.items,
      };
      accumulatedNotes.push(`Prices re-estimated for ${newTier} city rates`);
      return ok({
        plan: { ...workingPlan, meta: { ...workingPlan.meta, ...op.changes } },
        notes: accumulatedNotes,
      });
    }
  }

  return ok({ plan: { ...workingPlan, meta: { ...workingPlan.meta, ...op.changes } }, notes: accumulatedNotes });
}

function handleTaskOps(plan: EventPlan, op: PlanPatchOp): OpResult | null {
  if (op.type === 'add_task') {
    return ok({ plan: { ...plan, tasks: [...plan.tasks, op.task] }, notes: [] });
  }
  if (op.type === 'update_task' || op.type === 'remove_task') {
    if (!plan.tasks.some((t) => t.id === op.id)) {
      return err({ code: 'task_not_found', message: `Task ${op.id} not found` });
    }
    const tasks =
      op.type === 'update_task'
        ? plan.tasks.map((t) => (t.id === op.id ? { ...t, ...op.changes } : t))
        : plan.tasks.filter((t) => t.id !== op.id);
    return ok({ plan: { ...plan, tasks }, notes: [] });
  }
  return null;
}

function handleMiscOps(plan: EventPlan, op: PlanPatchOp): OpResult {
  const taskRes = handleTaskOps(plan, op);
  if (taskRes) return taskRes;

  if (op.type === 'select_concept') {
    if (op.conceptId !== null && !plan.concepts.some((c) => c.id === op.conceptId)) {
      return err({
        code: 'concept_not_found',
        message: `Concept ${op.conceptId} not found`,
      });
    }
    return ok({ plan: { ...plan, selectedConceptId: op.conceptId }, notes: [] });
  }
  if (op.type === 'add_constraint') {
    return ok({
      plan: { ...plan, constraints: [...plan.constraints, op.constraint] },
      notes: [],
    });
  }
  if (op.type === 'remove_constraint') {
    return ok({
      plan: { ...plan, constraints: plan.constraints.filter((c) => c.id !== op.id) },
      notes: [],
    });
  }
  return ok({ plan, notes: [] });
}

/**
 * Executes a single plan patch operation purely against an EventPlan.
 * WHY: Dispatches specific atomic patch mutations cleanly while isolating error propagation.
 *
 * @param plan - Current state of the plan.
 * @param op - The atomic PlanPatchOp to execute.
 * @param ids - ID generator for constraint creation.
 * @returns Result containing modified plan and generated notes, or PatchError.
 */
export function reducePatchOp(
  plan: EventPlan,
  op: PlanPatchOp,
  ids: (prefix?: string) => string,
): OpResult {
  if (op.type === 'set_guest_count')
    return ok(handleGuestCountChange(plan, op.guestCount));
  if (op.type === 'set_budget_cap')
    return ok(handleBudgetCapChange(plan, op.amount, ids));
  if (op.type === 'set_guest_needs')
    return handleSetGuestNeeds(plan, op.changes);
  if (
    op.type === 'update_vendor_need' ||
    op.type === 'upsert_vendor_quote' ||
    op.type === 'remove_vendor_quote'
  ) {
    return handleVendorOps(plan, op);
  }
  if (isBudgetOp(op)) return handleBudgetItemOps(plan, op);
  if (isScheduleOp(op)) return handleScheduleOps(plan, op);
  if (isMetaOp(op)) return handleMetaOps(plan, op);
  return handleMiscOps(plan, op);
}
