import { describe, expect, it } from 'vitest';
import { scenarioAvailability } from '@/engine/chaos';
import { buildDemoPlan } from '@/engine/demo';
import { scoreRisks } from '@/engine/risk';
import { buildScheduleView } from '@/engine/scheduleView';
import { createIdFactory } from '@/lib/id';

describe('Engine: Demo Plan Builder', () => {
  const fixedClock = () => new Date('2026-10-21T12:00:00.000Z');

  it('builds the demo celebration plan deterministically without network', () => {
    const ids = createIdFactory('demo_test');
    const ctx = { ids, clock: fixedClock };

    const result = buildDemoPlan(ctx);

    expect(result.plan).toBeDefined();
    expect(result.plan.meta.title).toBe("Parents' 25th Anniversary");
    expect(result.plan.meta.city).toBe('Mumbai');
    expect(result.plan.meta.dateIso).toBe('2026-12-15');
    expect(result.plan.meta.guestCount).toBe(80);
    expect(result.plan.meta.hostBrief).toBeDefined();
    expect(result.plan.meta.hostBrief?.length).toBeGreaterThan(10);

    // Concepts attached
    expect(result.plan.concepts).toHaveLength(3);
    expect(result.plan.selectedConceptId).toBeNull();

    // Fit report and assumptions
    expect(result.fit).toBeDefined();
    expect(result.fit.fits).toBe(true);
    expect(result.assumptions).toEqual([]);
  });

  it('verifies demo plan schedule slack >= 30, empty schedule warnings, Chaos Score 30, and rain scenario applicable', () => {
    const ids = createIdFactory('demo_test');
    const ctx = { ids, clock: fixedClock };
    const result = buildDemoPlan(ctx);

    const risks = scoreRisks(result.plan, ctx);
    const scheduleView = buildScheduleView(result.plan);

    // Chaos score is 30 (down from 40 before schedule buffer fixes)
    expect(risks.score).toBe(30);
    expect(risks.band).toBe('manageable');

    // Total schedule slack is >= 30 and no warnings
    expect(scheduleView.totalSlackMinutes).toBeGreaterThanOrEqual(30);
    expect(scheduleView.warnings).toEqual([]);

    // Concept remains undecided and rain scenario is available
    expect(result.plan.selectedConceptId).toBeNull();
    const rainAvail = scenarioAvailability(result.plan, 'rain');
    expect(rainAvail.available).toBe(true);
  });
});
