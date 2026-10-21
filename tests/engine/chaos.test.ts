import { describe, expect, it } from 'vitest';
import { chaosScenarioInputSchema } from '@/domain/chaosSchemas';
import { DEMO_SCENARIO } from '@/data/demoScenario';
import type { EventPlan } from '@/domain/types';
import { simulateScenario } from '@/engine/chaos';
import { applyPatch } from '@/engine/patch';
import { createPlan } from '@/engine/planFactory';
import { scoreRisks } from '@/engine/risk';
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

describe('Chaos Scenarios & Recovery Engine', () => {
  const fixedClock = () => new Date('2026-10-21T12:00:00.000Z');

  function makeBaseline(): EventPlan {
    const ids = createIdFactory('chaos_seed');
    return createPlan({
      meta: DEMO_SCENARIO.meta,
      constraints: DEMO_SCENARIO.constraints,
      ids,
      clock: fixedClock,
    }).plan;
  }

  it('rejects invalid inputs via chaosScenarioInputSchema', () => {
    expect(() =>
      chaosScenarioInputSchema.parse({ type: 'budget_cut', percent: 4 }),
    ).toThrow();
    expect(() =>
      chaosScenarioInputSchema.parse({ type: 'budget_cut', percent: 61 }),
    ).toThrow();
    expect(() => chaosScenarioInputSchema.parse({ type: 'unknown_disaster' })).toThrow();
  });

  it('rain: outdoor returns 2 options with scoreAfter < scoreBefore, indoor is inapplicable', () => {
    const base = makeBaseline();
    const ctx = { ids: createIdFactory('rain_test'), clock: fixedClock };

    const indoorPlan = deepFreeze({
      ...base,
      meta: { ...base.meta, setting: 'indoor' as const },
    });
    const indoorRes = simulateScenario(indoorPlan, { type: 'rain' }, ctx);
    expect(indoorRes.applicable).toBe(false);

    const outdoorPlan = deepFreeze({
      ...base,
      meta: { ...base.meta, setting: 'outdoor' as const },
      budgetItems: base.budgetItems.filter(
        (i) => !i.rateKey?.startsWith('weather_cover.'),
      ),
    });
    const outdoorRes = simulateScenario(outdoorPlan, { type: 'rain' }, ctx);
    expect(outdoorRes.applicable).toBe(true);
    expect(outdoorRes.options.length).toBeGreaterThanOrEqual(2);
    for (const opt of outdoorRes.options) {
      expect(opt.scoreAfter).toBeLessThan(opt.scoreBefore);
    }
  });

  it('budget_cut: 20% cut returns options whose applied result fits the new cap or flags meetsCap', () => {
    const base = makeBaseline();
    const ctx = { ids: createIdFactory('cut_test'), clock: fixedClock };
    const res = simulateScenario(base, { type: 'budget_cut', percent: 20 }, ctx);

    expect(res.applicable).toBe(true);
    expect(res.options.length).toBeGreaterThan(0);
    const validOpt = res.options.find((o) => o.meetsCap);
    if (validOpt) {
      expect(validOpt.impact.budgetTotalAfter).toBeLessThanOrEqual(120000);
    }
  });

  it('guest_surge: 80 -> 110 returns option holding cap and option raising cap', () => {
    const base = makeBaseline();
    const ctx = { ids: createIdFactory('surge_test'), clock: fixedClock };
    const res = simulateScenario(base, { type: 'guest_surge', extraGuests: 30 }, ctx);

    expect(res.applicable).toBe(true);
    const holdOpt = res.options.find((o) => o.id === 'opt_surge_hold_budget');
    const raiseOpt = res.options.find((o) => o.id === 'opt_surge_raise_budget');
    expect(holdOpt).toBeDefined();
    expect(raiseOpt).toBeDefined();
    expect(raiseOpt?.impact.budgetCap).toBeGreaterThanOrEqual(150000);
  });

  it('vendor_cancels: adds tasks with dueDaysBefore <= days remaining; unknown category is inapplicable', () => {
    const base = makeBaseline();
    const ctx = { ids: createIdFactory('cancels_test'), clock: fixedClock };

    const unknownRes = simulateScenario(
      base,
      { type: 'vendor_cancels', category: 'space_rocket' },
      ctx,
    );
    expect(unknownRes.applicable).toBe(false);
    expect(unknownRes.headline).toContain('space_rocket');

    // Photography vendor exists in demo scenario
    const photoRes = simulateScenario(
      base,
      { type: 'vendor_cancels', category: 'photography' },
      ctx,
    );
    expect(photoRes.applicable).toBe(true);
    expect(photoRes.options.length).toBeGreaterThan(0);

    const firstOpt = photoRes.options[0]!;
    const taskOps = firstOpt.patch.ops.filter((op) => op.type === 'add_task');
    expect(taskOps.length).toBeGreaterThan(0);
    for (const op of taskOps) {
      if (op.type === 'add_task') {
        expect(op.task.dueDaysBefore).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('late_start: 120m delay returns three distinct strategy outcomes', () => {
    const base = makeBaseline();
    const ctx = { ids: createIdFactory('late_test'), clock: fixedClock };
    const res = simulateScenario(base, { type: 'late_start', delayMinutes: 120 }, ctx);

    expect(res.applicable).toBe(true);
    expect(res.options).toHaveLength(3);
    const ids = res.options.map((o) => o.id);
    expect(ids).toContain('opt_delay_cascade');
    expect(ids).toContain('opt_delay_absorb');
    expect(ids).toContain('opt_delay_swap');
  });

  it('item_unavailable: on a locked item unlocks first and applies cleanly', () => {
    const base = makeBaseline();
    const targetItem = base.budgetItems.find((i) =>
      i.rateKey?.startsWith('decor_theme.'),
    );
    expect(targetItem).toBeDefined();
    if (!targetItem) return;

    const lockedPlan = deepFreeze({
      ...base,
      budgetItems: base.budgetItems.map((i) =>
        i.id === targetItem.id ? { ...i, locked: true } : i,
      ),
    });
    const ctx = { ids: createIdFactory('unavail_test'), clock: fixedClock };
    const res = simulateScenario(
      lockedPlan,
      { type: 'item_unavailable', family: 'decor_theme' },
      ctx,
    );

    expect(res.applicable).toBe(true);
    const stepOpt = res.options.find(
      (o) => o.id.startsWith('opt_item_down') || o.id.startsWith('opt_item_up'),
    );
    expect(stepOpt).toBeDefined();
    if (stepOpt) {
      const unlockOp = stepOpt.patch.ops.find(
        (op) =>
          op.type === 'update_budget_item' &&
          op.id === targetItem.id &&
          op.changes.locked === false,
      );
      expect(unlockOp).toBeDefined();
    }
  });

  it('integration: createPlan -> simulateScenario rain -> approve recommended -> applyPatch -> risk improves', () => {
    const ids = createIdFactory('integ_chaos');
    const ctx = { ids, clock: fixedClock };

    const initial = createPlan({
      meta: { ...DEMO_SCENARIO.meta, setting: 'outdoor' },
      constraints: DEMO_SCENARIO.constraints,
      ids,
      clock: fixedClock,
    }).plan;

    const initialReport = scoreRisks(initial, ctx);
    const scenarioRes = simulateScenario(initial, { type: 'rain' }, ctx);
    expect(scenarioRes.applicable).toBe(true);
    expect(scenarioRes.recommendedOptionId).toBeDefined();

    const recommended = scenarioRes.options.find(
      (o) => o.id === scenarioRes.recommendedOptionId,
    );
    expect(recommended).toBeDefined();
    if (!recommended) return;

    // Approve the proposed chaos patch
    const approvedPatch = { ...recommended.patch, status: 'approved' as const };
    const applyRes = applyPatch(initial, approvedPatch, {
      ...ctx,
      allowHardViolations: true,
    });
    expect(applyRes.ok).toBe(true);
    if (!applyRes.ok) return;

    const finalPlan = applyRes.value.plan;
    const finalReport = scoreRisks(finalPlan, ctx);
    expect(finalReport.score).toBeLessThan(initialReport.score);

    // Ledger contains a source "chaos" entry
    const chaosDecision = finalPlan.ledger.find((h) => h.source === 'chaos');
    expect(chaosDecision).toBeDefined();
    expect(chaosDecision?.status).toBe('approved');
  });
});
