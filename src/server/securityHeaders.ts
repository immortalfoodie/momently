export interface HeaderEntry {
  key: string;
  value: string;
}

/**
 * Builds standard defensive HTTP security headers for all application routes.
 *
 * CSP DESIGN & INLINE SCRIPTS:
 * Notice: 'unsafe-inline' is included in script-src because Next.js App Router injects inline
 * bootstrap and hydration scripts. In an enterprise production deployment, configuring
 * dynamic per-request nonces via Next.js middleware and injecting nonce attributes would
 * allow eliminating 'unsafe-inline', strictly enforcing that only cryptographically signed
 * scripts execute.
 *
 * 'unsafe-eval' is restricted exclusively to development mode to enable React/Turbopack hot module reloading.
 *
 * @param isDev - Whether running in local development mode.
 * @returns List of header key-value pairs.
 */
export function buildSecurityHeaders(
  isDev = process.env.NODE_ENV === 'development',
): HeaderEntry[] {
  const scriptSrc = isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'";

  const cspDirectives = [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');

  return [
    {
      key: 'Content-Security-Policy',
      value: cspDirectives,
    },
    {
      key: 'X-Content-Type-Options',
      value: 'nosniff',
    },
    {
      key: 'Referrer-Policy',
      value: 'strict-origin-when-cross-origin',
    },
    {
      key: 'X-Frame-Options',
      value: 'DENY',
    },
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=(), payment=()',
    },
    {
      key: 'Cross-Origin-Opener-Policy',
      value: 'same-origin',
    },
  ];
}
