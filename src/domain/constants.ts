/**
 * Supported celebration and event types with user-facing display labels.
 * WHY: Provides deterministic categorization for templates and planning rules.
 */
export const EVENT_TYPES = [
  { id: 'wedding', label: 'Wedding' },
  { id: 'birthday', label: 'Birthday Party' },
  { id: 'anniversary', label: 'Anniversary Celebration' },
  { id: 'community', label: 'Community Event' },
] as const;

export const EVENT_TYPE_IDS = [
  'wedding',
  'birthday',
  'anniversary',
  'community',
] as const;

/**
 * Standard budget categories covering all celebration aspects.
 * WHY: Enforces consistent financial categorization across rate cards, plans, and patches.
 */
export const BUDGET_CATEGORIES = [
  { id: 'venue', label: 'Venue & Infrastructure' },
  { id: 'food', label: 'Food & Catering' },
  { id: 'decor', label: 'Decor & Ambience' },
  { id: 'photography', label: 'Photography & Videography' },
  { id: 'entertainment', label: 'Music & Entertainment' },
  { id: 'transport', label: 'Travel & Transport' },
  { id: 'gifts', label: 'Gifts & Favors' },
  { id: 'contingency', label: 'Contingency Fund' },
  { id: 'other', label: 'Other Services' },
] as const;

export const BUDGET_CATEGORY_IDS = [
  'venue',
  'food',
  'decor',
  'photography',
  'entertainment',
  'transport',
  'gifts',
  'contingency',
  'other',
] as const;

/**
 * Classification of Indian economic tiers for regional pricing calculation.
 * WHY: Vendor and venue costs vary dramatically by geographic city tier.
 */
export const CITY_TIERS = ['tier1', 'tier2', 'tier3'] as const;

export type CityTier = (typeof CITY_TIERS)[number];

/**
 * Function-free mapping of major Indian cities to their economic tier.
 * WHY: Enables fast, deterministic cost index lookup without external API calls or I/O.
 */
export const KNOWN_CITY_TIERS: Readonly<Record<string, CityTier>> = {
  Mumbai: 'tier1',
  Delhi: 'tier1',
  Bengaluru: 'tier1',
  Hyderabad: 'tier1',
  Chennai: 'tier1',
  Kolkata: 'tier1',
  Pune: 'tier1',
  Ahmedabad: 'tier1',
  Jaipur: 'tier2',
  Lucknow: 'tier2',
  Indore: 'tier2',
  Nagpur: 'tier2',
  Surat: 'tier2',
  Chandigarh: 'tier2',
  Kochi: 'tier2',
};

/**
 * Schedule slot urgency levels for run-of-show sequencing.
 * WHY: Essential items cannot be truncated or dropped when schedules tighten.
 */
export const SCHEDULE_PRIORITIES = ['essential', 'important', 'optional'] as const;
