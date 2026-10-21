import { describe, expect, it } from 'vitest';
import { DEMO_SCENARIO } from '@/data/demoScenario';
import type { EventPlan } from '@/domain/types';
import { findForgottenCosts } from '@/engine/forgottenCosts';
import { createPlan } from '@/engine/planFactory';
import { createIdFactory } from '@/lib/id';

describe('Forgotten Costs Engine', () => {
  const fixedClock = () => new Date('2026-10-21T12:00:00.000Z');

  function makeBaseline(): EventPlan {
    const ids = createIdFactory('fc_seed');
    return createPlan({
      meta: DEMO_SCENARIO.meta,
      constraints: DEMO_SCENARIO.constraints,
      ids,
      clock: fixedClock,
    }).plan;
  }

  it('triggers tips reminder unconditionally', () => {
    const plan = makeBaseline();
    const reminders = findForgottenCosts(plan);
    expect(reminders.some((r) => r.id === 'fc_staff_tips')).toBe(true);
  });

  it('triggers weather cover only when setting is outdoor/mixed and no weather cover exists', () => {
    const base = makeBaseline();

    // Indoor -> no weather cover reminder
    const indoorPlan: EventPlan = { ...base, meta: { ...base.meta, setting: 'indoor' } };
    expect(findForgottenCosts(indoorPlan).some((r) => r.id === 'fc_weather_cover')).toBe(
      false,
    );

    // Outdoor without cover -> reminder triggers
    const outdoorPlan: EventPlan = {
      ...base,
      meta: { ...base.meta, setting: 'outdoor' },
    };
    expect(findForgottenCosts(outdoorPlan).some((r) => r.id === 'fc_weather_cover')).toBe(
      true,
    );

    // Outdoor with weather_cover item -> reminder does not trigger
    const coveredPlan: EventPlan = {
      ...outdoorPlan,
      budgetItems: [
        ...outdoorPlan.budgetItems,
        {
          id: 'item_cover',
          category: 'venue',
          label: 'Weather cover',
          basis: 'flat',
          unitCost: 16000,
          quantity: 1,
          provenance: 'estimate',
          locked: false,
          rateKey: 'weather_cover.standard',
        },
      ],
    };
    expect(findForgottenCosts(coveredPlan).some((r) => r.id === 'fc_weather_cover')).toBe(
      false,
    );
  });

  it('triggers accessibility and parking reminders under appropriate conditions', () => {
    const base = makeBaseline();

    // Elderly = 0, guests < 100 -> parking false
    const smallYoungPlan: EventPlan = {
      ...base,
      meta: { ...base.meta, guestCount: 50 },
      guestNeeds: { ...base.guestNeeds, elderly: 0 },
    };
    expect(
      findForgottenCosts(smallYoungPlan).some((r) => r.id === 'fc_parking_transport'),
    ).toBe(false);

    // Guests >= 100 -> parking true
    const largePlan: EventPlan = { ...base, meta: { ...base.meta, guestCount: 120 } };
    expect(
      findForgottenCosts(largePlan).some((r) => r.id === 'fc_parking_transport'),
    ).toBe(true);

    // Wheelchair users > 0 -> accessibility true
    const accessPlan: EventPlan = {
      ...base,
      guestNeeds: { ...base.guestNeeds, wheelchairUsers: 2 },
    };
    expect(
      findForgottenCosts(accessPlan).some((r) => r.id === 'fc_wheelchair_route'),
    ).toBe(true);
  });
});
