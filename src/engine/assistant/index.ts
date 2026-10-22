import type { EventPlan } from '@/domain/types';
import type { EngineContext } from '@/engine/context';
import type { IntakeOutput } from '@/llm/schemas/intake';
import type { IntentOutput } from '@/llm/schemas/intent';
import { buildPlanFromIntake, type PlanFromIntakeResult } from './fromIntake';
import { resolveIntent } from './resolveIntent';
import type { AssistantOutcome } from './types';

export * from './concepts';
export * from './fromIntake';
export * from './resolveIntent';
export * from './types';
export * from './withFunding';

/**
 * High-level pure intake handler translating structured LLM intake output into an initialized EventPlan.
 * WHY: Provides a single, uniform entry point for server API routes and UI actions to instantiate plans.
 */
export function handleIntake(
  intake: IntakeOutput,
  ctx: EngineContext,
  today: string,
  hostBrief?: string,
): PlanFromIntakeResult {
  return buildPlanFromIntake(intake, ctx, today, hostBrief);
}


/**
 * High-level pure message handler evaluating host follow-up intents against the active plan.
 * WHY: Serves as the authoritative bridge: text -> LLM intent -> resolveIntent -> proposal.
 */
export function handleMessage(
  plan: EventPlan,
  intent: IntentOutput,
  ctx: EngineContext,
  today: string,
): AssistantOutcome {
  return resolveIntent(plan, intent, ctx, today);
}
