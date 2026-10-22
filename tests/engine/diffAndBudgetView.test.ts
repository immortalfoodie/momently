import { describe, expect, it } from 'vitest';
import { DEMO_SCENARIO } from '@/data/demoScenario';
import type { EventPlan, Task } from '@/domain/types';
import { buildBudgetView, propagationPreview } from '@/engine/budgetView';
import { diffPlans } from '@/engine/diff';
import { createPlan } from '@/engine/planFactory';
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

describe('diffPlans and buildBudgetView Engine Logic', () => {
  const fixedClock = () => new Date('2026-10-21T12:00:00.000Z');
  const ids = createIdFactory('diff_view_seed');

  function makeBaselinePlan(): EventPlan {
    const { plan } = createPlan({
      meta: DEMO_SCENARIO.meta,
      constraints: DEMO_SCENARIO.constraints,
      ids,
      clock: fixedClock,
    });
    return plan;
  }

  describe('diffPlans', () => {
    it('detects added, removed, changed items, meta changes, concept shift, and schedule/task counts', () => {
      const before = deepFreeze(makeBaselinePlan());

      // Modify plan to produce after state
      const keptAndModifiedItem = {
        ...before.budgetItems[0]!,
        unitCost: before.budgetItems[0]!.unitCost + 5000,
      };
      const newItem = {
        id: 'bi_brand_new',
        category: 'entertainment' as const,
        label: 'Acoustic Guitarist',
        basis: 'flat' as const,
        unitCost: 18000,
        quantity: 1,
        provenance: 'user' as const,
        locked: false,
      };
      // item[1] is removed (omitted)
      const afterItems = [keptAndModifiedItem, ...before.budgetItems.slice(2), newItem];

      const newTask: Task = {
        id: 'task_new_99',
        title: 'Book acoustic guitarist',
        category: 'entertainment',
        priority: 'high',
        status: 'todo',
        dueDaysBefore: 14,
      };

      const after: EventPlan = {
        ...before,
        meta: {
          ...before.meta,
          city: 'Pune',
          guestCount: 95,
        },
        selectedConceptId: 'concept_signature',
        budgetItems: afterItems,
        schedule: before.schedule.slice(1), // remove 1 slot
        tasks: [...before.tasks, newTask], // add 1 task
      };

      const diff = diffPlans(before, deepFreeze(after));

      // Meta checks
      expect(diff.meta).toEqual(
        expect.arrayContaining([
          { field: 'city', before: 'Mumbai', after: 'Pune' },
          { field: 'guestCount', before: 80, after: 95 },
        ]),
      );

      // Item diffs
      expect(diff.items.added).toEqual([{ label: 'Acoustic Guitarist', total: 18000 }]);
      expect(diff.items.removed).toHaveLength(1);
      expect(diff.items.changed.length).toBeGreaterThanOrEqual(1);
      expect(diff.items.changed.some((i) => i.label === keptAndModifiedItem.label)).toBe(true);

      // Totals
      expect(diff.budgetTotalBefore).toBeGreaterThan(0);
      expect(diff.budgetTotalAfter).toBeGreaterThan(0);

      // Concept check
      expect(diff.concept).not.toBeNull();
      expect(diff.concept?.after).toBe('concept_signature');

      // Schedule & task counts
      expect(diff.scheduleChanges).toBe(1);
      expect(diff.taskChanges).toBe(1);
    });

    it('returns null concept diff and empty lists when plans are identical', () => {
      const plan = deepFreeze(makeBaselinePlan());
      const diff = diffPlans(plan, plan);

      expect(diff.meta).toHaveLength(0);
      expect(diff.items.added).toHaveLength(0);
      expect(diff.items.removed).toHaveLength(0);
      expect(diff.items.changed).toHaveLength(0);
      expect(diff.concept).toBeNull();
      expect(diff.scheduleChanges).toBe(0);
      expect(diff.taskChanges).toBe(0);
      expect(diff.budgetTotalBefore).toBe(diff.budgetTotalAfter);
    });
  });

  describe('buildBudgetView', () => {
    it('orders categories descending by total spend, omits zero-total categories, and formats 1-decimal shares', () => {
      const plan = deepFreeze(makeBaselinePlan());
      const view = buildBudgetView(plan);

      expect(view.total).toBeGreaterThan(0);
      expect(view.cap).toBe(150000);
      expect(view.remaining).toBe(view.cap! - view.total);
      expect(view.overCap).toBe(view.total > view.cap!);

      // Categories ordering
      expect(view.categories.length).toBeGreaterThan(0);
      for (let i = 0; i < view.categories.length - 1; i++) {
        expect(view.categories[i]!.total).toBeGreaterThanOrEqual(view.categories[i + 1]!.total);
      }

      // No zero totals
      expect(view.categories.every((c) => c.total > 0)).toBe(true);

      // Shares validation
      view.categories.forEach((c) => {
        expect(c.sharePercent).toBeGreaterThan(0);
        // Verify 1 decimal precision
        expect(Number(c.sharePercent.toFixed(1))).toBe(c.sharePercent);
      });

      // Provenance breakdown
      expect(view.provenance).toHaveLength(3);
      const provTotal = view.provenance.reduce((sum, p) => sum + p.total, 0);
      expect(provTotal).toBe(view.total);
    });

    it('handles an empty plan gracefully without crashing or NaN shares', () => {
      const emptyPlan: EventPlan = {
        ...makeBaselinePlan(),
        budgetItems: [],
        constraints: [],
      };

      const view = buildBudgetView(deepFreeze(emptyPlan));

      expect(view.total).toBe(0);
      expect(view.cap).toBeNull();
      expect(view.remaining).toBe(0);
      expect(view.overCap).toBe(false);
      expect(view.categories).toHaveLength(0);
      expect(view.provenance.every((p) => p.total === 0 && p.sharePercent === 0)).toBe(true);
    });
  });

  describe('propagationPreview', () => {
    it('computes before and after metrics, impact diff, and resulting conflicts without mutating the plan', () => {
      const plan = deepFreeze(makeBaselinePlan());
      const ctx = { ids: createIdFactory('preview_ctx'), clock: fixedClock };

      const result = propagationPreview(plan, 110, ctx);

      // Metrics
      expect(result.metricsBefore.tables).toBe(10); // 80 / 8 = 10
      expect(result.metricsAfter.tables).toBe(14); // 110 / 8 = 13.75 -> 14

      // Impact
      expect(result.impact.budgetTotalAfter).toBeGreaterThan(result.impact.budgetTotalBefore);
      expect(result.impact.changedItems.length).toBeGreaterThan(0);

      // Verify input plan was not modified (deepFreeze verified)
      expect(plan.meta.guestCount).toBe(80);
    });
  });
});
