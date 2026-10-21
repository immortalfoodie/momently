import { describe, expect, it } from 'vitest';
import { DEMO_SCENARIO } from '@/data/demoScenario';
import type { BudgetItem, EventPlan } from '@/domain/types';
import {
  checkRequest,
  findConflicts,
  maxGuestsWithinCap,
  minimumFeasibleCost,
} from '@/engine/conflicts';
import { createPlan } from '@/engine/planFactory';
import { createIdFactory } from '@/lib/id';

function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const val = (obj as Record<string, unknown>)[key];
    if (val !== null && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj;
}

describe('Conflicts and Feasibility Engine', () => {
  const fixedClock = () => new Date('2026-10-21T12:00:00.000Z');

  function makeBaseline(): EventPlan {
    const ids = createIdFactory('conflicts_seed');
    return createPlan({
      meta: DEMO_SCENARIO.meta,
      constraints: DEMO_SCENARIO.constraints,
      ids,
      clock: fixedClock,
    }).plan;
  }

  it('calculates minimumFeasibleCost and performs monotonic maxGuestsWithinCap binary search', () => {
    const ids = createIdFactory('feasibility_calc');
    const ctx = { ids, clock: fixedClock };

    const floor80 = minimumFeasibleCost(DEMO_SCENARIO.meta, undefined, ctx);
    const floor40 = minimumFeasibleCost(
      { ...DEMO_SCENARIO.meta, guestCount: 40 },
      undefined,
      ctx,
    );

    expect(floor80).toBeGreaterThan(floor40);

    // Binary search returns highest guest count within cap
    const maxG = maxGuestsWithinCap(DEMO_SCENARIO.meta, floor80, undefined, ctx);
    expect(maxG).toBe(80);

    const maxGTight = maxGuestsWithinCap(DEMO_SCENARIO.meta, floor40, undefined, ctx);
    expect(maxGTight).toBe(40);

    const maxGZero = maxGuestsWithinCap(DEMO_SCENARIO.meta, 1000, undefined, ctx);
    expect(maxGZero).toBe(0);
  });

  it('scenario 1 & 2: flags cap_exceeded and cap_below_floor with resolution options', () => {
    const base = makeBaseline();
    const ids = createIdFactory('cap_conflicts');
    const ctx = { ids, clock: fixedClock };

    // Cap below essential floor
    const belowFloorPlan: EventPlan = deepFreeze({
      ...base,
      constraints: [
        {
          id: 'c_low',
          kind: 'budget_cap',
          severity: 'hard',
          numericValue: 20000,
          description: 'Low',
        },
      ],
    });
    const conflictsFloor = findConflicts(belowFloorPlan, ctx);
    const floorConflict = conflictsFloor.find((c) => c.kind === 'cap_below_floor');
    expect(floorConflict).toBeDefined();
    expect(floorConflict?.severity).toBe('blocking');
    expect(floorConflict?.options.length).toBeGreaterThanOrEqual(2);

    // Hard cap exceeded above floor
    const exceededPlan: EventPlan = deepFreeze({
      ...base,
      constraints: [
        {
          id: 'c_exc',
          kind: 'budget_cap',
          severity: 'hard',
          numericValue: 120000,
          description: 'Tight cap',
        },
      ],
      budgetItems: base.budgetItems.map((i) =>
        i.category === 'venue' ? { ...i, unitCost: 100000 } : i,
      ),
    });
    const conflictsExc = findConflicts(exceededPlan, ctx);
    expect(conflictsExc.some((c) => c.kind === 'cap_exceeded')).toBe(true);
  });

  it('scenario 3: 80 -> 110 guests via checkRequest reports a new cap_exceeded conflict while user-locked decisions are preserved', () => {
    const base = makeBaseline();
    const lockedCaterer: BudgetItem = {
      id: 'item_locked_caterer',
      category: 'food',
      label: 'Special Chef',
      basis: 'flat',
      unitCost: 60000,
      quantity: 1,
      provenance: 'user',
      locked: true,
    };

    const planWithLock: EventPlan = deepFreeze({
      ...base,
      budgetItems: [
        ...base.budgetItems.filter((i) => i.category !== 'food'),
        lockedCaterer,
      ],
    });

    const ids = createIdFactory('check_req_test');
    const ctx = { ids, clock: fixedClock };

    const checkResult = checkRequest(
      planWithLock,
      [{ type: 'set_guest_count', guestCount: 110 }],
      ctx,
    );
    expect(checkResult.verdict).toBe('conflict');
    expect(checkResult.newConflicts.some((c) => c.kind === 'cap_exceeded')).toBe(true);

    // In projected plan, locked custom caterer remains 50000
    const caterer = checkResult.impact?.changedItems.find(
      (i) => i.label === 'Special Chef',
    );
    expect(caterer).toBeUndefined(); // untouched items are not in changedItems
  });

  it('scenario 4: estimate-provenance items are the only ones repriced during guest changes', () => {
    const base = makeBaseline();
    const userItem: BudgetItem = {
      id: 'item_user_dj',
      category: 'entertainment',
      label: 'Friend DJ',
      basis: 'flat',
      unitCost: 15000,
      quantity: 1,
      provenance: 'user',
      locked: false,
    };
    const plan = deepFreeze({
      ...base,
      budgetItems: [...base.budgetItems, userItem],
    });

    const ids = createIdFactory('provenance_test');
    const ctx = { ids, clock: fixedClock };

    const res = checkRequest(plan, [{ type: 'set_guest_count', guestCount: 95 }], ctx);
    expect(res.verdict).toBeDefined();
    // User provenance item is not modified
    expect(res.impact?.changedItems.some((i) => i.label === 'Friend DJ')).toBe(false);
  });

  it('scenario 5: monsoon_outdoor fires for an outdoor event in July and not in December', () => {
    const base = makeBaseline();
    const ids = createIdFactory('monsoon_test');
    const ctx = { ids, clock: fixedClock };

    // July event (month 7) -> warning fires
    const julyOutdoorPlan: EventPlan = deepFreeze({
      ...base,
      meta: { ...base.meta, setting: 'outdoor', dateIso: '2026-07-15' },
    });
    const conflictsJuly = findConflicts(julyOutdoorPlan, ctx);
    expect(conflictsJuly.some((c) => c.kind === 'monsoon_outdoor')).toBe(true);

    // December event (month 12) -> warning does not fire
    const decOutdoorPlan: EventPlan = deepFreeze({
      ...base,
      meta: { ...base.meta, setting: 'outdoor', dateIso: '2026-12-15' },
    });
    const conflictsDec = findConflicts(decOutdoorPlan, ctx);
    expect(conflictsDec.some((c) => c.kind === 'monsoon_outdoor')).toBe(false);
  });
});
