import { beforeEach, describe, expect, it } from 'vitest';
import { simulateScenario } from '@/engine/chaos';
import { buildDemoPlan } from '@/engine/demo';
import { scoreRisks } from '@/engine/risk';
import { createIdFactory } from '@/lib/id';
import { useEventsStore } from '@/store/eventsStore';

const ctx = {
  ids: createIdFactory('chaos_journey_test'),
  clock: () => new Date('2026-10-22T12:00:00.000Z'),
};

describe('Integration: Chaos Lab Journey (TASK 4)', () => {
  beforeEach(() => {
    useEventsStore.setState({ events: {}, order: [], hydrated: true });
  });

  it('runs demo plan -> rain -> approve -> re-simulating rain on the updated plan reports lower exposure', () => {
    const demo = buildDemoPlan(ctx);
    const eventId = useEventsStore.getState().createEvent(demo.plan, {
      assumptions: demo.assumptions,
    });

    const initialPlan = useEventsStore.getState().events[eventId]!.plan;
    const initialScore = scoreRisks(initialPlan, ctx).score;

    // 1. Simulate rain on baseline plan
    const rainResult1 = simulateScenario(initialPlan, { type: 'rain' }, ctx);
    expect(rainResult1.applicable).toBe(true);
    expect(rainResult1.options.length).toBeGreaterThanOrEqual(2);

    const recommended = rainResult1.options.find(
      (o) => o.id === rainResult1.recommendedOptionId,
    );
    expect(recommended).toBeDefined();
    expect(recommended!.scoreAfter).toBeLessThan(initialScore);

    // 2. Approve the recommended rain recovery option
    const approveRes = useEventsStore.getState().approveAndApply(
      eventId,
      recommended!.patch,
      { basedOnVersion: initialPlan.version },
    );
    expect(approveRes.ok).toBe(true);

    // 3. Re-simulate rain on the approved plan
    const updatedPlan = useEventsStore.getState().events[eventId]!.plan;
    expect(updatedPlan.version).toBe(initialPlan.version + 1);

    const updatedScore = scoreRisks(updatedPlan, ctx).score;
    expect(updatedScore).toBeLessThan(initialScore);

    const rainResult2 = simulateScenario(updatedPlan, { type: 'rain' }, ctx);
    // Since rain protection (weather cover canopy) is now present in budgetItems, rain exposure is resolved
    expect(rainResult2.scoreBefore).toBe(updatedScore);
    expect(rainResult2.scoreBefore).toBeLessThan(initialScore);
  });
});
