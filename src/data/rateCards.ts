/**
 * TRANSPARENT RATE CARDS FOR INDIAN METROS (TIER 1)
 *
 * NOTE: These figures are baseline statistical estimates reflecting prevailing median costs
 * in Indian Tier 1 metropolitan areas (Mumbai, Delhi, Bengaluru, etc.). They are NOT vendor
 * quotes or binding contracts. Actual market quotes will vary based on dates, seasons, and negotiation.
 */

import type { BudgetCategory } from '@/domain/types';
import {
  CITY_TIER_MULTIPLIERS,
  type GuestBand,
  type QualityLevel,
  type RateEntry,
  rateEntrySchema,
} from './rateCards.schema';

export { CITY_TIER_MULTIPLIERS };

function createBands(anchor100: number): GuestBand[] {
  return [
    { maxGuests: 50, cost: Math.round(anchor100 * 0.7) },
    { maxGuests: 100, cost: anchor100 },
    { maxGuests: 150, cost: Math.round(anchor100 * 1.35) },
    { maxGuests: 250, cost: Math.round(anchor100 * 1.75) },
    { maxGuests: 500, cost: Math.round(anchor100 * 2.5) },
    { maxGuests: null, cost: Math.round(anchor100 * 3.5) },
  ];
}

interface FlatFamilyConfig {
  family: string;
  category: BudgetCategory;
  label: string;
  costs: Record<QualityLevel, number>;
}

interface PerGuestFamilyConfig {
  family: string;
  category: BudgetCategory;
  label: string;
  costs: Record<QualityLevel, number>;
}

const FLAT_FAMILIES: FlatFamilyConfig[] = [
  {
    family: 'venue_hall',
    category: 'venue',
    label: 'Banquet Hall / Event Space',
    costs: { essential: 20000, standard: 30000, premium: 55000 },
  },
  {
    family: 'decor_theme',
    category: 'decor',
    label: 'Theme Decor & Florals',
    costs: { essential: 8000, standard: 15000, premium: 30000 },
  },
  {
    family: 'photo_video',
    category: 'photography',
    label: 'Photography & Videography',
    costs: { essential: 8000, standard: 15000, premium: 30000 },
  },
  {
    family: 'entertainment_music',
    category: 'entertainment',
    label: 'Live Music / DJ Setup',
    costs: { essential: 5000, standard: 12000, premium: 25000 },
  },
  {
    family: 'sound_stage',
    category: 'entertainment',
    label: 'Sound System & Stage Lighting',
    costs: { essential: 6000, standard: 12000, premium: 22000 },
  },
  {
    family: 'transport_guest',
    category: 'transport',
    label: 'Guest Shuttles & Logistics',
    costs: { essential: 2000, standard: 4000, premium: 8000 },
  },
  {
    family: 'invitations_stationery',
    category: 'other',
    label: 'Digital & Physical Invitations',
    costs: { essential: 1000, standard: 3000, premium: 8000 },
  },
  {
    family: 'permits_licences',
    category: 'other',
    label: 'Municipal & Music Licenses',
    costs: { essential: 3000, standard: 5000, premium: 8000 },
  },
  {
    family: 'volunteer_kit',
    category: 'other',
    label: 'Safety, Badges & Volunteer Gear',
    costs: { essential: 4000, standard: 8000, premium: 15000 },
  },
];

const PER_GUEST_FAMILIES: PerGuestFamilyConfig[] = [
  {
    family: 'catering_buffet',
    category: 'food',
    label: 'Full Buffet Catering',
    costs: { essential: 600, standard: 900, premium: 1400 },
  },
  {
    family: 'catering_snacks',
    category: 'food',
    label: 'Snacks & Hi-Tea Service',
    costs: { essential: 80, standard: 120, premium: 200 },
  },
  {
    family: 'gifts_favours',
    category: 'gifts',
    label: 'Return Gifts & Keepsakes',
    costs: { essential: 50, standard: 100, premium: 200 },
  },
];

const QUALITIES: QualityLevel[] = ['essential', 'standard', 'premium'];

function buildRateCards(): RateEntry[] {
  const cards: RateEntry[] = [];

  for (const config of FLAT_FAMILIES) {
    for (const quality of QUALITIES) {
      const entry = rateEntrySchema.parse({
        key: `${config.family}.${quality}`,
        family: config.family,
        category: config.category,
        label: `${config.label} (${quality})`,
        quality,
        basis: 'flat',
        bands: createBands(config.costs[quality]),
      });
      cards.push(entry);
    }
  }

  for (const config of PER_GUEST_FAMILIES) {
    for (const quality of QUALITIES) {
      const entry = rateEntrySchema.parse({
        key: `${config.family}.${quality}`,
        family: config.family,
        category: config.category,
        label: `${config.label} (${quality})`,
        quality,
        basis: 'per_guest',
        perGuestCost: config.costs[quality],
      });
      cards.push(entry);
    }
  }

  return cards;
}

/**
 * Validated library of standard rates across all services and quality tiers.
 * WHY: Serves as the immutable empirical foundation for budget calculations.
 */
export const RATE_CARDS: RateEntry[] = buildRateCards();

const RATE_CARD_MAP = new Map<string, RateEntry>(
  RATE_CARDS.map((entry) => [entry.key, entry]),
);

/**
 * Retrieves a rate card entry by family name and quality tier.
 * WHY: Used by estimation engines to price or reprice line items during tier adjustments.
 *
 * @param family - The rate card service family (e.g., 'venue_hall').
 * @param quality - The target quality tier ('essential' | 'standard' | 'premium').
 * @returns The matching RateEntry, or undefined if not found.
 */
export function getRate(family: string, quality: QualityLevel): RateEntry | undefined {
  return RATE_CARD_MAP.get(`${family}.${quality}`);
}

/**
 * Returns a deduplicated list of all available service families.
 * WHY: Used by templates and constraint solvers to discover plannable event components.
 *
 * @returns An array of unique family identifier strings.
 */
export function listFamilies(): string[] {
  return Array.from(new Set(RATE_CARDS.map((entry) => entry.family)));
}

/**
 * Finds a rate card entry matching an exact compound key.
 * WHY: Fast lookup for budget items storing their originating rate key (e.g. 'venue_hall.standard').
 *
 * @param key - Compound key formatted as `${family}.${quality}`.
 * @returns The matching RateEntry, or undefined if not found.
 */
export function getRateByKey(key: string): RateEntry | undefined {
  return RATE_CARD_MAP.get(key);
}
