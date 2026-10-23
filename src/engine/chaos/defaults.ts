import type { ChaosScenarioInput } from '@/domain/chaosSchemas';
import type { EventPlan } from '@/domain/types';
import { getBudgetCap, itemTotal } from '@/engine/budget';

function getLargestFamily(plan: EventPlan): string {
  let largestTotal = -1;
  let largestFamily = 'decor_theme';
  for (const item of plan.budgetItems) {
    if (item.provenance === 'estimate' && item.rateKey) {
      const total = itemTotal(item, plan.meta.guestCount);
      if (total > largestTotal) {
        largestTotal = total;
        largestFamily = item.rateKey.split('.')[0] ?? 'decor_theme';
      }
    }
  }
  return largestFamily;
}

/**
 * Returns sensible, context-aware prefill inputs for a given chaos scenario.
 *
 * @param plan - Active EventPlan instance.
 * @param type - Scenario type discriminant.
 * @returns Pre-populated ChaosScenarioInput.
 */
export function defaultInputFor(
  plan: EventPlan,
  type: ChaosScenarioInput['type'],
): ChaosScenarioInput {
  switch (type) {
    case 'rain':
      return { type: 'rain' };

    case 'budget_cut':
      return { type: 'budget_cut', percent: 20 };

    case 'guest_surge':
      return {
        type: 'guest_surge',
        extraGuests: Math.max(10, Math.round(plan.meta.guestCount * 0.2)),
      };

    case 'vendor_cancels': {
      const firstCat = plan.vendors[0]?.category;
      return { type: 'vendor_cancels', category: firstCat ?? 'photography' };
    }

    case 'late_start':
      return { type: 'late_start', delayMinutes: 120 };

    case 'item_unavailable':
      return { type: 'item_unavailable', family: getLargestFamily(plan) };
  }
}

export interface ScenarioAvailability {
  available: boolean;
  reason?: string;
}

/**
 * Determines whether a chaos scenario is applicable to the current plan and provides plain-English reasons if not.
 *
 * @param plan - Active EventPlan to check.
 * @param type - Scenario type discriminant.
 * @returns ScenarioAvailability tuple.
 */
export function scenarioAvailability(
  plan: EventPlan,
  type: ChaosScenarioInput['type'],
): ScenarioAvailability {
  if (type === 'rain' && plan.meta.setting === 'indoor') {
    return {
      available: false,
      reason: 'Rain scenario is not applicable for indoor venues with weather protection.',
    };
  }

  if (type === 'budget_cut' && getBudgetCap(plan.constraints) === null) {
    return {
      available: false,
      reason: 'Budget cut requires an active budget cap constraint on the plan.',
    };
  }

  if (type === 'vendor_cancels' && plan.vendors.length === 0) {
    return {
      available: false,
      reason: 'No vendor categories are defined in the plan to simulate cancellations.',
    };
  }

  if (type === 'item_unavailable' && !plan.budgetItems.some((i) => Boolean(i.rateKey))) {
    return {
      available: false,
      reason: 'No rate-card line items exist in the plan to simulate inventory shortages.',
    };
  }

  return { available: true };
}
