import { getBudgetCap } from '@/engine/budget';
import { attachConcepts } from '@/engine/assistant/concepts';
import { conceptsRequestSchema, type ConceptsResponse } from '@/lib/contracts';
import { summarizePlanForLlm } from '@/llm/context';
import type { IntakeConstraint, IntakeOutput } from '@/llm/schemas/intake';
import { MAX_BODY_BYTES_MESSAGE } from '../config';
import type { Deps } from '../deps';
import { runWithFallback } from '../fallback';
import { guardRequest } from '../guard';
import { errorResponse, jsonResponse } from '../http';

const ALLOWED_INTAKE_KINDS = new Set([
  'must_have',
  'avoid',
  'style',
  'dietary',
  'accessibility',
  'venue',
  'date',
]);

/**
 * Handles creative concept generation requests for an active plan.
 * WHY: Synthesizes 3 distinct celebration concepts grounded in current plan facts and pricing rate cards.
 */
export async function handleConcepts(
  req: Request,
  deps: Deps,
): Promise<Response> {
  const guarded = await guardRequest(req, deps, MAX_BODY_BYTES_MESSAGE);
  if (!guarded.ok) {
    return guarded.error;
  }

  const parsed = conceptsRequestSchema.safeParse(guarded.value);
  if (!parsed.success) {
    return errorResponse(
      'invalid_request',
      'Invalid concepts payload: a valid event plan is required',
      400,
    );
  }

  const plan = parsed.data.plan;
  const cap = getBudgetCap(plan.constraints);
  const isHard = plan.constraints.some(
    (c) => c.kind === 'budget_cap' && c.severity === 'hard',
  );

  const filteredConstraints: IntakeConstraint[] = plan.constraints
    .filter((c) => ALLOWED_INTAKE_KINDS.has(c.kind))
    .map((c) => ({
      kind: c.kind as IntakeConstraint['kind'],
      description: c.description,
      severity: c.severity,
    }));

  const brief: IntakeOutput = {
    title: plan.meta.title,
    type: plan.meta.type,
    city: plan.meta.city || null,
    dateIso: plan.meta.dateIso || null,
    guestCount: plan.meta.guestCount,
    setting: plan.meta.setting,
    budgetCap: cap,
    budgetIsHard: isHard,
    constraints: filteredConstraints,
    guestNeeds: plan.guestNeeds,
    styleTags: [],
    missingInfo: [],
  };

  const planSummary = summarizePlanForLlm(plan);

  const conceptsFallback = await runWithFallback(deps, 'concepts', {
    brief,
    planSummary,
  });

  if (!conceptsFallback.result.ok) {
    return errorResponse(
      'ai_unavailable',
      'The event planning assistant is temporarily unavailable. Please try again in a few moments.',
      503,
    );
  }

  const ctx = { ids: deps.ids, clock: deps.clock };
  const attached = attachConcepts(plan, conceptsFallback.result.value, ctx);

  const responseBody: ConceptsResponse = {
    concepts: attached.concepts,
    degraded: conceptsFallback.degraded,
    notes: [],
  };

  return jsonResponse(responseBody);
}
