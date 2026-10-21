import { getRate } from '@/data/rateCards';
import type { QualityLevel, RateEntry } from '@/data/rateCards.schema';
import { getTemplate } from '@/data/templates';
import type { EventPlan, Money, PlanPatchOp } from '@/domain/types';
import { formatInr } from '@/lib/format';
import { budgetTotal, getBudgetCap } from './budget';
import type { EngineContext } from './context';
import type { SavingsPlan } from './guardian';
import { suggestSavings } from './guardian';
import { previewOps } from './preview';
import { itemFromRate, tierForCity } from './pricing';

export interface UpgradeProposal {
  verdict: 'fits' | 'needs_funding' | 'cannot_fund';
  upgradeOps: PlanPatchOp[];
  cost: Money;
  shortfall: Money;
  fundingOptions: SavingsPlan[];
  recommendedId?: string;
  message: string;
}

interface PreparedUpgrade {
  rate: RateEntry;
  ops: PlanPatchOp[];
}

function prepareUpgrade(
  plan: EventPlan,
  upgrade: { family: string; toQuality: QualityLevel },
): PreparedUpgrade | string {
  const item = plan.budgetItems.find((i) => i.rateKey?.startsWith(`${upgrade.family}.`));
  if (!item || item.locked) {
    const label = item ? item.label : upgrade.family;
    return `${label} ${item?.locked ? 'is locked' : 'was not found'} and cannot be upgraded.`;
  }

  const nextRate = getRate(upgrade.family, upgrade.toQuality);
  if (!nextRate) {
    return `Rate card for ${upgrade.family} at ${upgrade.toQuality} not found.`;
  }

  const tier = tierForCity(plan.meta.city);
  const template = getTemplate(plan.meta.type);
  const mult = template.categoryMultipliers?.[nextRate.category] ?? 1;
  const repriced = itemFromRate(nextRate, {
    guestCount: plan.meta.guestCount,
    tier,
    categoryMultiplier: mult,
  });

  const ops: PlanPatchOp[] = [
    {
      type: 'update_budget_item',
      id: item.id,
      changes: {
        unitCost: repriced.unitCost,
        rateKey: repriced.rateKey,
        label: nextRate.label,
      },
    },
  ];

  return { rate: nextRate, ops };
}

function resolveFundingVerdict(
  cost: Money,
  shortfall: Money,
  upgradeOps: PlanPatchOp[],
  fundingOptions: SavingsPlan[],
  rate: RateEntry,
  toQuality: QualityLevel,
): UpgradeProposal {
  const viable = fundingOptions.filter((sp) => sp.met);

  if (viable.length > 0) {
    return {
      verdict: 'needs_funding',
      upgradeOps,
      cost,
      shortfall,
      fundingOptions,
      recommendedId: viable[0]?.id,
      message: `Upgrading to ${toQuality} ${rate.label} costs ${formatInr(cost)}, exceeding cap by ${formatInr(shortfall)}. Available savings plans can fund it.`,
    };
  }

  return {
    verdict: 'cannot_fund',
    upgradeOps,
    cost,
    shortfall,
    fundingOptions,
    message: `Upgrading to ${toQuality} ${rate.label} costs ${formatInr(cost)} (${formatInr(shortfall)} over cap). Even stepping down all other flexible items cannot fund this upgrade without breaking budget constraints.`,
  };
}

/**
 * Formulates an upgrade proposal and identifies funding options when budget caps are exceeded.
 * WHY: "AI that knows when to say no": transparently reports when an upgrade cannot be funded.
 */
export function fundUpgrade(
  plan: EventPlan,
  upgrade: { family: string; toQuality: QualityLevel },
  ctx: EngineContext,
  options?: { protectedFamilies?: string[] },
): UpgradeProposal {
  const prep = prepareUpgrade(plan, upgrade);
  if (typeof prep === 'string') {
    return {
      verdict: 'cannot_fund',
      upgradeOps: [],
      cost: 0,
      shortfall: 0,
      fundingOptions: [],
      message: prep,
    };
  }

  const { rate, ops: upgradeOps } = prep;
  const preview = previewOps(plan, upgradeOps, ctx);
  if (!preview.ok) {
    return {
      verdict: 'cannot_fund',
      upgradeOps: [],
      cost: 0,
      shortfall: 0,
      fundingOptions: [],
      message: preview.error.message,
    };
  }

  const currentTotal = budgetTotal(plan.budgetItems, plan.meta.guestCount);
  const upgradedTotal = preview.value.impact.budgetTotalAfter;
  const cost = Math.max(0, upgradedTotal - currentTotal);
  const cap = getBudgetCap(plan.constraints);

  if (cap === null || upgradedTotal <= cap) {
    return {
      verdict: 'fits',
      upgradeOps,
      cost,
      shortfall: 0,
      fundingOptions: [],
      message: `Upgrade to ${upgrade.toQuality} ${rate.label} costs ${formatInr(cost)} and fits within your budget.`,
    };
  }

  const shortfall = upgradedTotal - cap;
  const protectedFamilies = [...(options?.protectedFamilies ?? []), upgrade.family];
  const rawPlans = suggestSavings(
    preview.value.plan,
    shortfall,
    { protectedFamilies },
    ctx,
  );
  const fundingOptions: SavingsPlan[] = rawPlans.map((sp) => ({
    ...sp,
    ops: [...upgradeOps, ...sp.ops],
  }));

  return resolveFundingVerdict(
    cost,
    shortfall,
    upgradeOps,
    fundingOptions,
    rate,
    upgrade.toQuality,
  );
}
