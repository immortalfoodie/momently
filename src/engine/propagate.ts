import { getRateByKey } from '@/data/rateCards';
import type { RateEntry } from '@/data/rateCards.schema';
import { getTemplate, type EventTemplate } from '@/data/templates';
import type { CityTier } from '@/domain/constants';
import type { BudgetItem, EventPlan } from '@/domain/types';
import { formatInr } from '@/lib/format';
import { contingencyPercent, itemTotal, refreshContingency } from './budget';
import { itemFromRate, tierForCity } from './pricing';

export interface ReestimateResult {
  items: BudgetItem[];
  notes: string[];
}

interface ReestimateContext {
  oldGuestCount: number;
  newGuestCount: number;
  tier: CityTier;
  template: EventTemplate;
  notes: string[];
}

function checkVenueBandChange(
  rateEntry: RateEntry,
  oldGuestCount: number,
  newGuestCount: number,
): string | null {
  if (rateEntry.basis !== 'flat') {
    return null;
  }
  const oldBandIndex = rateEntry.bands.findIndex(
    (b) => b.maxGuests === null || b.maxGuests >= oldGuestCount,
  );
  const newBandIndex = rateEntry.bands.findIndex(
    (b) => b.maxGuests === null || b.maxGuests >= newGuestCount,
  );

  if (oldBandIndex === newBandIndex) {
    return null;
  }

  const newMax = rateEntry.bands[newBandIndex]?.maxGuests;
  const capacityLabel = newMax ? `up to ${newMax}` : '500+';
  return `Guest count change from ${oldGuestCount} to ${newGuestCount} crosses venue capacity bracket (${capacityLabel} guests).`;
}

function repriceEstimatedItem(
  item: BudgetItem,
  rateEntry: RateEntry,
  ctx: ReestimateContext,
): BudgetItem {
  if (item.category === 'venue') {
    const venueNote = checkVenueBandChange(
      rateEntry,
      ctx.oldGuestCount,
      ctx.newGuestCount,
    );
    if (venueNote) {
      ctx.notes.push(venueNote);
    }
  }

  const categoryMultiplier = ctx.template.categoryMultipliers?.[rateEntry.category] ?? 1;

  const repriced = itemFromRate(rateEntry, {
    guestCount: ctx.newGuestCount,
    tier: ctx.tier,
    categoryMultiplier,
  });

  return {
    ...item,
    ...repriced,
    id: item.id,
    label: item.label,
    note: item.note,
  };
}

function reestimateSingleItem(item: BudgetItem, ctx: ReestimateContext): BudgetItem {
  if (item.category === 'contingency' && !item.locked) {
    return item;
  }

  if (item.locked || item.provenance !== 'estimate') {
    const currentCost = itemTotal(item, ctx.oldGuestCount);
    ctx.notes.push(
      `${item.label} is locked at ${formatInr(currentCost)}; confirm it can seat ${ctx.newGuestCount} guests.`,
    );
    return item;
  }

  if (!item.rateKey) {
    return item;
  }

  const rateEntry = getRateByKey(item.rateKey);
  if (!rateEntry) {
    ctx.notes.push(
      `Unknown rate key '${item.rateKey}' on ${item.label}; kept existing pricing.`,
    );
    return item;
  }

  return repriceEstimatedItem(item, rateEntry, ctx);
}

/**
 * Re-evaluates plan budget items when guest attendance changes, preserving host locks and provenances.
 * WHY: As guest counts fluctuate, per-guest catering and stepped venue tiers dynamically shift,
 * while custom user quotes and locked items must remain firmly untouched.
 *
 * @param plan - Current EventPlan with existing budget items and metadata.
 * @param newGuestCount - The revised guest headcount.
 * @returns Updated array of budget items along with human-readable audit notes.
 */
export function reestimateForGuestCount(
  plan: EventPlan,
  newGuestCount: number,
): ReestimateResult {
  const notes: string[] = [];
  const tier = tierForCity(plan.meta.city);
  const template = getTemplate(plan.meta.type);
  const oldGuestCount = plan.meta.guestCount;

  const ctx: ReestimateContext = {
    oldGuestCount,
    newGuestCount,
    tier,
    template,
    notes,
  };

  const updatedItems = plan.budgetItems.map((item) => reestimateSingleItem(item, ctx));

  const pct = contingencyPercent(plan.meta.type, plan.meta.setting);
  const items = refreshContingency(updatedItems, newGuestCount, pct);

  return { items, notes };
}
