import { KNOWN_CITY_TIERS, type CityTier } from '@/domain/constants';
import type { BudgetItem, Money } from '@/domain/types';
import { CITY_TIER_MULTIPLIERS, type RateEntry } from '@/data/rateCards';

/**
 * Resolves the economic tier for an Indian city name.
 * WHY: City tiers determine baseline supplier and venue cost indexes.
 *
 * @param city - The raw city name input by the user.
 * @returns The matched CityTier or defaults to 'tier2' for uncataloged municipalities.
 */
export function tierForCity(city: string): CityTier {
  const normalized = city.trim().toLowerCase();

  for (const [knownCity, tier] of Object.entries(KNOWN_CITY_TIERS)) {
    if (knownCity.toLowerCase() === normalized) {
      return tier;
    }
  }

  return 'tier2';
}

export interface PricingContext {
  guestCount: number;
  tier: CityTier;
  categoryMultiplier?: number;
}

/**
 * Calculates the total estimated cost for a rate card entry based on guest count and regional multipliers.
 * WHY: Computes deterministic baseline item expenditure for budgeting.
 *
 * @param entry - Rate card entry (flat or per-guest).
 * @param context - Parameters including guest count, city tier, and optional event category scaling.
 * @returns Non-negative integer INR rupee amount.
 */
export function priceRate(entry: RateEntry, context: PricingContext): Money {
  const tierMultiplier = CITY_TIER_MULTIPLIERS[context.tier];
  const categoryMultiplier = context.categoryMultiplier ?? 1;

  if (entry.basis === 'per_guest') {
    const rawTotal =
      entry.perGuestCost * context.guestCount * tierMultiplier * categoryMultiplier;
    return Math.round(rawTotal);
  }

  const matchingBand = entry.bands.find(
    (band) => band.maxGuests === null || band.maxGuests >= context.guestCount,
  );
  const baseCost = matchingBand?.cost ?? 0;
  return Math.round(baseCost * tierMultiplier * categoryMultiplier);
}

/**
 * Constructs a BudgetItem template from a rate card entry without assigning an ID.
 * WHY: Standardizes creation of estimate budget items with uniform semantics and rate-card traceability.
 *
 * @param entry - The source RateEntry.
 * @param context - Pricing context for regional and capacity calculations.
 * @returns BudgetItem payload ready for ID assignment.
 */
export function itemFromRate(
  entry: RateEntry,
  context: PricingContext,
): Omit<BudgetItem, 'id'> {
  const tierMultiplier = CITY_TIER_MULTIPLIERS[context.tier];
  const categoryMultiplier = context.categoryMultiplier ?? 1;

  if (entry.basis === 'per_guest') {
    const perGuestUnitCost = Math.round(
      entry.perGuestCost * tierMultiplier * categoryMultiplier,
    );
    return {
      category: entry.category,
      label: entry.label,
      basis: 'per_guest',
      unitCost: perGuestUnitCost,
      quantity: 1,
      provenance: 'estimate',
      locked: false,
      rateKey: entry.key,
    };
  }

  const flatCost = priceRate(entry, context);
  return {
    category: entry.category,
    label: entry.label,
    basis: 'flat',
    unitCost: flatCost,
    quantity: 1,
    provenance: 'estimate',
    locked: false,
    rateKey: entry.key,
  };
}
