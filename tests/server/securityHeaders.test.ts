import { describe, expect, it } from 'vitest';
import { buildSecurityHeaders } from '@/server/securityHeaders';

describe('Server: Security Headers', () => {
  it('builds defensive CSP without wildcards and excludes unsafe-eval in production', () => {
    const headers = buildSecurityHeaders(false);
    const cspEntry = headers.find((h) => h.key === 'Content-Security-Policy');
    expect(cspEntry).toBeDefined();

    const csp = cspEntry!.value;
    // CSP contains no wildcard '*'
    expect(csp).not.toContain('*');
    // Enforces frame-ancestors 'none' to block clickjacking
    expect(csp).toContain("frame-ancestors 'none'");
    // Excludes unsafe-eval in production
    expect(csp).not.toContain("'unsafe-eval'");
    // Permits unsafe-inline for Next.js inline bootstrap
    expect(csp).toContain("'unsafe-inline'");
    // Restricts object-src to 'none'
    expect(csp).toContain("object-src 'none'");

    // Check additional defensive headers
    const xFrame = headers.find((h) => h.key === 'X-Frame-Options');
    expect(xFrame?.value).toBe('DENY');

    const nosniff = headers.find((h) => h.key === 'X-Content-Type-Options');
    expect(nosniff?.value).toBe('nosniff');

    const referrer = headers.find((h) => h.key === 'Referrer-Policy');
    expect(referrer?.value).toBe('strict-origin-when-cross-origin');

    const coop = headers.find((h) => h.key === 'Cross-Origin-Opener-Policy');
    expect(coop?.value).toBe('same-origin');

    const permissions = headers.find((h) => h.key === 'Permissions-Policy');
    expect(permissions?.value).toContain('camera=()');
    expect(permissions?.value).toContain('microphone=()');
    expect(permissions?.value).toContain('geolocation=()');
    expect(permissions?.value).toContain('payment=()');
  });

  it('includes unsafe-eval in development mode for hot module replacement', () => {
    const headers = buildSecurityHeaders(true);
    const cspEntry = headers.find((h) => h.key === 'Content-Security-Policy');
    expect(cspEntry).toBeDefined();

    const csp = cspEntry!.value;
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain('*');
  });
});
