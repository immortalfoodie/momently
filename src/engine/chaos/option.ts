import type { EventPlan, PlanPatchOp } from '@/domain/types';
import { getBudgetCap } from '@/engine/budget';
import type { EngineContext } from '@/engine/context';
import { suggestSavings } from '@/engine/guardian';
import { createPatch } from '@/engine/patch';
import { previewOps } from '@/engine/preview';
import { scoreRisks } from '@/engine/risk';
import { formatInr } from '@/lib/format';
import type { RecoveryOption } from './types';

function computeApprovals(
  ops: PlanPatchOp[],
  budgetDelta: number,
  isVendorScenario: boolean,
): string[] {
  const approvals: string[] = [];
  const hasBudgetOp = ops.some(
    (op) =>
      op.type === 'add_budget_item' ||
      op.type === 'update_budget_item' ||
      op.type === 'remove_budget_item' ||
      op.type === 'scale_category' ||
      op.type === 'set_budget_cap',
  );

  if (hasBudgetOp) {
    approvals.push(`Approve a budget change of ${formatInr(Math.abs(budgetDelta))}`);
  }

  const hasScheduleOp = ops.some(
    (op) =>
      op.type === 'add_slot' ||
      op.type === 'update_slot' ||
      op.type === 'remove_slot' ||
      op.type === 'shift_schedule',
  );
  if (hasScheduleOp) {
    approvals.push('Approve the schedule change');
  }

  if (isVendorScenario) {
    approvals.push('Momently never contacts vendors: you contact them yourself');
  }

  return approvals;
}

/**
 * Builds a proposed recovery option by evaluating preview impact, risk score deltas, and approvals.
 * WHY: Answers "what would recovery look like" without mutating active state or committing changes.
 */
export function buildOption(
  plan: EventPlan,
  ops: PlanPatchOp[],
  meta: { id: string; label: string; tradeoff: string; notes?: string[] },
  ctx: EngineContext,
  isVendorScenario = false,
): RecoveryOption | undefined {
  const preview = previewOps(plan, ops, ctx);
  if (!preview.ok) return undefined;

  const { impact, plan: projectedPlan } = preview.value;
  const scoreBefore = scoreRisks(plan, ctx).score;
  const scoreAfter = scoreRisks(projectedPlan, ctx).score;

  const patch = createPatch(ops, meta.label, 'chaos', ctx.ids, ctx.clock, 'proposed');

  const cap = getBudgetCap(plan.constraints);
  const meetsCap = cap === null || impact.budgetTotalAfter <= cap;

  let fundingOptions: RecoveryOption['fundingOptions'];
  if (cap !== null && impact.budgetTotalAfter > cap) {
    const overBy = impact.budgetTotalAfter - cap;
    fundingOptions = suggestSavings(projectedPlan, overBy, {}, ctx);
  }

  const budgetDelta = impact.budgetTotalAfter - impact.budgetTotalBefore;
  const approvalsRequired = computeApprovals(ops, budgetDelta, isVendorScenario);

  return {
    id: meta.id,
    label: meta.label,
    tradeoff: meta.tradeoff,
    patch,
    impact,
    scoreBefore,
    scoreAfter,
    approvalsRequired,
    notes: meta.notes ?? [],
    fundingOptions,
    meetsCap,
  };
}
