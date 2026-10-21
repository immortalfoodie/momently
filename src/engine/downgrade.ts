import { getRate } from '@/data/rateCards';
import type { QualityLevel } from '@/data/rateCards.schema';
import type { CityTier } from '@/domain/constants';
import type { BudgetItem, Money } from '@/domain/types';
import { budgetTotal, refreshContingency } from './budget';
import { itemFromRate } from './pricing';

export interface DowngradeRecord {
  family: string;
  from: QualityLevel;
  to: QualityLevel;
}

const NEXT_LOWER: Record<QualityLevel, QualityLevel | null> = {
  premium: 'standard',
  standard: 'essential',
  essential: null,
};

function selectFamilyToDowngrade(
  order: readonly string[],
  qualities: Map<string, QualityLevel>,
  required: Set<string>,
): string | null {
  const isEligible = (f: string) => {
    const q = qualities.get(f);
    return q ? NEXT_LOWER[q] !== null : false;
  };
  return (
    order.find((f) => !required.has(f) && isEligible(f)) ?? order.find(isEligible) ?? null
  );
}

function stepDowngradeOneFamily(
  family: string,
  qualities: Map<string, QualityLevel>,
  items: BudgetItem[],
  ctx: {
    guestCount: number;
    tier: CityTier;
    categoryMultipliers?: Record<string, number>;
  },
): { items: BudgetItem[]; downgrade: DowngradeRecord } | null {
  const fromQuality = qualities.get(family);
  if (!fromQuality) return null;
  const toQuality = NEXT_LOWER[fromQuality];
  if (!toQuality) return null;

  const rateEntry = getRate(family, toQuality);
  if (!rateEntry) return null;

  qualities.set(family, toQuality);
  const mult = ctx.categoryMultipliers?.[rateEntry.category] ?? 1;
  const repriced = itemFromRate(rateEntry, {
    guestCount: ctx.guestCount,
    tier: ctx.tier,
    categoryMultiplier: mult,
  });

  const nextItems = items.map((item) =>
    item.rateKey?.startsWith(`${family}.`) ? { ...item, ...repriced, id: item.id } : item,
  );

  return { items: nextItems, downgrade: { family, from: fromQuality, to: toQuality } };
}

/**
 * Iteratively downgrades non-required budget items along the template downgrade order until fitting within budget cap.
 * WHY: Automates quality adjustments while protecting non-negotiable items whenever a host defines a budget limit.
 *
 * @param baseItems - Initial budget items at starting quality level.
 * @param downgradeOrder - Ordered list of rate card families to downgrade first.
 * @param requiredFamilies - Set of essential item families that cannot be stepped down until other items are exhausted.
 * @param initialQuality - Starting quality level.
 * @param ctx - Optimization context with guest count, tier, multipliers, and cap.
 * @returns Optimization result with adjusted budget items, audit trail of downgrades, and fit status.
 */
export function optimizeBudgetToCap(
  baseItems: BudgetItem[],
  downgradeOrder: readonly string[],
  requiredFamilies: Set<string>,
  initialQuality: QualityLevel,
  ctx: {
    guestCount: number;
    tier: CityTier;
    categoryMultipliers?: Record<string, number>;
    contingencyPct: number;
    cap: Money;
  },
): { items: BudgetItem[]; downgrades: DowngradeRecord[]; fits: boolean } {
  let items = refreshContingency(baseItems, ctx.guestCount, ctx.contingencyPct);
  const downgrades: DowngradeRecord[] = [];
  const qualities = new Map<string, QualityLevel>();

  for (const item of items) {
    const family = item.rateKey?.split('.')[0];
    if (family) qualities.set(family, initialQuality);
  }

  while (budgetTotal(items, ctx.guestCount) > ctx.cap) {
    const family = selectFamilyToDowngrade(downgradeOrder, qualities, requiredFamilies);
    if (!family) break;

    const step = stepDowngradeOneFamily(family, qualities, items, ctx);
    if (!step) break;

    downgrades.push(step.downgrade);
    items = refreshContingency(step.items, ctx.guestCount, ctx.contingencyPct);
  }

  return { items, downgrades, fits: budgetTotal(items, ctx.guestCount) <= ctx.cap };
}
