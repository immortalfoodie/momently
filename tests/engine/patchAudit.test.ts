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

describe('Patch Engine Audit & Operations', () => {
  const fixedClock = () => new Date('2026-10-21T12:00:00.000Z');

  function makeBaseline(): EventPlan {
    const ids = createIdFactory('audit_seed');
    return createPlan({
      meta: DEMO_SCENARIO.meta,
      constraints: DEMO_SCENARIO.constraints,
      ids,
      clock: fixedClock,
    }).plan;
  }

  function runPatch(plan: EventPlan, ops: PlanPatchOp[], allowViolations = false) {
    const ids = createIdFactory('run_patch');
    const patch = createPatch(ops, 'test', 'user', ids, fixedClock, 'approved');
    return applyPatch(plan, patch, {
      ids,
      clock: fixedClock,
      allowHardViolations: allowViolations,
    });
  }

  it('allows unlock-only changes on a locked item', () => {
    const base = makeBaseline();
    const lockedId = base.budgetItems[0]?.id ?? 'item_0';
    const plan = deepFreeze({
      ...base,
      budgetItems: base.budgetItems.map((i) =>
        i.id === lockedId ? { ...i, locked: true } : i,
      ),
    });
    const result = runPatch(plan, [
      { type: 'update_budget_item', id: lockedId, changes: { locked: false } },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.plan.budgetItems.find((i) => i.id === lockedId)?.locked).toBe(
        false,
      );
    }
  });

  it('rejects changes that mix unlock with other modifications on a locked item', () => {
    const base = makeBaseline();
    const lockedId = base.budgetItems[0]?.id ?? 'item_0';
    const plan = deepFreeze({
      ...base,
      budgetItems: base.budgetItems.map((i) =>
        i.id === lockedId ? { ...i, locked: true } : i,
      ),
    });
    const result = runPatch(plan, [
      {
        type: 'update_budget_item',
        id: lockedId,
        changes: { locked: false, unitCost: 99999 },
      },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('item_locked');
  });

  it('refreshes contingency automatically after budget modifications', () => {
    const base = makeBaseline();
    const result = runPatch(
      base,
      [{ type: 'scale_category', category: 'decor', percent: 20 }],
      true,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const contingencyItems = result.value.plan.budgetItems.filter(
        (i) => i.category === 'contingency',
      );
      expect(contingencyItems).toHaveLength(1);
      expect(contingencyItems[0]?.rateKey).toBe('contingency.auto');
    }
  });

  it('preserves user-locked contingency item during patches', () => {
    const base = makeBaseline();
    const lockedContingencyPlan = deepFreeze({
      ...base,
      budgetItems: base.budgetItems.map((i) =>
        i.category === 'contingency'
          ? { ...i, locked: true, unitCost: 45000, provenance: 'user' as const }
          : i,
      ),
    });
    const result = runPatch(
      lockedContingencyPlan,
      [{ type: 'set_setting', setting: 'outdoor' }],
      true,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const contingency = result.value.plan.budgetItems.find(
        (i) => i.category === 'contingency',
      );
      expect(contingency?.unitCost).toBe(45000);
      expect(contingency?.locked).toBe(true);
    }
  });

  it('supports schedule operations: add_slot, update_slot, remove_slot', () => {
    const base = makeBaseline();
    const newSlot = {
      id: 'slot_custom',
      title: 'Cake Cutting',
      startMinute: 720,
      durationMinutes: 30,
      priority: 'important' as const,
      flexible: true,
    };

    const addRes = runPatch(base, [{ type: 'add_slot', slot: newSlot }]);
    expect(addRes.ok).toBe(true);
    if (!addRes.ok) return;

    const updateRes = runPatch(addRes.value.plan, [
      { type: 'update_slot', id: 'slot_custom', changes: { title: 'Grand Cake' } },
    ]);
    expect(updateRes.ok).toBe(true);
    if (!updateRes.ok) return;
    expect(updateRes.value.plan.schedule.find((s) => s.id === 'slot_custom')?.title).toBe(
      'Grand Cake',
    );

    const removeRes = runPatch(updateRes.value.plan, [
      { type: 'remove_slot', id: 'slot_custom' },
    ]);
    expect(removeRes.ok).toBe(true);
    if (!removeRes.ok) return;
    expect(removeRes.value.plan.schedule.some((s) => s.id === 'slot_custom')).toBe(false);
  });

  it('supports task and constraint operations', () => {
    const base = makeBaseline();
    const newTask = {
      id: 'task_custom',
      title: 'Hire Valet',
      category: 'transport',
      dueDaysBefore: 14,
      priority: 'high' as const,
      status: 'todo' as const,
    };
    const newConstraint = {
      id: 'c_custom',
      kind: 'must_have' as const,
      severity: 'soft' as const,
      description: 'Must have live dhol',
    };

    const res = runPatch(base, [
      { type: 'add_task', task: newTask },
      { type: 'update_task', id: 'task_custom', changes: { status: 'done' } },
      { type: 'add_constraint', constraint: newConstraint },
      { type: 'remove_constraint', id: 'c_custom' },
    ]);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.plan.tasks.find((t) => t.id === 'task_custom')?.status).toBe(
        'done',
      );
      expect(res.value.plan.constraints.some((c) => c.id === 'c_custom')).toBe(false);
    }
  });
});
