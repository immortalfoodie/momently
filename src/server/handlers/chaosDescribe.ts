import { chaosDescribeRequestSchema, type ChaosDescribeResponse } from '@/lib/contracts';
import { MAX_BODY_BYTES_CHAOS_DESCRIBE } from '../config';
import type { Deps } from '../deps';
import { runWithFallback } from '../fallback';
import { guardRequest } from '../guard';
import { errorResponse, jsonResponse } from '../http';

/**
 * Handles free-text disaster descriptions for Chaos Lab.
 * WHY: Translates the host's words into typed scenarios; the client engine re-checks and simulates them,
 * so the model never prices or applies anything.
 */
export async function handleChaosDescribe(req: Request, deps: Deps): Promise<Response> {
  const guarded = await guardRequest(req, deps, MAX_BODY_BYTES_CHAOS_DESCRIBE);
  if (!guarded.ok) {
    return guarded.error;
  }

  const parsed = chaosDescribeRequestSchema.safeParse(guarded.value);
  if (!parsed.success) {
    return errorResponse(
      'invalid_request',
      'Invalid description payload: text must be 1-500 characters',
      400,
    );
  }

  const outcome = await runWithFallback(deps, 'chaos_describe', parsed.data);
  if (!outcome.result.ok) {
    return errorResponse(
      'ai_unavailable',
      'The scenario reader is temporarily unavailable. Pick a problem from the list instead.',
      503,
    );
  }

  const body: ChaosDescribeResponse = {
    scenarios: outcome.result.value.scenarios,
    understood: outcome.result.value.understood,
    unsupported: outcome.result.value.unsupported ?? null,
    mode: deps.mode,
    degraded: outcome.degraded,
  };

  return jsonResponse(body);
}
