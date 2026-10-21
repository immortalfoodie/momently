import { HIGH_IMPACT_FAMILIES, LOW_VISIBILITY_FAMILIES } from '@/data/impactWeights';
import type { BudgetItem, EventPlan, Money, PlanPatchOp } from '@/domain/types';
import { formatInr } from '@/lib/format';
import { budgetTotal, getBudgetCap } from './budget';
import type { EngineContext } from './context';
import { stepItemQuality } from './levers';
import { previewOps } from './preview';

export interface RebalanceResult {
  changed: boolean;
  ops: PlanPatchOp[];
  upgraded: string[];
  downgraded: string[];
  netCostChange: Money;
  message: string;
}

interface StepAttempt {
  nextPlan: EventPlan;
  ops: PlanPatchOp[];
  downgraded: string[];
}

function tryFundViaDowngrades(
  workingPlan: EventPlan,
  upgradeOp: PlanPatchOp,
  maxAllowed: Money,
  ctx: EngineContext,
): StepAttempt | null {
  const candidateDownOps: PlanPatchOp[] = [];
  const candidateDownLabels: string[] = [];

  for (const lowFam of LOW_VISIBILITY_FAMILIES) {
    const lowItem = workingPlan.budgetItems.find(
      (i) =>
        i.rateKey?.startsWith(`${lowFam}.`) && !i.locked && i.provenance === 'estimate',
    );
    if (!lowItem) continue;

    const stepDown = stepItemQuality(workingPlan, lowItem, 'down');
    if (!stepDown) continue;

    candidateDownOps.push({
      type: 'update_budget_item',
      id: lowItem.id,
      changes: stepDown.changes,
    });
    candidateDownLabels.push(lowItem.label);

    const trialOps = [upgradeOp, ...candidateDownOps];
    const previewBoth = previewOps(workingPlan, trialOps, ctx);

    if (previewBoth.ok && previewBoth.value.impact.budgetTotalAfter <= maxAllowed) {
      return {
        nextPlan: previewBoth.value.plan,
        ops: trialOps,
        downgraded: candidateDownLabels,
      };
    }
  }

  return null;
}

function tryStepHighImpact(
  workingPlan: EventPlan,
  item: BudgetItem,
  maxAllowed: Money,
  ctx: EngineContext,
): StepAttempt | null {
  const stepUp = stepItemQuality(workingPlan, item, 'up');
  if (!stepUp) return null;

  const upgradeOp: PlanPatchOp = {
    type: 'update_budget_item',
    id: item.id,
    changes: stepUp.changes,
  };

  const previewUp = previewOps(workingPlan, [upgradeOp], ctx);
  if (previewUp.ok && previewUp.value.impact.budgetTotalAfter <= maxAllowed) {
    return {
      nextPlan: previewUp.value.plan,
      ops: [upgradeOp],
      downgraded: [],
    };
  }

  return tryFundViaDowngrades(workingPlan, upgradeOp, maxAllowed, ctx);
}

/**
 * Optimizes budget allocation to "make it feel expensive" without increasing overall spend.
 * WHY: Reallocates capital from low-visibility categories into high-impact visual centerpieces.
 */
export function rebalanceForImpact(plan: EventPlan, ctx: EngineContext): RebalanceResult {
  const initialTotal = budgetTotal(plan.budgetItems, plan.meta.guestCount);
  const cap = getBudgetCap(plan.constraints);
  const maxAllowed = cap !== null ? Math.min(initialTotal, cap) : initialTotal;

  let workingPlan = plan;
  const accumulatedOps: PlanPatchOp[] = [];
  const upgraded: string[] = [];
  const downgraded: string[] = [];

  for (const highFam of HIGH_IMPACT_FAMILIES) {
    const item = workingPlan.budgetItems.find(
      (i) =>
        i.rateKey?.startsWith(`${highFam}.`) && !i.locked && i.provenance === 'estimate',
    );
    if (!item) continue;

    const result = tryStepHighImpact(workingPlan, item, maxAllowed, ctx);
    if (!result) continue;

    workingPlan = result.nextPlan;
    accumulatedOps.push(...result.ops);
    upgraded.push(item.label);
    downgraded.push(...result.downgraded);
  }

  if (accumulatedOps.length === 0) {
    return {
      changed: false,
      ops: [],
      upgraded: [],
      downgraded: [],
      netCostChange: 0,
      message:
        'No impact rebalance opportunities found within current budget constraints.',
    };
  }

  const finalTotal = budgetTotal(workingPlan.budgetItems, plan.meta.guestCount);
  const netCostChange = finalTotal - initialTotal;
  const descDown =
    downgraded.length > 0 ? ` funded by stepping down ${downgraded.join(', ')}` : '';
  return {
    changed: true,
    ops: accumulatedOps,
    upgraded,
    downgraded,
    netCostChange,
    message: `Enhanced high-impact items (${upgraded.join(', ')})${descDown}. Net cost change: ${formatInr(netCostChange)}.`,
  };
}
