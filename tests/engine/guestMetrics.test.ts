import { describe, expect, it } from 'vitest';
import type { GuestNeeds } from '@/domain/types';
import {
  deriveGuestMetrics,
  HOUSEHOLD_SIZE_ASSUMPTION,
  SEATS_PER_TABLE,
} from '@/engine/guestMetrics';

describe('Guest Metrics Engine', () => {
  it('calculates tables, buffer servings, and estimated households', () => {
    const metrics = deriveGuestMetrics(80);
    expect(metrics.seatsPerTable).toBe(SEATS_PER_TABLE);
    expect(metrics.tables).toBe(10);
    expect(metrics.servings).toBe(84);
    expect(metrics.households).toBe(Math.ceil(80 / HOUSEHOLD_SIZE_ASSUMPTION));
  });

  it('guarantees mealBreakdown.other is never negative even if dietary counts exceed guestCount', () => {
    const overflowNeeds: GuestNeeds = {
      vegetarian: 60,
      jain: 30,
      vegan: 10,
      glutenFree: 5,
      allergyAlerts: 0,
      wheelchairUsers: 0,
      elderly: 0,
      children: 0,
      quietSpaceNeeded: false,
      languages: [],
    };

    const metrics = deriveGuestMetrics(80, overflowNeeds);
    expect(metrics.mealBreakdown.vegetarian).toBe(60);
    expect(metrics.mealBreakdown.jain).toBe(30);
    expect(metrics.mealBreakdown.vegan).toBe(10);
    expect(metrics.mealBreakdown.glutenFree).toBe(5);
    expect(metrics.mealBreakdown.other).toBe(0);
    expect(metrics.mealBreakdown.other).toBeGreaterThanOrEqual(0);
  });

  it('correctly calculates other meals when dietary counts are less than guestCount', () => {
    const standardNeeds: GuestNeeds = {
      vegetarian: 40,
      jain: 10,
      vegan: 0,
      glutenFree: 0,
      allergyAlerts: 1,
      wheelchairUsers: 2,
      elderly: 4,
      children: 8,
      quietSpaceNeeded: true,
      languages: ['English'],
    };

    const metrics = deriveGuestMetrics(80, standardNeeds);
    expect(metrics.mealBreakdown.other).toBe(30);
    expect(metrics.accessibilityFlags.length).toBeGreaterThan(0);
    expect(metrics.accessibilityFlags.some((f) => f.includes('Wheelchair'))).toBe(true);
    expect(metrics.accessibilityFlags.some((f) => f.includes('Quiet retreat'))).toBe(
      true,
    );
  });
});
