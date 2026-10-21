import { err, ok, type Result } from '@/lib/result';
import type { Deps } from './deps';
import { errorResponse, readJsonBody } from './http';
import { checkSameOrigin } from './originGuard';
import { clientKey } from './rateLimit';

/**
 * Validates request origin, checks rate limits, and safely reads the bounded JSON body.
 * WHY: Consolidates common security and infrastructure gating into a single composable guard,
 * keeping route handlers under ~20 lines of clean orchestration.
 *
 * @param req - Incoming HTTP request.
 * @param deps - Injected server dependencies (rate limiter, clock, etc.).
 * @param maxBytes - Maximum permitted body size in bytes.
 * @returns Result containing parsed JSON on success, or an immediate HTTP error Response.
 */
export async function guardRequest(
  req: Request,
  deps: Deps,
  maxBytes: number,
): Promise<Result<unknown, Response>> {
  // 1. Same-Origin Check
  if (!checkSameOrigin(req)) {
    return err(
      errorResponse(
        'forbidden_origin',
        'Cross-origin requests are forbidden',
        403,
      ),
    );
  }

  // 2. Sliding-Window Rate Limiter
  const key = clientKey(req);
  const rateLimit = deps.rateLimiter.check(key);
  if (!rateLimit.allowed) {
    return err(
      errorResponse(
        'rate_limited',
        'Rate limit exceeded. Please try again later.',
        429,
        {
          'Retry-After': String(rateLimit.retryAfterSeconds),
        },
      ),
    );
  }

  // 3. Bounded JSON Body Reader
  const bodyResult = await readJsonBody(req, maxBytes);
  if (!bodyResult.ok) {
    return err(
      errorResponse(
        bodyResult.error.code,
        bodyResult.error.message,
        bodyResult.error.status,
      ),
    );
  }

  return ok(bodyResult.value);
}
