import type {
  DecisionRecord,
  EventPlan,
  PlanImpact,
  PlanPatch,
  PlanPatchOp,
} from '@/domain/types';
import type { Result } from '@/lib/result';
import { err, ok } from '@/lib/result';
import type { EngineContext } from './context';
import { findViolations } from './constraints';
import { computeImpact } from './impact';
import type { PatchError } from './patchOps';
import { reducePatchOp } from './patchOps';
import { contingencyPercent, refreshContingency } from './budget';

export type { PatchError } from './patchOps';

export interface PatchContext extends EngineContext {
  allowHardViolations?: boolean;
}

/**
 * Creates a validated PlanPatch object with standard defaults.
 * WHY: Provides a uniform helper for user interfaces and AI generation layers to construct patches.
 *
 * @param ops - Ordered array of PlanPatchOp operations (1-30).
 * @param reason - Descriptive rationale for the patch.
 * @param source - Originator of the patch ('user' | 'ai' | 'chaos').
 * @param ids - ID generator for patch ID creation.
 * @param clock - Clock function for timestamping.
 * @param status - Initial lifecycle status (defaults to 'proposed').
 * @returns A validated PlanPatch record.
 */
export function createPatch(
  ops: PlanPatchOp[],
  reason: string,
  source: 'user' | 'ai' | 'chaos',
  ids: (prefix?: string) => string,
  clock: () => Date,
  status: 'proposed' | 'approved' | 'rejected' | 'applied' = 'proposed',
): PlanPatch {
  return {
    id: ids('patch'),
    ops,
    reason,
    source,
    status,
    createdAt: clock().toISOString(),
  };
}

/**
 * Applies a plan patch purely against an EventPlan through the formal approval gate.
 * WHY: Enforces the architectural rule 'LLM proposes, engine decides'. Unapproved patches are blocked,
 * operations execute deterministically in sequence, and hard constraints are validated on the final state.
 *
 * @param plan - The existing baseline EventPlan.
 * @param patch - The PlanPatch to execute.
 * @param ctx - Context providing ID generators, clock, and violation override flags.
 * @returns Result containing updated EventPlan and PlanImpact diff, or a PatchError.
 */
export function applyPatch(
  plan: EventPlan,
  patch: PlanPatch,
  ctx: PatchContext,
): Result<{ plan: EventPlan; impact: PlanImpact }, PatchError> {
  if (patch.status !== 'approved') {
    return err({
      code: 'not_approved',
      message: `Patch ${patch.id} cannot be applied with status '${patch.status}'. User approval is required.`,
    });
  }

  let workingCopy: EventPlan = {
    ...plan,
    meta: { ...plan.meta },
    constraints: [...plan.constraints],
    budgetItems: [...plan.budgetItems],
    schedule: [...plan.schedule],
    tasks: [...plan.tasks],
    vendors: [...plan.vendors],
    guestNeeds: { ...plan.guestNeeds },
    concepts: [...plan.concepts],
    ledger: [...plan.ledger],
  };

  const accumulatedNotes: string[] = [];

  for (const op of patch.ops) {
    const stepResult = reducePatchOp(workingCopy, op, ctx.ids);
    if (!stepResult.ok) {
      return stepResult;
    }
    workingCopy = stepResult.value.plan;
    accumulatedNotes.push(...stepResult.value.notes);
  }

  const pct = contingencyPercent(workingCopy.meta.type, workingCopy.meta.setting);
  workingCopy.budgetItems = refreshContingency(
    workingCopy.budgetItems,
    workingCopy.meta.guestCount,
    pct,
  );

  const violations = findViolations(workingCopy);
  if (violations.length > 0 && ctx.allowHardViolations !== true) {
    const first = violations[0];
    const impact = computeImpact(plan, workingCopy, accumulatedNotes);
    return err({
      code: 'hard_constraint_violation',
      message: first?.message ?? 'Hard constraint violation detected.',
      impact,
    });
  }

  const ledgerEntry: DecisionRecord = {
    id: ctx.ids('dec'),
    timestamp: ctx.clock().toISOString(),
    summary: patch.reason,
    source: patch.source,
    status: 'approved',
  };

  const finalPlan: EventPlan = {
    ...workingCopy,
    version: plan.version + 1,
    updatedAt: ctx.clock().toISOString(),
    ledger: [...workingCopy.ledger, ledgerEntry],
  };

  const impact = computeImpact(plan, finalPlan, accumulatedNotes);
  return ok({ plan: finalPlan, impact });
}
