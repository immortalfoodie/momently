import type { EventPlan } from '@/domain/types';
import type { EngineContext } from '@/engine/context';
import type { IntentOutput } from '@/llm/schemas/intent';
import {
  resolveCombineConcepts,
  resolveSelectConcept,
} from './resolvers/conceptResolvers';
import {
  resolveAdjustCategory,
  resolveChangeBudget,
  resolveChangeGuestCount,
} from './resolvers/guestBudgetResolvers';
import {
  resolveAnswer,
  resolveClarify,
  resolveDecline,
  resolveFindForgotten,
  resolveMakeItPremium,
  resolveSimulate,
} from './resolvers/miscResolvers';
import {
  resolveAddPreference,
  resolveSetDate,
  resolveSetSetting,
} from './resolvers/preferenceResolvers';
import {
  resolveAffordCheck,
  resolveDowngrade,
  resolveSaveMoney,
  resolveUpgrade,
} from './resolvers/qualityResolvers';
import type { AssistantOutcome } from './types';

/**
 * Evaluates a validated host intent against an active EventPlan, formulating approvable proposals.
 * WHY: Strict architectural bridge between untrusted LLM extraction and deterministic engine decision-making.
 *
 * @param plan - Baseline EventPlan to evaluate against (never mutated).
 * @param intent - Validated intent discriminated union from the LLM layer.
 * @param ctx - Injected engine context (ID generator and clock).
 * @param today - Current reference date in YYYY-MM-DD format for validating date requests.
 * @returns Exhaustively resolved AssistantOutcome (proposal, conflict, info, chaos, clarify, or reply).
 */
// eslint-disable-next-line complexity
export function resolveIntent(
  plan: EventPlan,
  intent: IntentOutput,
  ctx: EngineContext,
  today: string,
): AssistantOutcome {
  switch (intent.kind) {
    case 'change_guest_count':
      return resolveChangeGuestCount(plan, intent, ctx);
    case 'change_budget':
      return resolveChangeBudget(plan, intent, ctx);
    case 'adjust_category':
      return resolveAdjustCategory(plan, intent, ctx);
    case 'upgrade':
      return resolveUpgrade(plan, intent, ctx);
    case 'downgrade':
      return resolveDowngrade(plan, intent, ctx);
    case 'save_money':
      return resolveSaveMoney(plan, intent, ctx);
    case 'afford_check':
      return resolveAffordCheck(plan, intent, ctx);
    case 'find_forgotten':
      return resolveFindForgotten(plan);
    case 'make_it_premium':
      return resolveMakeItPremium(plan, ctx);
    case 'simulate':
      return resolveSimulate(plan, intent, ctx);
    case 'select_concept':
      return resolveSelectConcept(plan, intent, ctx);
    case 'combine_concepts':
      return resolveCombineConcepts(plan, intent, ctx);
    case 'add_preference':
      return resolveAddPreference(plan, intent, ctx);
    case 'set_setting':
      return resolveSetSetting(plan, intent, ctx);
    case 'set_date':
      return resolveSetDate(plan, intent, ctx, today);
    case 'answer':
      return resolveAnswer(intent);
    case 'clarify':
      return resolveClarify(intent);
    case 'decline':
      return resolveDecline(intent);
    default: {
      const _exhaustive: never = intent;
      return {
        kind: 'error',
        message: `Unhandled intent: ${JSON.stringify(_exhaustive)}`,
      };
    }
  }
}

