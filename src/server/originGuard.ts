/**
 * Validates that cross-origin mutation requests match the expected host.
 *
 * BEHAVIOR & SECURITY CONTEXT:
 * - When an `Origin` header is present (standard browser CORS/mutation behavior),
 *   this guard validates that the origin's host matches the request's `Host` or `x-forwarded-host`.
 * - If the `Origin` header is missing, the request is permitted. This enables programmatic
 *   server-to-server integration, automated curl health checks, and mobile clients.
 *   Standard web browsers always attach an `Origin` header to POST requests.
 *
 * @param req - Incoming Web Request object.
 * @returns True if the origin is valid or absent; false if an explicit cross-origin mismatch is detected.
 */
export function checkSameOrigin(req: Request): boolean {
  const originHeader = req.headers.get('origin');
  if (!originHeader) {
    return true;
  }

  let originHost: string;
  try {
    const parsed = new URL(originHeader);
    originHost = parsed.host.toLowerCase();
  } catch {
    return false;
  }

  const forwardedHost = req.headers.get('x-forwarded-host');
  const hostHeader = forwardedHost || req.headers.get('host');
  if (!hostHeader) {
    return false;
  }

  const expectedHost = hostHeader.split(',')[0]?.trim().toLowerCase();
  return originHost === expectedHost;
}
