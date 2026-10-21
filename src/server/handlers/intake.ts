import { attachConcepts } from '@/engine/assistant/concepts';
import { buildPlanFromIntake } from '@/engine/assistant/fromIntake';
import { intakeRequestSchema, type IntakeResponse } from '@/lib/contracts';
import { summarizePlanForLlm } from '@/llm/context';
import { MAX_BODY_BYTES_INTAKE } from '../config';
import type { Deps } from '../deps';
import { runWithFallback } from '../fallback';
import { guardRequest } from '../guard';
import { errorResponse, jsonResponse } from '../http';

/**
 * Handles new event celebration intake requests.
 * WHY: Translates unstructured host text into a fully synthesized, constraint-checked EventPlan.
 * Gracefully degrades by omitting concepts if the concept synthesis model fails.
 */
export async function handleIntake(
  req: Request,
  deps: Deps,
): Promise<Response> {
  // 1. Guard request (Origin, Rate Limit, Size limits, JSON syntax)
  const guarded = await guardRequest(req, deps, MAX_BODY_BYTES_INTAKE);
  if (!guarded.ok) {
    return guarded.error;
  }

  // 2. Validate input schema
  const parsed = intakeRequestSchema.safeParse(guarded.value);
  if (!parsed.success) {
    return errorResponse(
      'invalid_request',
      'Invalid intake payload: text must be between 1 and 1500 characters',
      400,
    );
  }

  const today = deps.clock().toISOString().slice(0, 10);
  const notes: string[] = [];

  // 3. Run LLM intake extraction with resilient fallback
  const intakeFallback = await runWithFallback(deps, 'intake', {
    text: parsed.data.text,
    today,
  });

  if (!intakeFallback.result.ok) {
    return errorResponse(
      'ai_unavailable',
      'The event planning assistant is temporarily unavailable. Please try again in a few moments.',
      503,
    );
  }

  const intakeOutput = intakeFallback.result.value;
  const ctx = { ids: deps.ids, clock: deps.clock };

  // 4. Pure engine plan construction
  const planResult = buildPlanFromIntake(intakeOutput, ctx, today, parsed.data.text);
  const planSummary = summarizePlanForLlm(planResult.plan);

  // 5. Synthesize 3 celebration concepts
  const conceptsFallback = await runWithFallback(deps, 'concepts', {
    brief: intakeOutput,
    planSummary,
  });

  let finalPlan = planResult.plan;
  let degraded = intakeFallback.degraded;

  if (conceptsFallback.result.ok) {
    finalPlan = attachConcepts(planResult.plan, conceptsFallback.result.value, ctx);
    if (conceptsFallback.degraded) {
      degraded = true;
    }
  } else {
    notes.push('Concepts could not be generated at this time; default celebration plan initialized.');
  }

  const responseBody: IntakeResponse = {
    plan: finalPlan,
    fit: planResult.fit,
    assumptions: planResult.assumptions,
    missingInfo: planResult.missingInfo,
    mode: deps.mode,
    degraded,
    notes,
  };

  return jsonResponse(responseBody);
}
