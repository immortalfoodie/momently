import type { HealthResponse } from '@/lib/contracts';
import type { Deps } from '../deps';
import { jsonResponse } from '../http';

/**
 * Handles health and status check requests.
 * WHY: Exposes runtime operational mode (live vs demo) without leaking keys or env secrets.
 * NOTE: Exempt from rate limiting to support uptime probes and load balancers.
 */
export async function handleHealth(
  _req: Request,
  deps: Deps,
): Promise<Response> {
  const body: HealthResponse = {
    mode: deps.mode,
    ...(deps.modeNote ? { note: deps.modeNote } : {}),
  };

  return jsonResponse(body);
}
