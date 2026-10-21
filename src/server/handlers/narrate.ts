import { narrateRequestSchema, type NarrateResponse } from '@/lib/contracts';
import { MAX_BODY_BYTES_NARRATE } from '../config';
import type { Deps } from '../deps';
import { runWithFallback } from '../fallback';
import { guardRequest } from '../guard';
import { errorResponse, jsonResponse } from '../http';

/**
 * Handles celebration narrative summary requests.
 * WHY: Generates grounded executive narratives from verified engine facts.
 */
export async function handleNarrate(
  req: Request,
  deps: Deps,
): Promise<Response> {
  // 1. Guard request (Origin, Rate Limit, Size limits, JSON syntax)
  const guarded = await guardRequest(req, deps, MAX_BODY_BYTES_NARRATE);
  if (!guarded.ok) {
    return guarded.error;
  }

  // 2. Validate input schema
  const parsed = narrateRequestSchema.safeParse(guarded.value);
  if (!parsed.success) {
    return errorResponse(
      'invalid_request',
      'Invalid narrate payload: purpose must be valid and facts must not exceed 30 keys',
      400,
    );
  }

  // 3. Run narration task with fallback
  const narrateFallback = await runWithFallback(deps, 'narrate', parsed.data);
  if (!narrateFallback.result.ok) {
    return errorResponse(
      'ai_unavailable',
      'The narration service is temporarily unavailable. Please try again in a few moments.',
      503,
    );
  }

  const responseBody: NarrateResponse = {
    text: narrateFallback.result.value.text,
    highlights: narrateFallback.result.value.highlights,
    degraded: narrateFallback.degraded,
  };

  return jsonResponse(responseBody);
}
