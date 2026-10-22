import { describe, expect, it } from 'vitest';
import { DEMO_SCENARIO } from '@/data/demoScenario';
import { createPlan } from '@/engine/planFactory';
import { replaceConcepts } from '@/engine/replaceConcepts';
import { createIdFactory } from '@/lib/id';
import { deepFreeze } from '../helpers/deepFreeze';

describe('Engine: Replace Concepts', () => {
  const fixedClock = () => new Date('2026-10-21T12:00:00.000Z');

  function makeBaseline() {
    const ids = createIdFactory('concept_seed');
    const { plan } = createPlan({
      meta: DEMO_SCENARIO.meta,
      constraints: DEMO_SCENARIO.constraints,
      ids,
      clock: fixedClock,
    });
    return plan;
  }

  it('sets concepts, keeps selectedConceptId if present, increments version, and appends ledger record', () => {
    const basePlan = makeBaseline();
    const existingConcept = DEMO_SCENARIO.concepts[0]!;
    const plan = deepFreeze({
      ...basePlan,
      concepts: [existingConcept],
      selectedConceptId: existingConcept.id,
    });

    const ids = createIdFactory('replace_ctx');
    const ctx = { ids, clock: fixedClock };

    const newConcepts = [
      existingConcept,
      DEMO_SCENARIO.concepts[1]!,
    ];

    const updated = replaceConcepts(plan, newConcepts, ctx);

    expect(updated.concepts).toHaveLength(2);
    expect(updated.selectedConceptId).toBe(existingConcept.id);
    expect(updated.version).toBe(plan.version + 1);
    expect(updated.updatedAt).toBe('2026-10-21T12:00:00.000Z');
    expect(updated.budgetItems).toEqual(plan.budgetItems); // Budget unchanged!

    const lastDecision = updated.ledger[updated.ledger.length - 1];
    expect(lastDecision?.summary).toBe('Refreshed concept ideas');
    expect(lastDecision?.source).toBe('user');
    expect(lastDecision?.status).toBe('approved');
  });

  it('clears selectedConceptId if the previously selected concept is not in the new set', () => {
    const basePlan = makeBaseline();
    const plan = deepFreeze({
      ...basePlan,
      concepts: [DEMO_SCENARIO.concepts[0]!],
      selectedConceptId: 'old_concept_not_in_new_list',
    });

    const ids = createIdFactory('replace_ctx');
    const ctx = { ids, clock: fixedClock };

    const newConcepts = [
      DEMO_SCENARIO.concepts[1]!,
      DEMO_SCENARIO.concepts[2]!,
    ];

    const updated = replaceConcepts(plan, newConcepts, ctx);

    expect(updated.concepts).toHaveLength(2);
    expect(updated.selectedConceptId).toBeNull();
    expect(updated.version).toBe(plan.version + 1);
  });
});
