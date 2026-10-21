import { describe, expect, it } from 'vitest';
import { DEMO_SCENARIO } from '@/data/demoScenario';
import type { EventPlan } from '@/domain/types';
import { budgetTotal, getBudgetCap } from '@/engine/budget';
import { rebalanceForImpact } from '@/engine/impactRebalance';
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

describe('Impact Rebalancing Engine', () => {
  const fixedClock = () => new Date('2026-10-21T12:00:00.000Z');

  function makeBaseline(): EventPlan {
    const ids = createIdFactory('rebalance_seed');
    return createPlan({
      meta: DEMO_SCENARIO.meta,
      constraints: DEMO_SCENARIO.constraints,
      ids,
      clock: fixedClock,
      quality: 'standard',
    }).plan;
  }

  it('ensures net cost never exceeds the original budget total or hard cap', () => {
    const plan = deepFreeze(makeBaseline());
    const ids = createIdFactory('rebalance_exec');
    const originalTotal = budgetTotal(plan.budgetItems, plan.meta.guestCount);
    const cap = getBudgetCap(plan.constraints);

    const result = rebalanceForImpact(plan, { ids, clock: fixedClock });
    if (result.changed) {
      expect(result.netCostChange).toBeLessThanOrEqual(0);
      expect(result.upgraded.length).toBeGreaterThan(0);
      if (cap !== null) {
        expect(originalTotal + result.netCostChange).toBeLessThanOrEqual(cap);
      }
    } else {
      expect(result.ops).toHaveLength(0);
      expect(result.message).toContain('No impact rebalance opportunities');
    }
  });

  it('returns changed=false when all high-impact items are already premium and cannot be improved', () => {
    const base = makeBaseline();
    const allMaxedPlan = deepFreeze({
      ...base,
      budgetItems: base.budgetItems.map((i) => {
        if (
          i.rateKey?.startsWith('decor_theme.') ||
          i.rateKey?.startsWith('entertainment_music.') ||
          i.rateKey?.startsWith('photo_video.')
        ) {
          const family = i.rateKey.split('.')[0];
          return { ...i, rateKey: `${family}.premium` };
        }
        return i;
      }),
    });

    const ids = createIdFactory('maxed_test');
    const result = rebalanceForImpact(allMaxedPlan, { ids, clock: fixedClock });
    expect(result.changed).toBe(false);
    expect(result.ops).toHaveLength(0);
    expect(result.netCostChange).toBe(0);
  });
});
