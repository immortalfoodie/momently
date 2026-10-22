import { describe, expect, it } from 'vitest';
import { DEMO_SCENARIO } from '@/data/demoScenario';
import type { BudgetItem, EventPlan } from '@/domain/types';
import { budgetTotal } from '@/engine/budget';
import { createPatch, applyPatch } from '@/engine/patch';
import { createPlan } from '@/engine/planFactory';
import { reestimateEstimates } from '@/engine/propagate';
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

describe('City Tier Repricing and Event Type Immutability', () => {
  const fixedClock = () => new Date('2026-10-21T12:00:00.000Z');

  function makeBaselinePlan(): EventPlan {
    const ids = createIdFactory('city_tier_seed');
    const { plan } = createPlan({
      meta: { ...DEMO_SCENARIO.meta, city: 'Mumbai' }, // Mumbai is tier1
      constraints: DEMO_SCENARIO.constraints,
      ids,
      clock: fixedClock,
    });
    return plan;
  }

  it('reprices estimates when city tier changes from tier1 (Mumbai) to tier2 (Jaipur), leaving locked, user, and verified items untouched', () => {
    const basePlan = makeBaselinePlan();

    // Add locked, user, and verified items to verify they remain untouched
    const customUserItem: BudgetItem = {
      id: 'bi_user_custom',
      category: 'entertainment',
      label: 'Local Folk Band',
      basis: 'flat',
      unitCost: 25000,
      quantity: 1,
      provenance: 'user',
      locked: false,
    };
    const verifiedItem: BudgetItem = {
      id: 'bi_verified_cake',
      category: 'food',
      label: 'Specialty Cake',
      basis: 'flat',
      unitCost: 15000,
      quantity: 1,
      provenance: 'verified',
      locked: false,
    };
    const lockedEstimate: BudgetItem = {
      ...basePlan.budgetItems[0]!,
      id: 'bi_locked_decor',
      locked: true,
      unitCost: 30000,
    };

    const planWithItems: EventPlan = {
      ...basePlan,
      budgetItems: [...basePlan.budgetItems, customUserItem, verifiedItem, lockedEstimate],
    };

    const frozenPlan = deepFreeze(planWithItems);
    const initialTotal = budgetTotal(frozenPlan.budgetItems, frozenPlan.meta.guestCount);

    const ctx = { ids: createIdFactory('patch_ctx'), clock: fixedClock };
    const patch = createPatch(
      [{ type: 'set_meta', changes: { city: 'Jaipur' } }],
      'Relocate celebration to Jaipur',
      'user',
      ctx.ids,
      ctx.clock,
      'approved',
    );

    const result = applyPatch(frozenPlan, patch, { ...ctx, allowHardViolations: true });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const updatedPlan = result.value.plan;
    expect(updatedPlan.meta.city).toBe('Jaipur');

    // Unlocked estimates were repriced (tier2 rates are lower than tier1 rates)
    const newTotal = budgetTotal(updatedPlan.budgetItems, updatedPlan.meta.guestCount);
    expect(newTotal).toBeLessThan(initialTotal);

    // Note added for tier re-estimation
    expect(result.value.impact.notes).toContain('Prices re-estimated for tier2 city rates');

    // User, verified, and locked items must remain exactly the same
    const updatedUser = updatedPlan.budgetItems.find((i) => i.id === 'bi_user_custom');
    expect(updatedUser?.unitCost).toBe(25000);
    expect(updatedUser?.provenance).toBe('user');

    const updatedVerified = updatedPlan.budgetItems.find((i) => i.id === 'bi_verified_cake');
    expect(updatedVerified?.unitCost).toBe(15000);
    expect(updatedVerified?.provenance).toBe('verified');

    const updatedLocked = updatedPlan.budgetItems.find((i) => i.id === 'bi_locked_decor');
    expect(updatedLocked?.unitCost).toBe(30000);
    expect(updatedLocked?.locked).toBe(true);
  });

  it('does nothing when city changes within the same tier (Mumbai to Delhi, both tier1)', () => {
    const frozenPlan = deepFreeze(makeBaselinePlan());
    const initialItems = [...frozenPlan.budgetItems];

    const ctx = { ids: createIdFactory('patch_ctx'), clock: fixedClock };
    const patch = createPatch(
      [{ type: 'set_meta', changes: { city: 'Delhi' } }],
      'Move from Mumbai to Delhi',
      'user',
      ctx.ids,
      ctx.clock,
      'approved',
    );

    const result = applyPatch(frozenPlan, patch, ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.plan.meta.city).toBe('Delhi');
    expect(result.value.impact.notes).toHaveLength(0);

    // All budget item unit costs remain identical
    result.value.plan.budgetItems.forEach((item, idx) => {
      expect(item.unitCost).toBe(initialItems[idx]?.unitCost);
    });
  });

  it('rejects event type changes with invalid_change error code and exact explanatory message', () => {
    const frozenPlan = deepFreeze(makeBaselinePlan());
    const ctx = { ids: createIdFactory('patch_ctx'), clock: fixedClock };

    const patch = createPatch(
      [{ type: 'set_meta', changes: { type: 'birthday' } }],
      'Try changing event type',
      'user',
      ctx.ids,
      ctx.clock,
      'approved',
    );

    const result = applyPatch(frozenPlan, patch, ctx);
    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.code).toBe('invalid_change');
    expect(result.error.message).toBe(
      "The event type can't be changed after planning starts; create a new event instead",
    );
  });

  it('reestimateEstimates pure helper recalculates estimates from plan.meta directly', () => {
    const plan = deepFreeze(makeBaselinePlan());
    const result = reestimateEstimates(plan);
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.find((i) => i.category === 'contingency')).toBeDefined();
  });
});
