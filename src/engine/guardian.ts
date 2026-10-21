import type {
  BudgetItem,
  EventPlan,
  Money,
  PlanImpact,
  PlanPatchOp,
} from '@/domain/types';
import { budgetTotal, getBudgetCap } from './budget';
import type { EngineContext } from './context';
import { computeImpact } from './impact';
import type { SavingLever } from './levers';
import { buildSavingLevers } from './levers';
import { previewOps } from './preview';

export type { UpgradeProposal } from './upgradeProposal';
export { fundUpgrade } from './upgradeProposal';

export interface SavingsPlan {
  id: string;
  label: string;
  target: Money;
  achieved: Money;
  met: boolean;
  shortfall: Money;
  levers: SavingLever[];
  ops: PlanPatchOp[];
  previewImpact?: PlanImpact;
}

/**
 * Assesses the budget impact of adding a proposed budget item before host approval.
 * WHY: Provides real-time sanity checking on new expenses against the hard budget cap.
 */
export function assessAddition(
  plan: EventPlan,
  item: Omit<BudgetItem, 'id'>,
  ctx: EngineContext,
): {
  fits: boolean;
  overBy: Money;
  newTotal: Money;
  cap: Money | null;
  impact: PlanImpact;
} {
  const tempItem: BudgetItem = { ...item, id: ctx.ids('item') };
  const preview = previewOps(plan, [{ type: 'add_budget_item', item: tempItem }], ctx);
  const cap = getBudgetCap(plan.constraints);

  if (!preview.ok) {
    const fallbackTotal = budgetTotal(
      [...plan.budgetItems, tempItem],
      plan.meta.guestCount,
    );
    const overBy = cap !== null ? Math.max(0, fallbackTotal - cap) : 0;
    return {
      fits: cap === null || fallbackTotal <= cap,
      overBy,
      newTotal: fallbackTotal,
      cap,
      impact: computeImpact(
        plan,
        { ...plan, budgetItems: [...plan.budgetItems, tempItem] },
        [],
      ),
    };
  }

  const newTotal = preview.value.impact.budgetTotalAfter;
  const overBy = cap !== null ? Math.max(0, newTotal - cap) : 0;
  const fits = cap === null || newTotal <= cap;

  return { fits, overBy, newTotal, cap, impact: preview.value.impact };
}

function simulateGreedySavings(
  plan: EventPlan,
  targetAmount: Money,
  strategyId: string,
  strategyLabel: string,
  filterAndSort: (levers: SavingLever[]) => SavingLever[],
  options: { protectedFamilies?: string[]; maxLevers?: number },
  ctx: EngineContext,
): SavingsPlan {
  const maxLevers = options.maxLevers ?? 8;
  const initialTotal = budgetTotal(plan.budgetItems, plan.meta.guestCount);
  let currentPlan = plan;
  const chosenLevers: SavingLever[] = [];
  const accumulatedOps: PlanPatchOp[] = [];

  while (chosenLevers.length < maxLevers) {
    const currentTotal = budgetTotal(
      currentPlan.budgetItems,
      currentPlan.meta.guestCount,
    );
    const achieved = Math.max(0, initialTotal - currentTotal);
    if (achieved >= targetAmount) break;

    const available = buildSavingLevers(currentPlan, options);
    const sorted = filterAndSort(available);
    if (sorted.length === 0) break;

    const lever = sorted[0];
    if (!lever) break;
    const preview = previewOps(currentPlan, lever.ops, ctx);
    if (!preview.ok) break;

    currentPlan = preview.value.plan;
    chosenLevers.push(lever);
    accumulatedOps.push(...lever.ops);
  }

  const finalTotal = budgetTotal(currentPlan.budgetItems, currentPlan.meta.guestCount);
  const achieved = Math.max(0, initialTotal - finalTotal);
  const met = achieved >= targetAmount;
  const shortfall = Math.max(0, targetAmount - achieved);
  const impact = computeImpact(plan, currentPlan, []);

  return {
    id: strategyId,
    label: strategyLabel,
    target: targetAmount,
    achieved,
    met,
    shortfall,
    levers: chosenLevers,
    ops: accumulatedOps,
    previewImpact: impact,
  };
}

const DEFAULT_CLOCK = () => new Date('2026-01-01T00:00:00.000Z');
const DEFAULT_IDS = (p?: string): string => `${p ?? 'id'}_temp`;

/**
 * Generates up to 3 distinct savings strategies to recover a target deficit.
 * WHY: Empowers hosts with choice: "Least noticeable", "Fewest changes", or "Protect the experience".
 */
export function suggestSavings(
  plan: EventPlan,
  targetAmount: Money,
  options: { protectedFamilies?: string[]; maxLevers?: number } = {},
  ctx: EngineContext = { ids: DEFAULT_IDS, clock: DEFAULT_CLOCK },
): SavingsPlan[] {
  const configs: Array<{
    id: string;
    label: string;
    fn: (levers: SavingLever[]) => SavingLever[];
  }> = [
    {
      id: 'least_noticeable',
      label: 'Least noticeable',
      fn: (levers) => levers,
    },
    {
      id: 'fewest_changes',
      label: 'Fewest changes',
      fn: (levers) => {
        const nonHigh = levers.filter((l) => l.experienceImpact !== 'high');
        const candidate = nonHigh.length > 0 ? nonHigh : levers;
        return [...candidate].sort((a, b) => b.savings - a.savings);
      },
    },
    {
      id: 'protect_experience',
      label: 'Protect the experience',
      fn: (levers) => levers.filter((l) => l.experienceImpact !== 'high'),
    },
  ];

  const results: SavingsPlan[] = [];
  const seenSignatures = new Set<string>();

  for (const cfg of configs) {
    const outcome = simulateGreedySavings(
      plan,
      targetAmount,
      cfg.id,
      cfg.label,
      cfg.fn,
      options,
      ctx,
    );
    const signature = outcome.levers
      .map((l) => l.id)
      .sort()
      .join('|');
    if (!seenSignatures.has(signature)) {
      seenSignatures.add(signature);
      results.push(outcome);
    }
  }

  return results;
}
