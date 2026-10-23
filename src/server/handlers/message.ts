import { resolveIntent } from '@/engine/assistant/resolveIntent';
import type { AssistantOutcome } from '@/engine/assistant/types';
import { buildChaosFacts } from '@/engine/chaos/facts';
import { messageRequestSchema, type MessageResponse } from '@/lib/contracts';
import { summarizePlanForLlm } from '@/llm/context';
import { MAX_BODY_BYTES_MESSAGE } from '../config';
import type { Deps } from '../deps';
import { runWithFallback } from '../fallback';
import { guardRequest } from '../guard';
import { errorResponse, jsonResponse } from '../http';

async function narrateChaosOutcome(
  deps: Deps,
  outcome: Extract<AssistantOutcome, { kind: 'chaos' }>,
): Promise<{ text: string; highlights: string[] } | undefined> {
  if (!outcome.result.applicable) {
    return undefined;
  }

  const facts = buildChaosFacts(outcome.result);

  try {
    const narrateFallback = await runWithFallback(deps, 'narrate', {
      purpose: 'chaos_summary',
      facts,
    });

    if (narrateFallback.result.ok) {
      return {
        text: narrateFallback.result.value.text,
        highlights: narrateFallback.result.value.highlights,
      };
    }
  } catch {
    // Narration failure is non-fatal: return undefined gracefully
  }

  return undefined;
}

/**
 * Handles conversational follow-up messages and plan adjustment requests.
 * WHY: Evaluates untrusted host messages against validated plans, classifying intent
 * and resolving pure, approvable engine recovery options.
 */
export async function handleMessage(
  req: Request,
  deps: Deps,
): Promise<Response> {
  // 1. Guard request (Origin, Rate Limit, Size limits, JSON syntax)
  const guarded = await guardRequest(req, deps, MAX_BODY_BYTES_MESSAGE);
  if (!guarded.ok) {
    return guarded.error;
  }

  // 2. Validate input schema (The plan is untrusted data: schema validation is the security gate)
  const parsed = messageRequestSchema.safeParse(guarded.value);
  if (!parsed.success) {
    return errorResponse(
      'invalid_request',
      'Invalid message payload: message must be 1-500 chars and plan must conform to eventPlanSchema',
      400,
    );
  }

  const { message, plan, recentMessages } = parsed.data;

  // 3. Summarize plan for LLM intent classification
  const planSummary = summarizePlanForLlm(plan);

  // 4. Run intent classification with fallback
  const intentFallback = await runWithFallback(deps, 'intent', {
    message,
    planSummary,
    recentMessages,
  });

  if (!intentFallback.result.ok) {
    const fallbackClarify: MessageResponse = {
      outcome: {
        kind: 'clarify',
        question: "I couldn't understand that. Could you rephrase?",
      },
      mode: deps.mode,
      degraded: intentFallback.degraded,
      notes: [],
    };
    return jsonResponse(fallbackClarify);
  }

  const intent = intentFallback.result.value;
  const today = deps.clock().toISOString().slice(0, 10);
  const ctx = { ids: deps.ids, clock: deps.clock };

  // 5. Pure engine intent resolution with defensive error boundary
  let outcome: AssistantOutcome;
  try {
    outcome = resolveIntent(plan, intent, ctx, today);
  } catch (err) {
    const errorName = err instanceof Error ? err.name : 'Error';
    console.error(`[api/message] resolveIntent failed with: ${errorName}`);
    outcome = {
      kind: 'error',
      message: "I couldn't work that change out. Please rephrase or try a smaller change.",
    };
  }

  // 6. Optional narration for chaos simulation outcomes
  let narration: { text: string; highlights: string[] } | undefined;
  if (outcome.kind === 'chaos') {
    narration = await narrateChaosOutcome(deps, outcome);
  }

  const responseBody: MessageResponse = {
    outcome,
    mode: deps.mode,
    degraded: intentFallback.degraded,
    notes: [],
    ...(narration ? { narration } : {}),
  };

  return jsonResponse(responseBody);
}
