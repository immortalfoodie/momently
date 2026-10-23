import type { EventPlan } from '@/domain/types';
import {
  deriveGuestMetrics,
  HOUSEHOLD_SIZE_ASSUMPTION,
  SEATS_PER_TABLE,
} from '@/engine/guestMetrics';

export interface OrderQuantityRow {
  label: string;
  value: string;
  how: string;
}

/**
 * Derives practical catering, seating, stationery, and gifting order quantities from the plan.
 * WHY: Gives hosts a ready-to-share quantity checklist with transparent calculation formulas
 * for caterers, decorators, and printers.
 *
 * @param plan - Active EventPlan.
 * @returns Array of OrderQuantityRow entries explaining each quantity and how it was calculated.
 */
export function orderQuantities(plan: EventPlan): OrderQuantityRow[] {
  const guestCount = plan.meta.guestCount;
  const metrics = deriveGuestMetrics(guestCount, plan.guestNeeds);
  const rows: OrderQuantityRow[] = [
    {
      label: 'Food servings',
      value: `${metrics.servings} servings`,
      how: `${guestCount} guests + 5% catering buffer, rounded up`,
    },
    {
      label: 'Tables of 8',
      value: `${metrics.tables} tables`,
      how: `${guestCount} guests at ${SEATS_PER_TABLE} seats per table, rounded up`,
    },
  ];

  const hasGiftsItem = plan.budgetItems.some((item) => item.category === 'gifts');
  if (hasGiftsItem) {
    rows.push({
      label: 'Favours / return gifts',
      value: `${guestCount} favours`,
      how: `1 favour per guest (${guestCount} guests; gifts included in budget)`,
    });
  }

  rows.push({
    label: 'Invitations (households)',
    value: `${metrics.households} invitations`,
    how: `Assumption of ${HOUSEHOLD_SIZE_ASSUMPTION} guests per household for ${guestCount} guests`,
  });

  const { vegetarian, jain, vegan, glutenFree, other } = metrics.mealBreakdown;
  const dietaryLines: Array<{ label: string; count: number; how: string }> = [
    {
      label: 'Vegetarian meals',
      count: vegetarian,
      how: `Entered guest count (${vegetarian} of ${guestCount} guests)`,
    },
    {
      label: 'Jain meals',
      count: jain,
      how: `Entered guest count (${jain} of ${guestCount} guests)`,
    },
    {
      label: 'Vegan meals',
      count: vegan,
      how: `Entered guest count (${vegan} of ${guestCount} guests)`,
    },
    {
      label: 'Gluten-free meals',
      count: glutenFree,
      how: `Entered guest count (${glutenFree} of ${guestCount} guests)`,
    },
    {
      label: 'Standard / other meals',
      count: other,
      how: `${guestCount} total guests minus ${vegetarian + jain + vegan + glutenFree} specific dietary counts`,
    },
  ];

  for (const line of dietaryLines) {
    if (line.count > 0) {
      rows.push({
        label: line.label,
        value: `${line.count} meals`,
        how: line.how,
      });
    }
  }

  return rows;
}

/**
 * Formats order quantity rows as clean plain text for copying into messages or emails.
 */
export function orderQuantitiesToText(rows: readonly OrderQuantityRow[]): string {
  return rows.map((row) => `${row.label}: ${row.value} (${row.how})`).join('\n');
}
