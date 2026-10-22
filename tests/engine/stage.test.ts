import { describe, expect, it } from 'vitest';
import { DEMO_SCENARIO } from '@/data/demoScenario';
import { createPlan } from '@/engine/planFactory';
import { eventStage } from '@/engine/stage';
import { createIdFactory } from '@/lib/id';
import { deepFreeze } from '../helpers/deepFreeze';

describe('Engine: Event Stage Derivation', () => {
  const fixedClock = () => new Date('2026-10-21T12:00:00.000Z');

  function makeBaseline() {
    const ids = createIdFactory('stage_seed');
    const { plan } = createPlan({
      meta: DEMO_SCENARIO.meta,
      constraints: DEMO_SCENARIO.constraints,
      ids,
      clock: fixedClock,
    });
    return plan;
  }

  it('derives draft stage when no concept is selected', () => {
    const plan = deepFreeze({
      ...makeBaseline(),
      selectedConceptId: null,
      meta: {
        ...DEMO_SCENARIO.meta,
        dateIso: '2026-12-15',
      },
    });

    expect(eventStage(plan, '2026-10-21')).toBe('draft');
  });

  it('derives planning stage when concept is selected and celebration is in the future', () => {
    const plan = deepFreeze({
      ...makeBaseline(),
      selectedConceptId: 'concept_vintage_bollywood',
      meta: {
        ...DEMO_SCENARIO.meta,
        dateIso: '2026-12-15',
      },
    });

    expect(eventStage(plan, '2026-10-21')).toBe('planning');
  });

  it('derives completed stage when dateIso is in the past regardless of concept selection', () => {
    const planWithConcept = deepFreeze({
      ...makeBaseline(),
      selectedConceptId: 'concept_vintage_bollywood',
      meta: {
        ...DEMO_SCENARIO.meta,
        dateIso: '2025-05-10',
      },
    });

    expect(eventStage(planWithConcept, '2026-10-21')).toBe('completed');

    const planWithoutConcept = deepFreeze({
      ...makeBaseline(),
      selectedConceptId: null,
      meta: {
        ...DEMO_SCENARIO.meta,
        dateIso: '2025-05-10',
      },
    });

    expect(eventStage(planWithoutConcept, '2026-10-21')).toBe('completed');
  });
});
