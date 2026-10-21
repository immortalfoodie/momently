import { describe, expect, it } from 'vitest';
import { DEMO_SCENARIO } from '@/data/demoScenario';
import { createPlan } from '@/engine/planFactory';
import { createIdFactory } from '@/lib/id';
import { planSummarySchema, summarizePlanForLlm } from '@/llm/context';

describe('LLM Context Summarizer', () => {
  const fixedClock = () => new Date('2026-10-21T12:00:00.000Z');

  function makeTestPlan() {
    const ids = createIdFactory('context_seed');
    const { plan } = createPlan({
      meta: DEMO_SCENARIO.meta,
      constraints: DEMO_SCENARIO.constraints,
      ids,
      clock: fixedClock,
    });
    return plan;
  }

  it('extracts ids, locked flags, and rate families onto budget items', () => {
    const plan = makeTestPlan();
    const summary = summarizePlanForLlm(plan);

    expect(summary.budgetItems.length).toBeGreaterThan(0);
    for (const item of summary.budgetItems) {
      expect(item.id).toBeDefined();
      expect(typeof item.locked).toBe('boolean');
      expect(typeof item.family).toBe('string');
      expect(item.family.length).toBeGreaterThan(0);
      expect(typeof item.total).toBe('number');
      expect(item.total).toBeGreaterThan(0);
    }

    // Verify budget totals
    expect(summary.budgetStatus.cap).toBe(150000);
    expect(summary.budgetStatus.total).toBeGreaterThan(0);
    expect(summary.budgetStatus.remaining).toBeDefined();
    expect(summary.budgetStatus.overCap).toBe(false);

    // Schema conformance
    expect(() => planSummarySchema.parse(summary)).not.toThrow();
  });

  it('enforces character budget cap by shedding lowest-value budget items first', () => {
    const plan = makeTestPlan();
    const unconstrained = summarizePlanForLlm(plan, { maxChars: 50000 });
    const fullLength = JSON.stringify(unconstrained).length;
    expect(unconstrained.truncated).toBe(false);

    // Constrain to slightly below full length
    const targetCap = fullLength - 300;
    const constrained = summarizePlanForLlm(plan, { maxChars: targetCap });
    expect(constrained.truncated).toBe(true);
    expect(constrained.budgetItems.length).toBeLessThan(unconstrained.budgetItems.length);

    const serialized = JSON.stringify(constrained);
    expect(serialized.length).toBeLessThanOrEqual(targetCap);
  });

  it('does not leak guest names or personal PII, containing only aggregate counts', () => {
    const plan = makeTestPlan();
    const summary = summarizePlanForLlm(plan);

    // Guest needs must be numerical counters, not names
    expect(typeof summary.guestNeeds.vegetarian).toBe('number');
    expect(typeof summary.guestNeeds.jain).toBe('number');
    expect(typeof summary.guestNeeds.wheelchairUsers).toBe('number');

    // Only expected fields
    const parsed = planSummarySchema.parse(summary);
    expect(parsed.meta.guestCount).toBe(80);
    expect(parsed.hardConstraints).toBeDefined();
    expect(parsed.allowedFamilies).toContain('venue_hall');
    expect(parsed.allowedFamilies).toContain('catering_buffet');
  });
});
