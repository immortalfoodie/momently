import { describe, expect, it } from 'vitest';
import { buildDemoPlan } from '@/engine/demo';
import { engineContext } from '@/store/engineContext';
import { getDerivedMetrics } from '@/store/selectors';

describe('Selectors Memoization with WeakMap', () => {
  it('returns exact same reference for repeated calls with identical plan object', () => {
    const demo = buildDemoPlan(engineContext);
    const plan = demo.plan;

    const first = getDerivedMetrics(plan);
    const second = getDerivedMetrics(plan);

    expect(first).toBe(second);
    expect(first.budgetStatus).toBe(second.budgetStatus);
    expect(first.scoreRisks).toBe(second.scoreRisks);
    expect(first.findConflicts).toBe(second.findConflicts);
    expect(first.deriveGuestMetrics).toBe(second.deriveGuestMetrics);
  });

  it('recomputes fresh reference when a new plan object is provided', () => {
    const demo = buildDemoPlan(engineContext);
    const planA = demo.plan;
    const planB = {
      ...planA,
      version: planA.version + 1,
    };

    const first = getDerivedMetrics(planA);
    const second = getDerivedMetrics(planB);

    expect(first).not.toBe(second);
  });
});
