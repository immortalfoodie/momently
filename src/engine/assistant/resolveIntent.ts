import type { EventPlan } from '@/domain/types';
import type { EngineContext } from '@/engine/context';
import type { IntentKind, IntentOutput } from '@/llm/schemas/intent';
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

type ResolverFor<K extends IntentKind> = (
  plan: EventPlan,
  intent: Extract<IntentOutput, { kind: K }>,
  ctx: EngineContext,
  today: string,
) => AssistantOutcome;

/**
 * One resolver per intent kind. The mapped type makes the table exhaustive at compile time:
 * adding a new intent kind without a resolver is a type error.
 */
const RESOLVERS: { [K in IntentKind]: ResolverFor<K> } = {
  change_guest_count: (plan, intent, ctx) => resolveChangeGuestCount(plan, intent, ctx),
  change_budget: (plan, intent, ctx) => resolveChangeBudget(plan, intent, ctx),
  adjust_category: (plan, intent, ctx) => resolveAdjustCategory(plan, intent, ctx),
  upgrade: (plan, intent, ctx) => resolveUpgrade(plan, intent, ctx),
  downgrade: (plan, intent, ctx) => resolveDowngrade(plan, intent, ctx),
  save_money: (plan, intent, ctx) => resolveSaveMoney(plan, intent, ctx),
  afford_check: (plan, intent, ctx) => resolveAffordCheck(plan, intent, ctx),
  find_forgotten: (plan) => resolveFindForgotten(plan),
  make_it_premium: (plan, _intent, ctx) => resolveMakeItPremium(plan, ctx),
  simulate: (plan, intent, ctx) => resolveSimulate(plan, intent, ctx),
  select_concept: (plan, intent, ctx) => resolveSelectConcept(plan, intent, ctx),
  combine_concepts: (plan, intent, ctx) => resolveCombineConcepts(plan, intent, ctx),
  add_preference: (plan, intent, ctx) => resolveAddPreference(plan, intent, ctx),
  set_setting: (plan, intent, ctx) => resolveSetSetting(plan, intent, ctx),
  set_date: (plan, intent, ctx, today) => resolveSetDate(plan, intent, ctx, today),
  answer: (_plan, intent) => resolveAnswer(intent),
  clarify: (_plan, intent) => resolveClarify(intent),
  decline: (_plan, intent) => resolveDecline(intent),
};

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
export function resolveIntent(
  plan: EventPlan,
  intent: IntentOutput,
  ctx: EngineContext,
  today: string,
): AssistantOutcome {
  const resolver = RESOLVERS[intent.kind] as
    | ((p: EventPlan, i: IntentOutput, c: EngineContext, t: string) => AssistantOutcome)
    | undefined;
  if (!resolver) {
    return { kind: 'error', message: `Unhandled intent: ${JSON.stringify(intent)}` };
  }
  return resolver(plan, intent, ctx, today);
}
