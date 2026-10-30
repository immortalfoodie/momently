import type { EventPlan } from '@/domain/types';
import type { FactValue } from '@/llm/schemas/narrate';
import { categoryTotals, getBudgetStatus, provenanceBreakdown } from './budget';

/**
 * Builds verified budget facts for the narrate task's budget explainer.
 * WHY: The language model only rephrases these engine-computed numbers; it never adds, prices
 * or rounds anything itself. Stays well under the 30-fact limit.
 *
 * @param plan - Active EventPlan.
 * @returns Flat record of numbers and labels describing the current budget.
 */
export function buildBudgetFacts(plan: EventPlan): Record<string, FactValue> {
  const status = getBudgetStatus(plan);
  const guests = plan.meta.guestCount;
  const totals = Object.entries(categoryTotals(plan.budgetItems, guests))
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1]);
  const provenance = provenanceBreakdown(plan.budgetItems, guests);

  const facts: Record<string, FactValue> = {
    title: plan.meta.title,
    eventType: plan.meta.type,
    guestCount: guests,
    totalCost: status.total,
    costPerGuest: guests > 0 ? Math.round(status.total / guests) : 0,
    hasBudgetCap: status.cap !== null,
    estimatedAmount: provenance.estimate,
    hostEnteredAmount: provenance.user,
    quotedAmount: provenance.verified,
    lockedItemCount: plan.budgetItems.filter((i) => i.locked).length,
  };

  if (status.cap !== null) {
    facts.budgetCap = status.cap;
    facts.overCap = status.overCap;
    facts[status.overCap ? 'amountOverCap' : 'amountUnderCap'] = Math.abs(status.remaining);
    facts.percentOfCapUsed = status.usedPercent;
  }

  totals.slice(0, 5).forEach(([category, amount], idx) => {
    facts[`category_${idx + 1}`] = category;
    facts[`category_${idx + 1}_amount`] = amount;
  });

  return facts;
}
