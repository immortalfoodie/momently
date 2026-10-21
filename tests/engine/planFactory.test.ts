import { describe, expect, it } from 'vitest';
import { DEMO_SCENARIO } from '@/data/demoScenario';
import { EVENT_TYPE_IDS } from '@/domain/constants';
import { eventPlanSchema } from '@/domain/schemas';
import type { Constraint, EventMeta } from '@/domain/types';
import { createPlan } from '@/engine/planFactory';
import { createIdFactory } from '@/lib/id';

describe('Plan Factory Engine', () => {
  const fixedClock = () => new Date('2026-10-21T12:00:00.000Z');

  it('fits the demo scenario (Mumbai, 80 guests, ₹1.5L cap) and records downgrades', () => {
    const ids = createIdFactory('demo_seed');
    const { plan, fit } = createPlan({
      meta: DEMO_SCENARIO.meta,
      constraints: DEMO_SCENARIO.constraints,
      ids,
      clock: fixedClock,
    });

    expect(fit.fits).toBe(true);
    expect(fit.cap).toBe(150000);
    expect(fit.total).toBeLessThanOrEqual(150000);
    expect(fit.downgrades.length).toBeGreaterThan(0);
    expect(() => eventPlanSchema.parse(plan)).not.toThrow();
  });

  it('fails fit cleanly when budget cap is impossibly low (₹20,000) and keeps all-essential plan', () => {
    const ids = createIdFactory('tight_seed');
    const tightConstraints: Constraint[] = [
      {
        id: 'c_impossible',
        kind: 'budget_cap',
        severity: 'hard',
        description: 'Impossibly low cap',
        numericValue: 20000,
      },
    ];

    const { plan, fit } = createPlan({
      meta: DEMO_SCENARIO.meta,
      constraints: tightConstraints,
      ids,
      clock: fixedClock,
    });

    expect(fit.fits).toBe(false);
    expect(fit.cap).toBe(20000);
    expect(fit.total).toBeGreaterThan(20000);
    expect(fit.message).toContain('Unable to fit all essential items');
    expect(() => eventPlanSchema.parse(plan)).not.toThrow();
  });

  it('produces valid EventPlans for all 4 event types', () => {
    for (const type of EVENT_TYPE_IDS) {
      const ids = createIdFactory(`type_${type}`);
      const meta: EventMeta = {
        title: `Test ${type}`,
        type,
        city: 'Bengaluru',
        guestCount: 100,
        setting: 'indoor',
        hostBrief: `Test brief for ${type}`,
      };

      const { plan, fit } = createPlan({
        meta,
        constraints: [],
        ids,
        clock: fixedClock,
      });

      expect(fit.fits).toBe(true);
      expect(() => eventPlanSchema.parse(plan)).not.toThrow();
      expect(plan.meta.type).toBe(type);
      expect(plan.budgetItems.length).toBeGreaterThan(0);
      expect(plan.schedule.length).toBeGreaterThan(0);
      expect(plan.tasks.length).toBeGreaterThan(0);
      expect(plan.vendors.length).toBeGreaterThan(0);
    }
  });

  it('produces completely deterministic output for identical inputs', () => {
    const idsA = createIdFactory('deterministic_seed');
    const idsB = createIdFactory('deterministic_seed');

    const resultA = createPlan({
      meta: DEMO_SCENARIO.meta,
      constraints: DEMO_SCENARIO.constraints,
      ids: idsA,
      clock: fixedClock,
    });

    const resultB = createPlan({
      meta: DEMO_SCENARIO.meta,
      constraints: DEMO_SCENARIO.constraints,
      ids: idsB,
      clock: fixedClock,
    });

    expect(resultA.plan).toEqual(resultB.plan);
    expect(resultA.fit).toEqual(resultB.fit);
  });
});
