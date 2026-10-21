import { describe, expect, it } from 'vitest';
import { DEMO_SCENARIO } from '@/data/demoScenario';
import { conceptSchema, constraintSchema, eventMetaSchema } from '@/domain/schemas';

describe('Demo Scenario Data Layer', () => {
  it('validates meta, constraints, and concepts against domain schemas', () => {
    expect(() => eventMetaSchema.parse(DEMO_SCENARIO.meta)).not.toThrow();

    for (const constraint of DEMO_SCENARIO.constraints) {
      expect(() => constraintSchema.parse(constraint)).not.toThrow();
    }

    for (const concept of DEMO_SCENARIO.concepts) {
      expect(() => conceptSchema.parse(concept)).not.toThrow();
    }
  });

  it('ensures every concept estimated total is within the hard budget cap', () => {
    const hardCapConstraint = DEMO_SCENARIO.constraints.find(
      (c) => c.kind === 'budget_cap' && c.severity === 'hard',
    );
    expect(hardCapConstraint).toBeDefined();
    expect(hardCapConstraint?.numericValue).toBe(150000);

    const cap = hardCapConstraint?.numericValue ?? 150000;

    expect(DEMO_SCENARIO.concepts).toHaveLength(3);
    for (const concept of DEMO_SCENARIO.concepts) {
      expect(concept.estimatedTotal).toBeLessThanOrEqual(cap);
    }

    const estimatedTotals = DEMO_SCENARIO.concepts.map((c) => c.estimatedTotal);
    expect(estimatedTotals).toContain(138000);
    expect(estimatedTotals).toContain(149000);
    expect(estimatedTotals).toContain(126000);
  });

  it('verifies demo scenario meta matches 25th anniversary in Mumbai', () => {
    expect(DEMO_SCENARIO.meta.type).toBe('anniversary');
    expect(DEMO_SCENARIO.meta.city).toBe('Mumbai');
    expect(DEMO_SCENARIO.meta.guestCount).toBe(80);
    expect(DEMO_SCENARIO.meta.dateIso).toBe('2026-12-15');
    expect(DEMO_SCENARIO.meta.setting).toBe('undecided');
    expect(DEMO_SCENARIO.hostBrief).toContain('25th anniversary');
  });

  it('verifies all 6 scripted demo steps exist in proper sequence', () => {
    expect(DEMO_SCENARIO.scriptedSteps).toHaveLength(6);

    const stepIds = DEMO_SCENARIO.scriptedSteps.map((s) => s.id);
    expect(stepIds).toEqual([
      'step_1_intake',
      'step_2_select_concept',
      'step_3_upgrade_decor',
      'step_4_increase_guests',
      'step_5_rain_contingency',
      'step_6_final_checklist',
    ]);
  });
});
