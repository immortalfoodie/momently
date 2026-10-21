import { getRate } from '@/data/rateCards';
import type { QualityLevel } from '@/data/rateCards.schema';
import { getTemplate } from '@/data/templates';
import type { BudgetItem, EventPlan, Money } from '@/domain/types';
import { itemTotal } from './budget';
import { itemFromRate, tierForCity } from './pricing';

export function qualityOfItem(item: BudgetItem): QualityLevel | undefined {
  if (!item.rateKey) return undefined;
  const parts = item.rateKey.split('.');
  const quality = parts[parts.length - 1];
  if (quality === 'essential' || quality === 'standard' || quality === 'premium') {
    return quality;
  }
  return undefined;
}

const NEXT_LOWER: Record<QualityLevel, QualityLevel | null> = {
  premium: 'standard',
  standard: 'essential',
  essential: null,
};

const NEXT_HIGHER: Record<QualityLevel, QualityLevel | null> = {
  essential: 'standard',
  standard: 'premium',
  premium: null,
};

function getTargetQuality(
  item: BudgetItem,
  direction: 'down' | 'up',
): QualityLevel | undefined {
  const currentQ = qualityOfItem(item);
  if (!currentQ) return undefined;
  const target = direction === 'down' ? NEXT_LOWER[currentQ] : NEXT_HIGHER[currentQ];
  return target ?? undefined;
}

/**
 * Directly reprices an unlocked estimate budget item to a target quality tier.
 * WHY: Powers direct concept quality profile assignments and single-shot quality overrides.
 *
 * @param plan - Baseline event plan.
 * @param item - Budget item to reprice.
 * @param targetQuality - Target quality level ('essential' | 'standard' | 'premium').
 * @returns Changed properties and new total, or undefined if item cannot be repriced.
 */
export function setItemQuality(
  plan: EventPlan,
  item: BudgetItem,
  targetQuality: QualityLevel,
):
  | { changes: { unitCost: Money; rateKey: string; label: string }; newTotal: Money }
  | undefined {
  if (item.locked || item.provenance !== 'estimate' || !item.rateKey) {
    return undefined;
  }

  const family = item.rateKey.split('.')[0];
  if (!family) return undefined;

  const nextRate = getRate(family, targetQuality);
  if (!nextRate) return undefined;

  const tier = tierForCity(plan.meta.city);
  const template = getTemplate(plan.meta.type);
  const categoryMultiplier = template.categoryMultipliers?.[nextRate.category] ?? 1;

  const repriced = itemFromRate(nextRate, {
    guestCount: plan.meta.guestCount,
    tier,
    categoryMultiplier,
  });

  const changes = {
    unitCost: repriced.unitCost,
    rateKey: repriced.rateKey ?? `${family}.${targetQuality}`,
    label: nextRate.label,
  };

  const newTotal = itemTotal({ ...item, ...changes }, plan.meta.guestCount);
  return { changes, newTotal };
}

/**
 * Steps an unlocked item's quality one tier up or down.
 * WHY: Reuses setItemQuality for stepwise adjustments.
 */
export function stepItemQuality(
  plan: EventPlan,
  item: BudgetItem,
  direction: 'down' | 'up',
):
  | { changes: { unitCost: Money; rateKey: string; label: string }; newTotal: Money }
  | undefined {
  const targetQ = getTargetQuality(item, direction);
  if (!targetQ) return undefined;
  return setItemQuality(plan, item, targetQ);
}
