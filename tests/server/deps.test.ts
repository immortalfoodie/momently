import { describe, expect, it } from 'vitest';
import { createDeps } from '@/server/deps';

describe('Server: Dependencies & Demo Rate Limits', () => {
  it('sets rate limit to max(configured, 120) when mode is demo', () => {
    // Mode demo with default configured rate limit (30) -> should allow 120 requests
    const demoDeps = createDeps({ mode: 'demo' });
    const client = 'test-demo-client';

    for (let i = 0; i < 120; i++) {
      const res = demoDeps.rateLimiter.check(client);
      expect(res.allowed).toBe(true);
    }
    const overLimit = demoDeps.rateLimiter.check(client);
    expect(overLimit.allowed).toBe(false);
  });

  it('keeps configured rate limit in live mode', () => {
    // Mode live with default configured limit (30) -> should allow 30 requests
    const liveDeps = createDeps({ mode: 'live' });
    const client = 'test-live-client';

    for (let i = 0; i < 30; i++) {
      const res = liveDeps.rateLimiter.check(client);
      expect(res.allowed).toBe(true);
    }
    const overLimit = liveDeps.rateLimiter.check(client);
    expect(overLimit.allowed).toBe(false);
  });
});
