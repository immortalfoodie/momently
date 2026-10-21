import { describe, expect, it } from 'vitest';
import { clientKey, createRateLimiter } from '@/server/rateLimit';

describe('Server: Rate Limiting & Client Key Extraction', () => {
  it('extracts client key from x-forwarded-for first IP', () => {
    const req = new Request('http://localhost:3000/api/intake', {
      headers: {
        'x-forwarded-for': '203.0.113.195, 70.41.3.18, 150.172.238.178',
      },
    });
    expect(clientKey(req)).toBe('203.0.113.195');
  });

  it('extracts client key from x-real-ip when x-forwarded-for is absent', () => {
    const req = new Request('http://localhost:3000/api/intake', {
      headers: {
        'x-real-ip': '198.51.100.42',
      },
    });
    expect(clientKey(req)).toBe('198.51.100.42');
  });

  it('falls back to local when no IP headers are present', () => {
    const req = new Request('http://localhost:3000/api/intake');
    expect(clientKey(req)).toBe('local');
  });

  it('enforces sliding window limits and computes accurate retryAfterSeconds', () => {
    let currentTime = 1000000;
    const limiter = createRateLimiter({
      limitPerMinute: 3,
      clock: () => currentTime,
    });

    const client = 'client-alpha';

    // Request 1: at t=0
    expect(limiter.check(client)).toEqual({ allowed: true, retryAfterSeconds: 0 });

    // Request 2: at t=10s
    currentTime += 10000;
    expect(limiter.check(client)).toEqual({ allowed: true, retryAfterSeconds: 0 });

    // Request 3: at t=20s
    currentTime += 10000;
    expect(limiter.check(client)).toEqual({ allowed: true, retryAfterSeconds: 0 });

    // Request 4: at t=25s -> rejected (3 requests already in window 1000000 to 1025000)
    // Oldest was at 1000000. It expires at 1060000. Current is 1020000 + 5000 = 1025000.
    // Remaining time = 35s.
    currentTime += 5000;
    const rejected = limiter.check(client);
    expect(rejected.allowed).toBe(false);
    expect(rejected.retryAfterSeconds).toBe(35);

    // Advance clock past oldest request (t=61s, 1061000)
    currentTime = 1061000;
    // Oldest is now expired, so only 2 remain in window. Request should succeed!
    expect(limiter.check(client)).toEqual({ allowed: true, retryAfterSeconds: 0 });
  });

  it('bounds memory by evicting oldest client when maxClients is reached', () => {
    const limiter = createRateLimiter({
      limitPerMinute: 5,
      maxClients: 3,
    });

    limiter.check('client-1');
    limiter.check('client-2');
    limiter.check('client-3');
    expect(limiter.size()).toBe(3);

    // Adding client-4 should evict client-1
    limiter.check('client-4');
    expect(limiter.size()).toBe(3);
  });
});
