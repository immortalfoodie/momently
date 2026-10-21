import { describe, expect, it } from 'vitest';
import { DEMO_SCENARIO } from '@/data/demoScenario';
import type { BudgetItem, EventPlan } from '@/domain/types';
import { budgetTotal } from '@/engine/budget';
import { createPlan } from '@/engine/planFactory';
import { reestimateForGuestCount } from '@/engine/propagate';
import { createIdFactory } from '@/lib/id';

function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const val = (obj as Record<string, unknown>)[key];
    if (val !== null && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj;
}

describe('Propagation Engine', () => {
  const fixedClock = () => new Date('2026-10-21T12:00:00.000Z');

  function makeBaselinePlan(): EventPlan {
    const ids = createIdFactory('propagate_seed');
    const { plan } = createPlan({
      meta: DEMO_SCENARIO.meta,
      constraints: DEMO_SCENARIO.constraints,
      ids,
      clock: fixedClock,
    });
    return plan;
  }

  it('reprices estimate items when guests increase from 80 to 110 and produces a band-boundary note', () => {
    const plan = deepFreeze(makeBaselinePlan());
    const initialTotal = budgetTotal(plan.budgetItems, 80);

    const { items, notes } = reestimateForGuestCount(plan, 110);
    const newTotal = budgetTotal(items, 110);

    expect(newTotal).toBeGreaterThan(initialTotal);

    // Venue band note should be triggered (crossing 100 to 150 bracket)
    const bandNote = notes.find((n) => n.includes('crosses venue capacity bracket'));
    expect(bandNote).toBeDefined();
    expect(bandNote).toContain('80 to 110');
    expect(bandNote).toContain('up to 150 guests');

    // Contingency item is refreshed
    const contingencyItems = items.filter((i) => i.category === 'contingency');
    expect(contingencyItems).toHaveLength(1);
    expect(contingencyItems[0]?.rateKey).toBe('contingency.auto');
  });

  it('keeps locked and user-provenance items unchanged and emits explanatory notes', () => {
    const base = makeBaselinePlan();

    // Lock the first item and set another to user provenance
    const customItems: BudgetItem[] = base.budgetItems.map((item, idx) => {
      if (idx === 0) {
        return { ...item, locked: true, label: 'Locked Hall' };
      }
      if (idx === 1) {
        return {
          ...item,
          provenance: 'user',
          label: 'Custom Caterer',
          unitCost: 750,
        };
      }
      return item;
    });

    const modifiedPlan: EventPlan = deepFreeze({
      ...base,
      budgetItems: customItems,
    });

    const { items, notes } = reestimateForGuestCount(modifiedPlan, 110);

    const lockedItem = items.find((i) => i.label === 'Locked Hall');
    expect(lockedItem).toBeDefined();
    expect(lockedItem?.locked).toBe(true);
    expect(lockedItem?.unitCost).toBe(customItems[0]?.unitCost);

    const userItem = items.find((i) => i.label === 'Custom Caterer');
    expect(userItem).toBeDefined();
    expect(userItem?.provenance).toBe('user');
    expect(userItem?.unitCost).toBe(750);

    // Explanatory notes emitted for both
    expect(notes.some((n) => n.includes('Locked Hall is locked at'))).toBe(true);
    expect(notes.some((n) => n.includes('Custom Caterer is locked at'))).toBe(true);
  });

  it('does not throw for unknown rateKeys, keeps the item and produces a note', () => {
    const base = makeBaselinePlan();
    const unknownItem: BudgetItem = {
      id: 'item_unknown_custom',
      category: 'other',
      label: 'Rare Artisanal Candle',
      basis: 'flat',
      unitCost: 5000,
      quantity: 1,
      provenance: 'estimate',
      locked: false,
      rateKey: 'unknown_candle_rate.standard',
    };

    const planWithUnknown: EventPlan = deepFreeze({
      ...base,
      budgetItems: [...base.budgetItems, unknownItem],
    });

    const { items, notes } = reestimateForGuestCount(planWithUnknown, 110);

    const retained = items.find((i) => i.id === 'item_unknown_custom');
    expect(retained).toBeDefined();
    expect(retained?.unitCost).toBe(5000);

    const unknownNote = notes.find((n) =>
      n.includes("Unknown rate key 'unknown_candle_rate.standard'"),
    );
    expect(unknownNote).toBeDefined();
  });

  it('proves immutability by running against a deep-frozen input plan without throwing', () => {
    const plan = deepFreeze(makeBaselinePlan());
    expect(() => reestimateForGuestCount(plan, 120)).not.toThrow();
  });
});
