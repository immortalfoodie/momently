import { describe, expect, it } from 'vitest';
import { DEMO_SCENARIO } from '@/data/demoScenario';
import type { EventPlan, PlanPatchOp } from '@/domain/types';
import { applyPatch, createPatch } from '@/engine/patch';
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

describe('Patch Engine', () => {
  const fixedClock = () => new Date('2026-10-21T12:00:00.000Z');

  function makeBaseline(): EventPlan {
    const ids = createIdFactory('patch_seed');
    return createPlan({
      meta: DEMO_SCENARIO.meta,
      constraints: DEMO_SCENARIO.constraints,
      ids,
      clock: fixedClock,
    }).plan;
  }

  it('rejects patches whose status is not approved with not_approved error code', () => {
    const plan = deepFreeze(makeBaseline());
    const ids = createIdFactory('unapproved');
    const patch = createPatch(
      [{ type: 'set_setting', setting: 'outdoor' }],
      'Outdoor',
      'user',
      ids,
      fixedClock,
    );
    const result = applyPatch(plan, patch, { ids, clock: fixedClock });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('not_approved');
      expect(result.error.message).toContain("cannot be applied with status 'proposed'");
    }
  });

  it('rejects update_budget_item and remove_budget_item on locked items with item_locked code', () => {
    const base = makeBaseline();
    const lockedItemId = base.budgetItems[0]?.id ?? 'item_0';
    const lockedPlan = deepFreeze({
      ...base,
      budgetItems: base.budgetItems.map((i) =>
        i.id === lockedItemId ? { ...i, locked: true, label: 'Locked Hall' } : i,
      ),
    });
    const ids = createIdFactory('locked_test');

    const updatePatch = createPatch(
      [{ type: 'update_budget_item', id: lockedItemId, changes: { unitCost: 99999 } }],
      'Up',
      'user',
      ids,
      fixedClock,
      'approved',
    );
    const resUpdate = applyPatch(lockedPlan, updatePatch, { ids, clock: fixedClock });
    expect(resUpdate.ok).toBe(false);
    if (!resUpdate.ok) {
      expect(resUpdate.error.code).toBe('item_locked');
      expect(resUpdate.error.message).toContain('Locked Hall is locked');
    }

    const removePatch = createPatch(
      [{ type: 'remove_budget_item', id: lockedItemId }],
      'Del',
      'user',
      ids,
      fixedClock,
      'approved',
    );
    const resRemove = applyPatch(lockedPlan, removePatch, { ids, clock: fixedClock });
    expect(resRemove.ok).toBe(false);
    if (!resRemove.ok) expect(resRemove.error.code).toBe('item_locked');
  });

  it('scales non-locked items in category while skipping locked items and logging notes', () => {
    const base = makeBaseline();
    const decor = [
      {
        id: 'decor_l',
        category: 'decor' as const,
        label: 'Stage Decor',
        basis: 'flat' as const,
        unitCost: 10000,
        quantity: 1,
        provenance: 'estimate' as const,
        locked: true,
      },
      {
        id: 'decor_u',
        category: 'decor' as const,
        label: 'Flowers',
        basis: 'flat' as const,
        unitCost: 5000,
        quantity: 1,
        provenance: 'estimate' as const,
        locked: false,
      },
    ];
    const plan = deepFreeze({
      ...base,
      budgetItems: [...base.budgetItems.filter((i) => i.category !== 'decor'), ...decor],
    });
    const ids = createIdFactory('scale_test');
    const patch = createPatch(
      [{ type: 'scale_category', category: 'decor', percent: 20 }],
      'Scale',
      'user',
      ids,
      fixedClock,
      'approved',
    );

    const result = applyPatch(plan, patch, {
      ids,
      clock: fixedClock,
      allowHardViolations: true,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const locked = result.value.plan.budgetItems.find((i) => i.id === 'decor_l');
      const unlocked = result.value.plan.budgetItems.find((i) => i.id === 'decor_u');
      expect(locked?.unitCost).toBe(10000);
      expect(unlocked?.unitCost).toBe(6000);
      expect(
        result.value.impact.notes.some((n) =>
          n.includes('Stage Decor is locked and was not scaled.'),
        ),
      ).toBe(true);
    }
  });

  it('fails with hard_constraint_violation and attached impact when 80 -> 110 breaches hard cap', () => {
    const plan = deepFreeze(makeBaseline());
    const ids = createIdFactory('violation_test');
    const patch = createPatch(
      [{ type: 'set_guest_count', guestCount: 110 }],
      'Bump',
      'user',
      ids,
      fixedClock,
      'approved',
    );

    const result = applyPatch(plan, patch, { ids, clock: fixedClock });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('hard_constraint_violation');
      expect(result.error.impact?.overCap).toBe(true);
      expect(result.error.impact?.budgetTotalAfter).toBeGreaterThan(150000);
    }
  });

  it('succeeds when guest increase is paired with set_budget_cap in the same patch', () => {
    const plan = deepFreeze(makeBaseline());
    const ids = createIdFactory('multi_op_test');
    const ops: PlanPatchOp[] = [
      { type: 'set_budget_cap', amount: 250000 },
      { type: 'set_guest_count', guestCount: 110 },
    ];
    const patch = createPatch(ops, 'Cap and guests', 'user', ids, fixedClock, 'approved');

    const result = applyPatch(plan, patch, { ids, clock: fixedClock });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.plan.meta.guestCount).toBe(110);
      expect(result.value.plan.version).toBe(plan.version + 1);
      expect(result.value.plan.ledger).toHaveLength(plan.ledger.length + 1);
      const latest = result.value.plan.ledger[result.value.plan.ledger.length - 1];
      expect(latest?.summary).toBe('Cap and guests');
      expect(latest?.status).toBe('approved');
      expect(result.value.impact.overCap).toBe(false);
    }
  });

  it('rejects shift_schedule when shifting would overflow past 24 hours (1439 min)', () => {
    const plan = deepFreeze(makeBaseline());
    const ids = createIdFactory('shift_overflow');
    const patch = createPatch(
      [{ type: 'shift_schedule', fromMinute: 0, deltaMinutes: 1200 }],
      'Delay',
      'user',
      ids,
      fixedClock,
      'approved',
    );
    const result = applyPatch(plan, patch, { ids, clock: fixedClock });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('schedule_overflow');
  });

  it('select_concept requires the concept to exist', () => {
    const plan = deepFreeze(makeBaseline());
    const ids = createIdFactory('concept_test');
    const patch = createPatch(
      [{ type: 'select_concept', conceptId: 'missing' }],
      'Sel',
      'user',
      ids,
      fixedClock,
      'approved',
    );
    const result = applyPatch(plan, patch, { ids, clock: fixedClock });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('concept_not_found');
  });

  it('proves deep immutability by applying patches without altering the frozen input plan', () => {
    const plan = deepFreeze(makeBaseline());
    const ids = createIdFactory('freeze_verify');
    const patch = createPatch(
      [{ type: 'set_setting', setting: 'outdoor' }],
      'Setting',
      'user',
      ids,
      fixedClock,
      'approved',
    );
    const result = applyPatch(plan, patch, {
      ids,
      clock: fixedClock,
      allowHardViolations: true,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.plan.meta.setting).toBe('outdoor');
    expect(plan.meta.setting).toBe('undecided');
  });
});

