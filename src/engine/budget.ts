import { BUDGET_CATEGORY_IDS } from '@/domain/constants';
import type {
  BudgetCategory,
  BudgetItem,
  Constraint,
  EventPlan,
  EventSetting,
  EventType,
  Money,
  Provenance,
} from '@/domain/types';
import { getTemplate } from '@/data/templates';

/**
 * Calculates the total cost of a single budget item based on its calculation basis.
 * WHY: Abstract unit calculation so caller code does not branch on per-guest vs flat rate semantics.
 *
 * @param item - The budget line item.
 * @param guestCount - Current plan guest count for per-guest multiplying.
 * @returns Non-negative integer INR rupee amount.
 */
export function itemTotal(item: BudgetItem, guestCount: number): Money {
  if (item.basis === 'per_guest') {
    return Math.round(item.unitCost * guestCount * item.quantity);
  }
  return Math.round(item.unitCost * item.quantity);
}

/**
 * Sums all line item totals in a budget.
 * WHY: Single source of truth for total plan expenditure calculation.
 *
 * @param items - Array of budget line items.
 * @param guestCount - Event guest count.
 * @returns Total integer INR rupee amount.
 */
export function budgetTotal(items: readonly BudgetItem[], guestCount: number): Money {
  return items.reduce((total, item) => total + itemTotal(item, guestCount), 0);
}

/**
 * Groups budget totals across all standard budget categories with zero-filled defaults.
 * WHY: Ensures UI charts and category breakdowns never encounter undefined categories.
 *
 * @param items - Array of budget line items.
 * @param guestCount - Event guest count.
 * @returns Complete map of categories to integer INR amounts.
 */
export function categoryTotals(
  items: readonly BudgetItem[],
  guestCount: number,
): Record<BudgetCategory, Money> {
  const totals = BUDGET_CATEGORY_IDS.reduce(
    (acc, cat) => {
      acc[cat] = 0;
      return acc;
    },
    {} as Record<BudgetCategory, Money>,
  );

  for (const item of items) {
    totals[item.category] += itemTotal(item, guestCount);
  }

  return totals;
}

/**
 * Resolves the active budget ceiling from constraints, prioritizing hard limits.
 * WHY: Provides deterministic cap resolution where hard legal/financial limits override soft targets.
 *
 * @param constraints - Array of plan constraints.
 * @returns Lowest applicable budget cap in INR, or null if unconstrained.
 */
export function getBudgetCap(constraints: readonly Constraint[]): Money | null {
  const caps = constraints.filter(
    (c) => c.kind === 'budget_cap' && typeof c.numericValue === 'number',
  );

  const hardCaps = caps.filter((c) => c.severity === 'hard');
  if (hardCaps.length > 0) {
    return Math.min(...hardCaps.map((c) => c.numericValue as number));
  }

  const softCaps = caps.filter((c) => c.severity === 'soft');
  if (softCaps.length > 0) {
    return Math.min(...softCaps.map((c) => c.numericValue as number));
  }

  return null;
}

export interface BudgetStatus {
  total: Money;
  cap: Money | null;
  remaining: Money;
  overCap: boolean;
  usedPercent: number;
}

/**
 * Derives comprehensive budget consumption metrics for a plan.
 * WHY: Powers dashboard progress bars, cap status indicators, and warning flags.
 *
 * @param plan - The active EventPlan.
 * @returns Summary of total spend, cap, remaining balance, and utilization percentage.
 */
export function getBudgetStatus(plan: EventPlan): BudgetStatus {
  const total = budgetTotal(plan.budgetItems, plan.meta.guestCount);
  const cap = getBudgetCap(plan.constraints);
  const remaining = cap !== null ? cap - total : 0;
  const overCap = cap !== null && total > cap;

  let usedPercent = 0;
  if (cap !== null && cap > 0) {
    usedPercent = Number(((total / cap) * 100).toFixed(1));
  }

  return { total, cap, remaining, overCap, usedPercent };
}

/**
 * Computes expenditure breakdown by provenance source.
 * WHY: Transparently shows hosts how much of their budget is estimated vs user-entered vs quote-verified.
 *
 * @param items - Array of budget line items.
 * @param guestCount - Current guest headcount.
 * @returns Totals mapped by provenance source ('user' | 'estimate' | 'verified').
 */
export function provenanceBreakdown(
  items: readonly BudgetItem[],
  guestCount: number,
): Record<Provenance, Money> {
  const breakdown: Record<Provenance, Money> = {
    user: 0,
    estimate: 0,
    verified: 0,
  };

  for (const item of items) {
    breakdown[item.provenance] += itemTotal(item, guestCount);
  }

  return breakdown;
}

/**
 * Determines contingency buffer percentage based on event type and venue exposure risk.
 * WHY: Outdoor and mixed setting events carry inherent weather disruption risks demanding higher buffers.
 *
 * @param type - The event category (wedding, birthday, etc.).
 * @param setting - Setting type ('indoor' | 'outdoor' | 'mixed' | 'undecided').
 * @returns Integer percentage for contingency reserve calculation.
 */
export function contingencyPercent(type: EventType, setting: EventSetting): number {
  const base = getTemplate(type).contingencyBasePercent;
  if (setting === 'outdoor') return base + 3;
  if (setting === 'mixed') return base + 2;
  return base;
}

/**
 * Purely recalculates and updates the automatic contingency line item.
 * WHY: Contingency amounts float as line items are added, scaled, or repriced, unless host has locked it.
 *
 * @param items - Current budget items.
 * @param guestCount - Current guest headcount.
 * @param percent - Contingency percentage buffer to apply.
 * @returns A fresh array of budget items with exactly one verified/updated contingency line item.
 */
export function refreshContingency(
  items: readonly BudgetItem[],
  guestCount: number,
  percent: number,
): BudgetItem[] {
  const lockedContingency = items.find(
    (item) => item.category === 'contingency' && item.locked,
  );
  if (lockedContingency) {
    return [...items];
  }

  const existingContingency = items.find((item) => item.category === 'contingency');
  const nonContingencyItems = items.filter((item) => item.category !== 'contingency');
  const subtotal = budgetTotal(nonContingencyItems, guestCount);
  const contingencyAmount = Math.round((percent / 100) * subtotal);

  const updatedContingency: BudgetItem = {
    id: existingContingency?.id ?? 'bi_contingency',
    category: 'contingency',
    label: 'Contingency Fund',
    basis: 'flat',
    unitCost: contingencyAmount,
    quantity: 1,
    provenance: 'estimate',
    locked: false,
    rateKey: 'contingency.auto',
    note: `${percent}% buffer for unexpected expenses and adjustments`,
  };

  return [...nonContingencyItems, updatedContingency];
}
