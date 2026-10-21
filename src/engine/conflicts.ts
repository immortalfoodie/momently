import type { EventPlan, PlanImpact, PlanPatchOp } from '@/domain/types';
import { formatInr } from '@/lib/format';
import { budgetTotal } from './budget';
import { checkLogisticsConflicts, checkMustHaveConflicts } from './conflictRules';
import { findViolations } from './constraints';
import type { EngineContext } from './context';
import { maxGuestsWithinCap, minimumFeasibleCost } from './feasibility';
import { suggestSavings } from './guardian';
import type { PatchError } from './patch';
import { previewOps } from './preview';

export { maxGuestsWithinCap, minimumFeasibleCost } from './feasibility';

export const MONSOON_MONTHS = [6, 7, 8, 9] as const;

export type ConflictKind =
  | 'cap_below_floor'
  | 'cap_exceeded'
  | 'guest_limit_exceeded'
  | 'must_have_missing'
  | 'access_unconfirmed'
  | 'monsoon_outdoor';

export interface ResolutionOption {
  id: string;
  label: string;
  tradeoff: string;
  ops: PlanPatchOp[];
}

export interface Conflict {
  id: string;
  kind: ConflictKind;
  severity: 'blocking' | 'warning';
  message: string;
  options: ResolutionOption[];
}

export interface CheckRequestResult {
  verdict: 'ok' | 'conflict' | 'invalid';
  newConflicts: Conflict[];
  impact?: PlanImpact;
  error?: PatchError;
}

function checkCapConflicts(plan: EventPlan, ctx: EngineContext): Conflict[] {
  const hardCap = plan.constraints.find(
    (c) =>
      c.kind === 'budget_cap' && c.severity === 'hard' && c.numericValue !== undefined,
  );
  if (!hardCap || hardCap.numericValue === undefined) return [];
  const capValue = hardCap.numericValue;

  const floor = minimumFeasibleCost(plan.meta, plan.guestNeeds, ctx);
  if (capValue < floor) {
    const maxG = maxGuestsWithinCap(plan.meta, capValue, plan.guestNeeds, ctx);
    const options: ResolutionOption[] = [
      {
        id: 'opt_raise_cap_to_floor',
        label: `Raise budget cap to ${formatInr(floor)}`,
        tradeoff: 'Matches budget to absolute minimum essential event baseline',
        ops: [{ type: 'set_budget_cap', amount: floor }],
      },
    ];
    if (maxG > 0) {
      options.push({
        id: 'opt_reduce_guests_to_cap',
        label: `Reduce guest count to ${maxG}`,
        tradeoff: `Reduces attendance from ${plan.meta.guestCount} to fit within ${formatInr(capValue)}`,
        ops: [{ type: 'set_guest_count', guestCount: maxG }],
      });
    }
    options.push({
      id: 'opt_relax_choice',
      label: 'Tell me which constraint to relax',
      tradeoff: 'Decide whether to increase budget, reduce headcount, or simplify format',
      ops: [],
    });

    return [
      {
        id: 'conflict_cap_below_floor',
        kind: 'cap_below_floor',
        severity: 'blocking',
        message: `Budget cap of ${formatInr(capValue)} is below the minimum essential floor of ${formatInr(floor)}.`,
        options,
      },
    ];
  }

  const violations = findViolations(plan);
  const capViolation = violations.find((v) => v.constraintId === hardCap.id);
  if (capViolation) {
    const total = budgetTotal(plan.budgetItems, plan.meta.guestCount);
    const overBy = capViolation.overBy ?? total - capValue;
    const savings = suggestSavings(plan, overBy, {}, ctx);
    const options: ResolutionOption[] = savings.slice(0, 2).map((sp) => ({
      id: `opt_savings_${sp.id}`,
      label: `Apply "${sp.label}" savings (save ${formatInr(sp.achieved)})`,
      tradeoff: 'Reduces non-essential item quality or removes optional items',
      ops: sp.ops,
    }));
    options.push({
      id: 'opt_raise_cap_to_total',
      label: `Raise budget cap to ${formatInr(total)}`,
      tradeoff: 'Increases budget cap to match current plan expenditure',
      ops: [{ type: 'set_budget_cap', amount: total }],
    });

    return [
      {
        id: 'conflict_cap_exceeded',
        kind: 'cap_exceeded',
        severity: 'blocking',
        message: `Total budget of ${formatInr(total)} exceeds hard cap of ${formatInr(capValue)} by ${formatInr(overBy)}.`,
        options,
      },
    ];
  }

  return [];
}

function checkGuestLimitConflicts(plan: EventPlan): Conflict[] {
  const maxGuestConstraint = plan.constraints.find(
    (c) =>
      c.kind === 'guest_count' &&
      c.severity === 'hard' &&
      c.numericValue !== undefined &&
      plan.meta.guestCount > c.numericValue,
  );
  if (!maxGuestConstraint || maxGuestConstraint.numericValue === undefined) return [];
  const maxGuestCount = maxGuestConstraint.numericValue;

  return [
    {
      id: 'conflict_guest_limit_exceeded',
      kind: 'guest_limit_exceeded',
      severity: 'blocking',
      message: `Guest count (${plan.meta.guestCount}) exceeds venue maximum capacity of ${maxGuestCount}.`,
      options: [
        {
          id: 'opt_set_max_guests',
          label: `Limit guest count to ${maxGuestCount}`,
          tradeoff: 'Adheres to venue physical capacity constraints',
          ops: [{ type: 'set_guest_count', guestCount: maxGuestCount }],
        },
        {
          id: 'opt_remove_guest_constraint',
          label: 'Remove guest limit constraint',
          tradeoff: `Permits attending guest list of ${plan.meta.guestCount}`,
          ops: [{ type: 'remove_constraint', id: maxGuestConstraint.id }],
        },
      ],
    },
  ];
}

/**
 * Scans an EventPlan for all structural, financial, and logistical conflicts.
 * WHY: Identifies blocking violations and advisory warnings paired with actionable resolution options.
 */
export function findConflicts(plan: EventPlan, ctx: EngineContext): Conflict[] {
  return [
    ...checkCapConflicts(plan, ctx),
    ...checkGuestLimitConflicts(plan),
    ...checkMustHaveConflicts(plan, ctx),
    ...checkLogisticsConflicts(plan, ctx),
  ];
}

/**
 * Evaluates a proposed user request, reporting new conflicts without altering baseline plan state.
 * WHY: Powers "clarify instead of silently complying": flags new trade-offs before committing.
 */
export function checkRequest(
  plan: EventPlan,
  ops: PlanPatchOp[],
  ctx: EngineContext,
): CheckRequestResult {
  const preview = previewOps(plan, ops, ctx);
  if (!preview.ok) {
    return { verdict: 'invalid', newConflicts: [], error: preview.error };
  }

  const baselineConflicts = findConflicts(plan, ctx);
  const baselineKeys = new Set(baselineConflicts.map((c) => `${c.kind}:${c.message}`));

  const projectedConflicts = findConflicts(preview.value.plan, ctx);
  const newConflicts = projectedConflicts.filter(
    (c) => !baselineKeys.has(`${c.kind}:${c.message}`),
  );

  if (newConflicts.length > 0) {
    return { verdict: 'conflict', newConflicts, impact: preview.value.impact };
  }

  return { verdict: 'ok', newConflicts: [], impact: preview.value.impact };
}
