import { describe, expect, it } from 'vitest';
import { simulateScenario } from '@/engine/chaos';
import { buildDemoPlan } from '@/engine/demo';
import { scoreRisks } from '@/engine/risk';
import { engineContext } from '@/store/engineContext';

describe('Demo Plan Rain Verification (TASK 4a)', () => {
  it('builds the demo plan with undecided setting, simulates rain, and produces valid recovery options within budget cap', () => {
    const demo = buildDemoPlan(engineContext);
    const plan = demo.plan;

    // 1. Assert meta.setting is "undecided"
    expect(plan.meta.setting).toBe('undecided');

    // Initial Chaos Score and band
    const initialRisk = scoreRisks(plan, engineContext);
    expect(initialRisk.band).toBe('manageable');
    expect(initialRisk.score).toBe(30);

    // 2. Simulate rain
    const rainResult = simulateScenario(plan, { type: 'rain' }, engineContext);

    // 3. Assert there are at least 2 options
    expect(rainResult.applicable).toBe(true);
    expect(rainResult.options.length).toBeGreaterThanOrEqual(2);

    // 4. Find the recommended option
    const recommended = rainResult.options.find((opt) => opt.id === rainResult.recommendedOptionId);
    expect(recommended).toBeDefined();

    // 5. Assert the recommended option meets the 1,50,000 cap
    expect(recommended!.meetsCap).toBe(true);
    const capConstraint = plan.constraints.find((c) => c.kind === 'budget_cap');
    expect(capConstraint?.numericValue).toBe(150000);

    // 6. Assert scoreAfter is lower than scoreBefore
    expect(recommended!.scoreAfter).toBeLessThan(rainResult.scoreBefore);
  });
});
