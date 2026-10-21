import { getTemplate } from '@/data/templates';
import { HIGH_IMPACT_FAMILIES } from '@/data/impactWeights';
import type { BudgetItem, EventPlan, Money, PlanPatchOp } from '@/domain/types';
import { formatInr } from '@/lib/format';
import { itemTotal } from './budget';

export type ExperienceImpact = 'low' | 'medium' | 'high';

export interface SavingLever {
  id: string;
  label: string;
  savings: Money;
  experienceImpact: ExperienceImpact;
  rationale: string;
  ops: PlanPatchOp[];
}

const IMPACT_SCORE: Record<ExperienceImpact, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

import { qualityOfItem, setItemQuality, stepItemQuality } from './qualityOps';
export { qualityOfItem, setItemQuality, stepItemQuality };

function computeImpactForFamily(
  family: string,
  order: readonly string[],
): ExperienceImpact {
  const total = order.length;
  if (total === 0) return 'medium';
  const idx = order.indexOf(family);
  if (idx === -1) return 'medium';

  const lowCutoff = Math.ceil(total / 3);
  const medCutoff = Math.ceil((2 * total) / 3);

  if (idx < lowCutoff) return 'low';
  if (idx < medCutoff) return 'medium';
  return 'high';
}

function createStepDownLever(
  plan: EventPlan,
  item: BudgetItem,
  family: string,
  downgradeOrder: readonly string[],
): SavingLever | undefined {
  const step = stepItemQuality(plan, item, 'down');
  if (!step) return undefined;

  const currentCost = itemTotal(item, plan.meta.guestCount);
  const savings = currentCost - step.newTotal;
  if (savings <= 0) return undefined;

  const impact = computeImpactForFamily(family, downgradeOrder);
  const qLabel = qualityOfItem({ ...item, ...step.changes }) ?? 'lower tier';
  return {
    id: `lever.${item.id}.down`,
    label: `Downgrade ${item.label} to ${qLabel}`,
    savings,
    experienceImpact: impact,
    rationale: `Step down ${item.label} to save ${formatInr(savings)}`,
    ops: [{ type: 'update_budget_item', id: item.id, changes: step.changes }],
  };
}

function createRemovalLever(
  plan: EventPlan,
  item: BudgetItem,
  family: string,
  requiredFamilies: Set<string>,
): SavingLever | undefined {
  if (requiredFamilies.has(family)) return undefined;

  const savings = itemTotal(item, plan.meta.guestCount);
  if (savings <= 0) return undefined;

  const isHighImpact = (HIGH_IMPACT_FAMILIES as readonly string[]).includes(family);
  const impact: ExperienceImpact = isHighImpact ? 'high' : 'medium';
  return {
    id: `lever.${item.id}.remove`,
    label: `Remove optional ${item.label}`,
    savings,
    experienceImpact: impact,
    rationale: `Remove optional ${item.label} to save ${formatInr(savings)}`,
    ops: [{ type: 'remove_budget_item', id: item.id }],
  };
}

function compareLevers(a: SavingLever, b: SavingLever): number {
  const diffImpact = IMPACT_SCORE[a.experienceImpact] - IMPACT_SCORE[b.experienceImpact];
  if (diffImpact !== 0) return diffImpact;
  const diffSavings = b.savings - a.savings;
  if (diffSavings !== 0) return diffSavings;
  return a.id.localeCompare(b.id);
}

function isEligibleForSavings(item: BudgetItem, protectedFamilies: Set<string>): boolean {
  if (
    item.category === 'contingency' ||
    item.locked ||
    item.provenance !== 'estimate' ||
    !item.rateKey
  ) {
    return false;
  }
  const family = item.rateKey.split('.')[0];
  return Boolean(family && !protectedFamilies.has(family));
}

export function buildSavingLevers(
  plan: EventPlan,
  options?: { protectedFamilies?: string[] },
): SavingLever[] {
  const protectedFamilies = new Set(options?.protectedFamilies ?? []);
  const template = getTemplate(plan.meta.type);
  const requiredFamilies = new Set(
    template.lineItems.filter((li) => li.required).map((li) => li.family),
  );
  const levers: SavingLever[] = [];

  for (const item of plan.budgetItems) {
    if (!isEligibleForSavings(item, protectedFamilies)) continue;
    const family = item.rateKey?.split('.')[0] ?? '';

    const downLever = createStepDownLever(plan, item, family, template.downgradeOrder);
    if (downLever) levers.push(downLever);

    const removeLever = createRemovalLever(plan, item, family, requiredFamilies);
    if (removeLever) levers.push(removeLever);
  }

  return levers.sort(compareLevers);
}
