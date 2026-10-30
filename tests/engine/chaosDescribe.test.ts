import { describe, expect, it } from 'vitest';
import type { EventPlan } from '@/domain/types';
import { buildDescribeContext, reconcileDescribedScenarios } from '@/engine/chaos';
import { buildDemoPlan } from '@/engine/demo';
import { createIdFactory } from '@/lib/id';
import { deepFreeze } from '../helpers/deepFreeze';

function demoPlan(): EventPlan {
  return buildDemoPlan({
    ids: createIdFactory('describe_test'),
    clock: () => new Date('2026-10-22T10:00:00.000Z'),
  }).plan;
}

describe('Engine: free-text chaos reconciliation', () => {
  it('builds a vocabulary of real vendor categories and item families only', () => {
    const plan = demoPlan();
    const ctx = buildDescribeContext(plan);

    expect(ctx.guestCount).toBe(plan.meta.guestCount);
    expect(ctx.setting).toBe(plan.meta.setting);
    expect(new Set(ctx.vendorCategories).size).toBe(ctx.vendorCategories.length);
    for (const category of ctx.vendorCategories) {
      expect(plan.vendors.some((v) => v.category === category)).toBe(true);
    }
    for (const { family } of ctx.itemFamilies) {
      expect(plan.budgetItems.some((i) => i.rateKey?.startsWith(`${family}.`))).toBe(true);
    }
  });

  it('accepts real scenarios and drops invented vendor categories and item families', () => {
    const plan = demoPlan();
    const realCategory = buildDescribeContext(plan).vendorCategories[0] ?? 'photography';

    const { accepted, dropped } = reconcileDescribedScenarios(plan, [
      { type: 'vendor_cancels', category: realCategory },
      { type: 'item_unavailable', family: 'unicorn_rides' },
      { type: 'late_start', delayMinutes: 60 },
    ]);

    expect(accepted).toEqual([
      { type: 'vendor_cancels', category: realCategory },
      { type: 'late_start', delayMinutes: 60 },
    ]);
    expect(dropped).toHaveLength(1);
    expect(dropped[0]?.reason).toContain('unicorn_rides');
  });

  it('drops a vendor category that is not in the plan', () => {
    const { accepted, dropped } = reconcileDescribedScenarios(demoPlan(), [
      { type: 'vendor_cancels', category: 'fireworks' },
    ]);
    expect(accepted).toHaveLength(0);
    expect(dropped[0]?.reason).toContain('fireworks');
  });

  it('ignores duplicate scenario types and keeps the first', () => {
    const { accepted } = reconcileDescribedScenarios(demoPlan(), [
      { type: 'late_start', delayMinutes: 30 },
      { type: 'late_start', delayMinutes: 90 },
    ]);
    expect(accepted).toEqual([{ type: 'late_start', delayMinutes: 30 }]);
  });

  it('drops rain for an indoor plan with the engine availability reason', () => {
    const plan = demoPlan();
    const indoor: EventPlan = { ...plan, meta: { ...plan.meta, setting: 'indoor' } };
    const { accepted, dropped } = reconcileDescribedScenarios(indoor, [{ type: 'rain' }]);
    expect(accepted).toHaveLength(0);
    expect(dropped[0]?.reason).toMatch(/indoor/i);
  });

  it('never mutates the plan or the proposed list', () => {
    const plan = deepFreeze(demoPlan());
    const proposed = deepFreeze([{ type: 'rain' as const }, { type: 'budget_cut' as const, percent: 20 }]);
    expect(() => reconcileDescribedScenarios(plan, proposed)).not.toThrow();
  });
});
