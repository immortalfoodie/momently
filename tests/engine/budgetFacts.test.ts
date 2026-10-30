import { describe, expect, it } from 'vitest';
import type { EventPlan } from '@/domain/types';
import { getBudgetStatus } from '@/engine/budget';
import { buildBudgetFacts } from '@/engine/budgetFacts';
import { buildDemoPlan } from '@/engine/demo';
import { createIdFactory } from '@/lib/id';
import { mockNarrate } from '@/llm/mock/mockNarrate';
import { narrateInputSchema } from '@/llm/schemas/narrate';
import { deepFreeze } from '../helpers/deepFreeze';

function demoPlan(): EventPlan {
  return buildDemoPlan({
    ids: createIdFactory('budget_facts'),
    clock: () => new Date('2026-10-22T10:00:00.000Z'),
  }).plan;
}

describe('Engine: budget facts for the explainer', () => {
  it('reports engine totals exactly and fits the narrate input schema', () => {
    const plan = deepFreeze(demoPlan());
    const facts = buildBudgetFacts(plan);
    const status = getBudgetStatus(plan);

    expect(facts.totalCost).toBe(status.total);
    expect(facts.guestCount).toBe(plan.meta.guestCount);
    expect(narrateInputSchema.safeParse({ purpose: 'budget_explainer', facts }).success).toBe(true);
  });

  it('lists the biggest categories first', () => {
    const facts = buildBudgetFacts(demoPlan());
    expect(typeof facts.category_1).toBe('string');
    if (typeof facts.category_2_amount === 'number') {
      expect(facts.category_1_amount as number).toBeGreaterThanOrEqual(facts.category_2_amount);
    }
  });

  it('reports the amount over the cap when the plan overspends', () => {
    const plan = demoPlan();
    const overspent: EventPlan = {
      ...plan,
      constraints: plan.constraints.map((c) => (c.kind === 'budget_cap' ? { ...c, numericValue: 1000 } : c)),
    };
    const facts = buildBudgetFacts(overspent);
    expect(facts.overCap).toBe(true);
    expect(facts.amountOverCap).toBe((facts.totalCost as number) - 1000);
    expect(facts.amountUnderCap).toBeUndefined();
  });

  it('feeds the offline narrator a grounded summary', () => {
    const facts = buildBudgetFacts(demoPlan());
    const out = mockNarrate({ purpose: 'budget_explainer', facts });
    const total = new Intl.NumberFormat('en-IN').format(facts.totalCost as number);
    expect(out.text).toContain(`₹${total}`);
    expect(out.highlights.some((h) => h.startsWith('Biggest spend:'))).toBe(true);
  });
});
