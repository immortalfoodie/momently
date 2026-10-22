import { describe, expect, it } from 'vitest';
import { buildDemoPlan } from '@/engine/demo';
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
});
