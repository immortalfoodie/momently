import { describe, expect, it } from 'vitest';
import { DEMO_SCENARIO } from '@/data/demoScenario';
import { createPlan } from '@/engine/planFactory';
import { createIdFactory } from '@/lib/id';
import { summarizePlanForLlm } from '@/llm/context';
import { mockIntentSteps, splitClauses } from '@/llm/mock/mockIntentSteps';
import {
  intentTaskOutputSchema,
  toIntentSteps,
  type IntentInput,
} from '@/llm/schemas/intent';

function input(message: string): IntentInput {
  const { plan } = createPlan({
    meta: DEMO_SCENARIO.meta,
    constraints: DEMO_SCENARIO.constraints,
    ids: createIdFactory('mock_steps'),
    clock: () => new Date('2026-10-21T12:00:00.000Z'),
  });
  return { message, planSummary: summarizePlanForLlm(plan), recentMessages: [] };
}

describe('LLM: compound intent mock', () => {
  it('splits on "and" only before an action verb', () => {
    expect(splitClauses('Upgrade the decor and what if it rains')).toEqual(['Upgrade the decor', 'what if it rains']);
    expect(splitClauses('Old Bollywood songs and good food')).toEqual(['Old Bollywood songs and good food']);
  });

  it('returns steps for a two-part request', () => {
    const out = mockIntentSteps(input('Add 20 more guests and what if it rains'));
    expect('steps' in out).toBe(true);
    const steps = toIntentSteps(out);
    expect(steps.map((s) => s.kind)).toEqual(['change_guest_count', 'simulate']);
  });

  it('keeps single requests as a plain intent', () => {
    const out = mockIntentSteps(input('What if it rains?'));
    expect('steps' in out).toBe(false);
    expect(toIntentSteps(out)).toHaveLength(1);
  });

  it('caps compound requests at three steps and validates against the task schema', () => {
    const out = mockIntentSteps(
      input('Add 10 more guests, then what if it rains, also find forgotten costs, and save ₹5000'),
    );
    expect(toIntentSteps(out).length).toBeLessThanOrEqual(3);
    expect(intentTaskOutputSchema.safeParse(out).success).toBe(true);
  });

  it('rejects an empty or oversized steps list', () => {
    expect(intentTaskOutputSchema.safeParse({ steps: [] }).success).toBe(false);
    const four = Array.from({ length: 4 }, () => ({ kind: 'find_forgotten' }));
    expect(intentTaskOutputSchema.safeParse({ steps: four }).success).toBe(false);
  });
});
