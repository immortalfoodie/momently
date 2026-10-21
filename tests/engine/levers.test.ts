import { describe, expect, it } from 'vitest';
import { DEMO_SCENARIO } from '@/data/demoScenario';
import type { BudgetItem, EventPlan } from '@/domain/types';
import { buildSavingLevers, qualityOfItem, stepItemQuality } from '@/engine/levers';
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

describe('Saving Levers Engine', () => {
  const fixedClock = () => new Date('2026-10-21T12:00:00.000Z');

  function makeBaseline(): EventPlan {
    const ids = createIdFactory('levers_seed');
    return createPlan({
      meta: DEMO_SCENARIO.meta,
      constraints: [], // unconstrained so items start at standard
      ids,
      clock: fixedClock,
      quality: 'standard',
    }).plan;
  }

  it('correctly extracts quality from item rateKey', () => {
    const item: BudgetItem = {
      id: 'i1',
      category: 'venue',
      label: 'Hall',
      basis: 'flat',
      unitCost: 1000,
      quantity: 1,
      provenance: 'estimate',
      locked: false,
      rateKey: 'venue_hall.standard',
    };
    expect(qualityOfItem(item)).toBe('standard');
    expect(qualityOfItem({ ...item, rateKey: 'venue_hall.premium' })).toBe('premium');
    expect(qualityOfItem({ ...item, rateKey: undefined })).toBeUndefined();
  });

  it('steps item quality down and up', () => {
    const plan = deepFreeze(makeBaseline());
    const decorItem = plan.budgetItems.find((i) => i.rateKey?.startsWith('decor_theme.'));
    expect(decorItem).toBeDefined();
    if (!decorItem) return;

    const stepDown = stepItemQuality(plan, decorItem, 'down');
    expect(stepDown).toBeDefined();
    expect(stepDown?.changes.rateKey).toBe('decor_theme.essential');
    expect(stepDown?.newTotal).toBeLessThan(decorItem.unitCost);

    const stepUp = stepItemQuality(plan, decorItem, 'up');
    expect(stepUp).toBeDefined();
    expect(stepUp?.changes.rateKey).toBe('decor_theme.premium');
    expect(stepUp?.newTotal).toBeGreaterThan(decorItem.unitCost);
  });

  it('never touches locked, user-provenance or contingency items', () => {
    const base = makeBaseline();
    const modifiedPlan = deepFreeze({
      ...base,
      budgetItems: base.budgetItems.map((i, idx) => {
        if (idx === 0) return { ...i, locked: true };
        if (idx === 1) return { ...i, provenance: 'user' as const };
        return i;
      }),
    });

    const levers = buildSavingLevers(modifiedPlan);
    const lockedId = modifiedPlan.budgetItems[0]?.id;
    const userId = modifiedPlan.budgetItems[1]?.id;

    expect(levers.some((l) => l.ops.some((op) => 'id' in op && op.id === lockedId))).toBe(
      false,
    );
    expect(levers.some((l) => l.ops.some((op) => 'id' in op && op.id === userId))).toBe(
      false,
    );
    expect(levers.some((l) => l.label.toLowerCase().includes('contingency'))).toBe(false);
  });

  it('excludes protected families from lever generation', () => {
    const plan = deepFreeze(makeBaseline());
    const venueItem = plan.budgetItems.find((i) => i.rateKey?.startsWith('venue_hall.'));
    expect(venueItem).toBeDefined();
    const venueId = venueItem?.id ?? '';

    const leversAll = buildSavingLevers(plan);
    const leversProtected = buildSavingLevers(plan, {
      protectedFamilies: ['venue_hall'],
    });

    expect(leversAll.some((l) => l.id.includes(venueId))).toBe(true);
    expect(leversProtected.some((l) => l.id.includes(venueId))).toBe(false);
  });

  it('orders levers deterministically: low impact first, then savings descending, then id', () => {
    const plan = deepFreeze(makeBaseline());
    const levers = buildSavingLevers(plan);

    const impactRank = { low: 0, medium: 1, high: 2 };
    for (let i = 1; i < levers.length; i++) {
      const prev = levers[i - 1];
      const curr = levers[i];
      if (!prev || !curr) continue;

      const rankDiff =
        impactRank[prev.experienceImpact] - impactRank[curr.experienceImpact];
      expect(rankDiff).toBeLessThanOrEqual(0);
      if (rankDiff === 0) {
        expect(prev.savings).toBeGreaterThanOrEqual(curr.savings);
      }
    }
  });
});
