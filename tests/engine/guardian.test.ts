import { describe, expect, it } from 'vitest';
import { DEMO_SCENARIO } from '@/data/demoScenario';
import type { BudgetItem, EventPlan } from '@/domain/types';
import { assessAddition, fundUpgrade, suggestSavings } from '@/engine/guardian';
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

describe('Budget Guardian Engine', () => {
  const fixedClock = () => new Date('2026-10-21T12:00:00.000Z');

  function makeBaseline(withCap = true): EventPlan {
    const ids = createIdFactory('guardian_seed');
    return createPlan({
      meta: DEMO_SCENARIO.meta,
      constraints: withCap ? DEMO_SCENARIO.constraints : [],
      ids,
      clock: fixedClock,
      quality: 'standard',
    }).plan;
  }

  it('assesses addition accurately with and without a budget cap', () => {
    const planWithCap = deepFreeze(makeBaseline(true));
    const ids = createIdFactory('assess_test');
    const newItem: Omit<BudgetItem, 'id'> = {
      category: 'entertainment',
      label: 'Photo Booth',
      basis: 'flat',
      unitCost: 20000,
      quantity: 1,
      provenance: 'estimate',
      locked: false,
    };

    const resWithCap = assessAddition(planWithCap, newItem, { ids, clock: fixedClock });
    expect(resWithCap.fits).toBe(false);
    expect(resWithCap.overBy).toBeGreaterThan(0);
    expect(resWithCap.newTotal).toBeGreaterThan(150000);

    const planNoCap = deepFreeze(makeBaseline(false));
    const resNoCap = assessAddition(planNoCap, newItem, { ids, clock: fixedClock });
    expect(resNoCap.fits).toBe(true);
    expect(resNoCap.overBy).toBe(0);
  });

  it('suggests savings meeting a ₹15,000 target with distinct strategies', () => {
    const plan = deepFreeze(makeBaseline(false));
    const ids = createIdFactory('savings_test');
    const plans = suggestSavings(plan, 15000, {}, { ids, clock: fixedClock });

    expect(plans.length).toBeGreaterThan(0);
    const metPlan = plans.find((p) => p.met);
    expect(metPlan).toBeDefined();
    expect(metPlan?.achieved).toBeGreaterThanOrEqual(15000);
    expect(metPlan?.shortfall).toBe(0);

    // Verify distinct strategies
    const idsSet = new Set(plans.map((p) => p.id));
    expect(idsSet.size).toBe(plans.length);
  });

  it('reports met=false with correct shortfall when target is impossibly high', () => {
    const plan = deepFreeze(makeBaseline(false));
    const ids = createIdFactory('impossible_savings');
    const plans = suggestSavings(plan, 999999, {}, { ids, clock: fixedClock });

    expect(plans.length).toBeGreaterThan(0);
    for (const p of plans) {
      expect(p.met).toBe(false);
      expect(p.shortfall).toBe(999999 - p.achieved);
    }
  });

  it('evaluates fundUpgrade: fits, needs_funding, and cannot_fund', () => {
    const ids = createIdFactory('upgrade_test');

    // 1. Fits within generous cap
    const planGenerous = createPlan({
      meta: DEMO_SCENARIO.meta,
      constraints: [
        {
          id: 'c_gen',
          kind: 'budget_cap',
          severity: 'hard',
          numericValue: 500000,
          description: 'Generous',
        },
      ],
      ids,
      clock: fixedClock,
      quality: 'standard',
    }).plan;

    const resFits = fundUpgrade(
      planGenerous,
      { family: 'decor_theme', toQuality: 'premium' },
      { ids, clock: fixedClock },
    );
    expect(resFits.verdict).toBe('fits');
    expect(resFits.shortfall).toBe(0);

    // 2. Needs funding under tight cap
    const planTight = createPlan({
      meta: DEMO_SCENARIO.meta,
      constraints: [
        {
          id: 'c_tight',
          kind: 'budget_cap',
          severity: 'hard',
          numericValue: 150000,
          description: 'Tight',
        },
      ],
      ids,
      clock: fixedClock,
      quality: 'standard',
    }).plan;

    const resNeedsFunding = fundUpgrade(
      planTight,
      { family: 'decor_theme', toQuality: 'premium' },
      { ids, clock: fixedClock },
    );
    expect(resNeedsFunding.verdict).toBe('needs_funding');
    expect(resNeedsFunding.shortfall).toBeGreaterThan(0);
    expect(resNeedsFunding.fundingOptions.length).toBeGreaterThan(0);

    // 3. Cannot fund when even stepping down everything fails
    const planImpossiblyTight = createPlan({
      meta: DEMO_SCENARIO.meta,
      constraints: [
        {
          id: 'c_imp',
          kind: 'budget_cap',
          severity: 'hard',
          numericValue: 100000,
          description: 'Impossible',
        },
      ],
      ids,
      clock: fixedClock,
      quality: 'essential',
    }).plan;

    const resCannot = fundUpgrade(
      planImpossiblyTight,
      { family: 'decor_theme', toQuality: 'premium' },
      { ids, clock: fixedClock },
    );
    expect(resCannot.verdict).toBe('cannot_fund');
    expect(resCannot.message).toContain('cannot fund this upgrade');
  });
});
