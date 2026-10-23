import { describe, expect, it } from 'vitest';
import { CHAOS_SCENARIO_CATALOG } from '@/domain/chaosSchemas';
import type { EventPlan } from '@/domain/types';
import {
  buildChaosFacts,
  defaultInputFor,
  previewOption,
  runStressTest,
  scenarioAvailability,
  simulateScenario,
} from '@/engine/chaos';
import { buildDemoPlan } from '@/engine/demo';
import { createIdFactory } from '@/lib/id';

const ctx = {
  ids: createIdFactory('chaos_additions_test'),
  clock: () => new Date('2026-10-22T10:00:00.000Z'),
};

describe('Engine: Chaos Additions (TASK 1)', () => {
  it('reports all six scenarios available on the demo plan (undecided setting)', () => {
    const { plan } = buildDemoPlan(ctx);
    expect(plan.meta.setting).toBe('undecided');

    for (const item of CHAOS_SCENARIO_CATALOG) {
      const avail = scenarioAvailability(plan, item.type);
      expect(avail.available).toBe(true);
      expect(avail.reason).toBeUndefined();
    }
  });

  it('marks rain unavailable on an indoor plan with a clear reason', () => {
    const { plan } = buildDemoPlan(ctx);
    const indoorPlan: EventPlan = {
      ...plan,
      meta: { ...plan.meta, setting: 'indoor' },
    };

    const rainAvail = scenarioAvailability(indoorPlan, 'rain');
    expect(rainAvail.available).toBe(false);
    expect(rainAvail.reason).toMatch(/indoor/i);
  });

  it('marks budget_cut unavailable without a budget cap', () => {
    const { plan } = buildDemoPlan(ctx);
    const uncappedPlan: EventPlan = {
      ...plan,
      constraints: plan.constraints.filter((c) => c.kind !== 'budget_cap'),
    };

    const budgetAvail = scenarioAvailability(uncappedPlan, 'budget_cut');
    expect(budgetAvail.available).toBe(false);
    expect(budgetAvail.reason).toMatch(/budget cap/i);
  });

  it('marks vendor_cancels unavailable if vendors is empty, and item_unavailable without rateKeys', () => {
    const { plan } = buildDemoPlan(ctx);
    const noVendorsPlan: EventPlan = { ...plan, vendors: [] };
    expect(scenarioAvailability(noVendorsPlan, 'vendor_cancels').available).toBe(false);

    const noRateKeysPlan: EventPlan = {
      ...plan,
      budgetItems: plan.budgetItems.map((i) => ({ ...i, rateKey: undefined })),
    };
    expect(scenarioAvailability(noRateKeysPlan, 'item_unavailable').available).toBe(false);
  });

  it('builds sensible default inputs for all scenario types', () => {
    const { plan } = buildDemoPlan(ctx);
    expect(defaultInputFor(plan, 'rain')).toEqual({ type: 'rain' });
    expect(defaultInputFor(plan, 'budget_cut')).toEqual({ type: 'budget_cut', percent: 20 });

    const surge = defaultInputFor(plan, 'guest_surge');
    expect(surge.type).toBe('guest_surge');
    if (surge.type === 'guest_surge') {
      expect(surge.extraGuests).toBeGreaterThanOrEqual(10);
    }

    const late = defaultInputFor(plan, 'late_start');
    expect(late).toEqual({ type: 'late_start', delayMinutes: 120 });

    const itemUnavail = defaultInputFor(plan, 'item_unavailable');
    expect(itemUnavail.type).toBe('item_unavailable');
    if (itemUnavail.type === 'item_unavailable') {
      expect(typeof itemUnavail.family).toBe('string');
      expect(itemUnavail.family.length).toBeGreaterThan(0);
    }
  });

  it('buildChaosFacts produces facts containing only numbers and strings from the engine result', () => {
    const { plan } = buildDemoPlan(ctx);
    const result = simulateScenario(plan, { type: 'rain' }, ctx);
    const facts = buildChaosFacts(result);

    expect(facts.headline).toBe(result.headline);
    expect(facts.scoreBefore).toBe(result.scoreBefore);
    expect(typeof facts.optionCount).toBe('number');

    for (const [key, value] of Object.entries(facts)) {
      expect(
        typeof value === 'string' || typeof value === 'number',
        `Fact "${key}" must be string or number, got ${typeof value}`,
      ).toBe(true);
    }
  });

  it('previewOption computes projected plan, diff, and scoreAfter without mutating the original plan', () => {
    const { plan } = buildDemoPlan(ctx);
    const originalJson = JSON.stringify(plan);
    const result = simulateScenario(plan, { type: 'rain' }, ctx);
    const firstOption = result.options[0];
    expect(firstOption).toBeDefined();

    const preview = previewOption(plan, firstOption!, ctx);
    expect(preview.ok).toBe(true);
    if (preview.ok) {
      expect(preview.value.plan.version).toBe(plan.version + 1);
      expect(preview.value.diff.budgetTotalAfter).toBe(firstOption!.impact.budgetTotalAfter);
      expect(typeof preview.value.scoreAfter).toBe('number');
    }

    expect(JSON.stringify(plan)).toBe(originalJson);
  });

  it('runStressTest returns 6 catalog-ordered rows and picks weakestType', () => {
    const { plan } = buildDemoPlan(ctx);
    const report = runStressTest(plan, ctx);

    expect(report.rows).toHaveLength(6);
    expect(report.rows.map((r) => r.type)).toEqual(CHAOS_SCENARIO_CATALOG.map((c) => c.type));
    expect(typeof report.scoreBefore).toBe('number');

    // All rows on demo plan should be applicable
    for (const row of report.rows) {
      expect(row.applicable).toBe(true);
      expect(row.optionCount).toBeGreaterThan(0);
    }

    expect(report.weakestType).toBeDefined();
    expect(CHAOS_SCENARIO_CATALOG.map((c) => c.type)).toContain(report.weakestType);
  });
});
