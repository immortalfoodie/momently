import type { GuestNeeds } from '@/domain/types';

/** Standard seating capacity per banquet table across Indian event venues. */
export const SEATS_PER_TABLE = 8;

/** Average household size assumption in Indian urban families for invitation clustering. */
export const HOUSEHOLD_SIZE_ASSUMPTION = 3;

export interface MealBreakdown {
  vegetarian: number;
  jain: number;
  vegan: number;
  glutenFree: number;
  other: number;
}

export interface GuestMetrics {
  seatsPerTable: number;
  tables: number;
  servings: number;
  households: number;
  mealBreakdown: MealBreakdown;
  accessibilityFlags: string[];
}

/**
 * Derives operational catering and seating metrics from total guest headcount and aggregate needs.
 * WHY: Caterers and venue managers need derived metrics (portions, tables, dietary segregations)
 * rather than raw headcount to provision buffers and layout floorplans.
 *
 * @param guestCount - Total confirmed or estimated guest attendance.
 * @param guestNeeds - Optional aggregate guest requirements (dietary and accessibility).
 * @returns Complete operational guest metrics for catering, layout, and logistics.
 */
function extractAccessibilityFlags(needs?: GuestNeeds): string[] {
  if (!needs) {
    return [];
  }
  const rules = [
    {
      active: needs.wheelchairUsers > 0,
      label: `${needs.wheelchairUsers} Wheelchair access required`,
    },
    {
      active: needs.elderly > 0,
      label: `${needs.elderly} Senior citizens needing ground-floor seating`,
    },
    {
      active: needs.children > 0,
      label: `${needs.children} Children needing child-safe seating`,
    },
    {
      active: Boolean(needs.quietSpaceNeeded),
      label: 'Quiet retreat space required',
    },
    {
      active: needs.allergyAlerts > 0,
      label: `${needs.allergyAlerts} Severe allergy protocols required`,
    },
  ];
  return rules.filter((r) => r.active).map((r) => r.label);
}

/**
 * Derives operational catering and seating metrics from total guest headcount and aggregate needs.
 * WHY: Caterers and venue managers need derived metrics (portions, tables, dietary segregations)
 * rather than raw headcount to provision buffers and layout floorplans.
 *
 * @param guestCount - Total confirmed or estimated guest attendance.
 * @param guestNeeds - Optional aggregate guest requirements (dietary and accessibility).
 * @returns Complete operational guest metrics for catering, layout, and logistics.
 */
export function deriveGuestMetrics(
  guestCount: number,
  guestNeeds?: GuestNeeds,
): GuestMetrics {
  const tables = Math.ceil(guestCount / SEATS_PER_TABLE);
  const servings = Math.ceil(guestCount * 1.05);
  const households = Math.ceil(guestCount / HOUSEHOLD_SIZE_ASSUMPTION);

  const vegetarian = guestNeeds?.vegetarian ?? 0;
  const jain = guestNeeds?.jain ?? 0;
  const vegan = guestNeeds?.vegan ?? 0;
  const glutenFree = guestNeeds?.glutenFree ?? 0;

  const accountedDietary = vegetarian + jain + vegan + glutenFree;
  const otherMeals = Math.max(0, guestCount - accountedDietary);

  return {
    seatsPerTable: SEATS_PER_TABLE,
    tables,
    servings,
    households,
    mealBreakdown: {
      vegetarian,
      jain,
      vegan,
      glutenFree,
      other: otherMeals,
    },
    accessibilityFlags: extractAccessibilityFlags(guestNeeds),
  };
}
