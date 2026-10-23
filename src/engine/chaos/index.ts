import type { ChaosScenarioInput } from '@/domain/chaosSchemas';
import type { EventPlan } from '@/domain/types';
import type { EngineContext } from '@/engine/context';
import { scoreRisks } from '@/engine/risk';
import { simulateBudgetCut } from './budgetCut';
import { simulateGuestSurge } from './guestSurge';
import { simulateItemUnavailable } from './itemUnavailable';
import { simulateLateStart } from './lateStart';
import { simulateRain } from './rain';
import type { RecoveryOption, ScenarioResult } from './types';
import { simulateVendorCancels } from './vendorCancels';

export * from './budgetCut';
export * from './defaults';
export * from './facts';
export * from './guestSurge';
export * from './itemUnavailable';
export * from './lateStart';
export * from './option';
export * from './optionPreview';
export * from './rain';
export * from './stressTest';
export * from './types';
export * from './vendorCancels';

function pickRecommended(options: RecoveryOption[]): string | undefined {
  if (options.length === 0) return undefined;
  const viable = options.filter((o) => o.meetsCap);
  const candidates = viable.length > 0 ? viable : options;

  const sorted = [...candidates].sort((a, b) => {
    if (a.scoreAfter !== b.scoreAfter) return a.scoreAfter - b.scoreAfter;
    if (a.impact.budgetTotalAfter !== b.impact.budgetTotalAfter) {
      return a.impact.budgetTotalAfter - b.impact.budgetTotalAfter;
    }
    return a.id.localeCompare(b.id);
  });

  return sorted[0]?.id;
}

/**
 * Simulates a chaos scenario against an active EventPlan, evaluating recovery options and risk deltas.
 * WHY: Provides deterministic "what-if" crisis triage for hosts without hallucinating prices or contacting vendors.
 *
 * @param plan - Baseline EventPlan to test.
 * @param input - Discriminated union of chaos scenario parameters.
 * @param ctx - Injected engine context.
 * @returns Comprehensive ScenarioResult with recovery options, risk scores, and recommended option.
 */
export function simulateScenario(
  plan: EventPlan,
  input: ChaosScenarioInput,
  ctx: EngineContext,
): ScenarioResult {
  let result: ScenarioResult;

  switch (input.type) {
    case 'rain':
      result = simulateRain(plan, ctx);
      break;
    case 'budget_cut':
      result = simulateBudgetCut(plan, input, ctx);
      break;
    case 'guest_surge':
      result = simulateGuestSurge(plan, input, ctx);
      break;
    case 'vendor_cancels':
      result = simulateVendorCancels(plan, input, ctx);
      break;
    case 'late_start':
      result = simulateLateStart(plan, input, ctx);
      break;
    case 'item_unavailable':
      result = simulateItemUnavailable(plan, input, ctx);
      break;
    default: {
      const _exhaustive: never = input;
      return {
        input: _exhaustive,
        applicable: false,
        headline: 'Unknown chaos scenario',
        summary: 'The provided scenario type is not recognized.',
        options: [],
        scoreBefore: scoreRisks(plan, ctx).score,
      };
    }
  }

  const recommendedOptionId = pickRecommended(result.options);
  return {
    ...result,
    recommendedOptionId,
  };
}
