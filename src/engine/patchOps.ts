import type { Constraint, EventPlan, PlanImpact, PlanPatchOp } from '@/domain/types';
import type { Result } from '@/lib/result';
import { err, ok } from '@/lib/result';
import { contingencyPercent, refreshContingency } from './budget';
import type { BudgetPatchOp } from './patchBudgetOps';
import { handleBudgetItemOps } from './patchBudgetOps';
import { reestimateForGuestCount } from './propagate';
import { shiftSlots } from './schedule';

export interface PatchError {
  code:
    | 'not_approved'
    | 'item_not_found'
    | 'item_locked'
    | 'concept_not_found'
    | 'slot_not_found'
    | 'schedule_overflow'
    | 'hard_constraint_violation';
  message: string;
  impact?: PlanImpact;
}

export type OpResult = Result<{ plan: EventPlan; notes: string[] }, PatchError>;

type ScheduleOpType = 'add_slot' | 'update_slot' | 'remove_slot' | 'shift_schedule';
type MetaOpType = 'set_meta' | 'set_setting';

type SchedulePatchOp = Extract<PlanPatchOp, { type: ScheduleOpType }>;
type MetaPatchOp = Extract<PlanPatchOp, { type: MetaOpType }>;

function isBudgetOp(op: PlanPatchOp): op is BudgetPatchOp {
  return (
    op.type === 'add_budget_item' ||
    op.type === 'update_budget_item' ||
    op.type === 'remove_budget_item' ||
    op.type === 'scale_category'
  );
}

function isScheduleOp(op: PlanPatchOp): op is SchedulePatchOp {
  return (
    op.type === 'add_slot' ||
    op.type === 'update_slot' ||
    op.type === 'remove_slot' ||
    op.type === 'shift_schedule'
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
  return {
    plan: {
      ...plan,
      meta: { ...plan.meta, guestCount: newCount },
      constraints: updatedConstraints,
      budgetItems: reestimate.items,
    },
    notes: reestimate.notes,
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

function handleScheduleOps(plan: EventPlan, op: SchedulePatchOp): OpResult {
  if (op.type === 'shift_schedule') {
    const shifted = shiftSlots(plan.schedule, op.fromMinute, op.deltaMinutes);
    if (!shifted.ok) {
      return err({
        code: 'schedule_overflow',
        message: 'Shifted schedule slots would breach 00:00 to 24:00 boundary',
      });
    }
    return ok({ plan: { ...plan, schedule: shifted.value }, notes: [] });
  }
  if (op.type === 'add_slot')
    return ok({ plan: { ...plan, schedule: [...plan.schedule, op.slot] }, notes: [] });
  if (!plan.schedule.some((s) => s.id === op.id))
    return err({ code: 'slot_not_found', message: `Slot ${op.id} not found` });

  const schedule =
    op.type === 'update_slot'
      ? plan.schedule.map((s) => (s.id === op.id ? { ...s, ...op.changes } : s))
      : plan.schedule.filter((s) => s.id !== op.id);

  return ok({ plan: { ...plan, schedule }, notes: [] });
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
  if (
    typeof op.changes.guestCount === 'number' &&
    op.changes.guestCount !== plan.meta.guestCount
  ) {
    const interim = handleGuestCountChange(plan, op.changes.guestCount);
    return ok({
      plan: { ...interim.plan, meta: { ...interim.plan.meta, ...op.changes } },
      notes: interim.notes,
    });
  }
  return ok({ plan: { ...plan, meta: { ...plan.meta, ...op.changes } }, notes: [] });
}

function handleMiscOps(plan: EventPlan, op: PlanPatchOp): OpResult {
  if (op.type === 'select_concept') {
    if (op.conceptId !== null && !plan.concepts.some((c) => c.id === op.conceptId)) {
      return err({
        code: 'concept_not_found',
        message: `Concept ${op.conceptId} not found`,
      });
    }
    return ok({ plan: { ...plan, selectedConceptId: op.conceptId }, notes: [] });
  }
  if (op.type === 'add_constraint')
    return ok({
      plan: { ...plan, constraints: [...plan.constraints, op.constraint] },
      notes: [],
    });
  if (op.type === 'remove_constraint')
    return ok({
      plan: { ...plan, constraints: plan.constraints.filter((c) => c.id !== op.id) },
      notes: [],
    });
  if (op.type === 'add_task')
    return ok({ plan: { ...plan, tasks: [...plan.tasks, op.task] }, notes: [] });
  if (op.type === 'update_task')
    return ok({
      plan: {
        ...plan,
        tasks: plan.tasks.map((t) => (t.id === op.id ? { ...t, ...op.changes } : t)),
      },
      notes: [],
    });
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
  if (isBudgetOp(op)) return handleBudgetItemOps(plan, op);
  if (isScheduleOp(op)) return handleScheduleOps(plan, op);
  if (isMetaOp(op)) return handleMetaOps(plan, op);
  return handleMiscOps(plan, op);
}
