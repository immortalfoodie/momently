import type { EventPlan, Money } from '@/domain/types';
import { formatInr } from '@/lib/format';
import { budgetTotal, getBudgetCap } from './budget';

export interface Violation {
  constraintId: string;
  message: string;
  overBy?: number;
}

/**
 * Evaluates an event plan against its active hard constraints to identify violations.
 * WHY: The deterministic engine enforces hard operational and financial boundaries that AI suggestions
 * or manual edits cannot bypass without explicit host acknowledgment.
 *
 * NOTE on semantics: A hard `guest_count` constraint designates the MAXIMUM allowable guest capacity
 * (such as a legal venue fire code or host budget threshold). If `meta.guestCount > numericValue`,
 * a violation is registered. Soft constraints represent targets and never produce violations.
 *
 * @param plan - The complete EventPlan to inspect.
 * @returns An array of hard violations detected, empty if the plan is compliant.
 */
export function findViolations(plan: EventPlan): Violation[] {
  const violations: Violation[] = [];
  const total = budgetTotal(plan.budgetItems, plan.meta.guestCount);
  const cap = getBudgetCap(plan.constraints);

  if (cap !== null && total > cap) {
    const hardCapConstraint = plan.constraints.find(
      (c) =>
        c.kind === 'budget_cap' &&
        c.severity === 'hard' &&
        typeof c.numericValue === 'number' &&
        c.numericValue === cap,
    );

    if (hardCapConstraint) {
      const overBy = total - cap;
      violations.push({
        constraintId: hardCapConstraint.id,
        message: `Total budget ${formatInr(total)} exceeds hard budget cap of ${formatInr(cap)} by ${formatInr(overBy as Money)}`,
        overBy,
      });
    }
  }

  const hardGuestConstraints = plan.constraints.filter(
    (c) =>
      c.kind === 'guest_count' &&
      c.severity === 'hard' &&
      typeof c.numericValue === 'number',
  );

  for (const constraint of hardGuestConstraints) {
    const maxCapacity = constraint.numericValue as number;
    if (plan.meta.guestCount > maxCapacity) {
      const overBy = plan.meta.guestCount - maxCapacity;
      violations.push({
        constraintId: constraint.id,
        message: `Guest count of ${plan.meta.guestCount} exceeds hard limit of ${maxCapacity} by ${overBy} guests`,
        overBy,
      });
    }
  }

  return violations;
}
