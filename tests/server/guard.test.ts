import { describe, expect, it } from 'vitest';
import { createDeps } from '@/server/deps';
import { guardRequest } from '@/server/guard';

describe('Server: Request Guard & Origin Verification', () => {
  const deps = createDeps();

  it('rejects requests with unsupported media type with 415', async () => {
    const req = new Request('http://localhost:3000/api/intake', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: 'plain text',
    });

    const result = await guardRequest(req, deps, 1000);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.status).toBe(415);
      const json = await result.error.json();
      expect(json.error.code).toBe('unsupported_media_type');
    }
  });

  it('rejects requests exceeding payload limit by Content-Length header with 413', async () => {
    const req = new Request('http://localhost:3000/api/intake', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': '2000',
      },
      body: JSON.stringify({ text: 'hi' }),
    });

    const result = await guardRequest(req, deps, 1000);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.status).toBe(413);
      const json = await result.error.json();
      expect(json.error.code).toBe('payload_too_large');
    }
  });

  it('rejects requests exceeding payload limit by actual body length with 413', async () => {
    const hugeBody = JSON.stringify({ text: 'x'.repeat(1200) });
    const req = new Request('http://localhost:3000/api/intake', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: hugeBody,
    });

    const result = await guardRequest(req, deps, 1000);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.status).toBe(413);
      const json = await result.error.json();
      expect(json.error.code).toBe('payload_too_large');
    }
  });

  it('rejects requests with malformed JSON syntax with 400', async () => {
    const req = new Request('http://localhost:3000/api/intake', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: '{"unclosed": json',
    });

    const result = await guardRequest(req, deps, 1000);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.status).toBe(400);
      const json = await result.error.json();
      expect(json.error.code).toBe('invalid_request');
    }
  });

  it('rejects cross-origin requests when Origin does not match Host with 403', async () => {
    const req = new Request('http://localhost:3000/api/intake', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Host: 'localhost:3000',
        Origin: 'https://evil-attacker.com',
      },
      body: JSON.stringify({ text: 'hello' }),
    });

    const result = await guardRequest(req, deps, 1000);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.status).toBe(403);
      const json = await result.error.json();
      expect(json.error.code).toBe('forbidden_origin');
    }
  });

  it('allows same-origin requests matching Host header', async () => {
    const req = new Request('http://localhost:3000/api/intake', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Host: 'localhost:3000',
        Origin: 'http://localhost:3000',
      },
      body: JSON.stringify({ text: 'hello' }),
    });

    const result = await guardRequest(req, deps, 1000);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ text: 'hello' });
    }
  });

  it('allows requests with missing Origin header for server-to-server calls', async () => {
    const req = new Request('http://localhost:3000/api/intake', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Host: 'localhost:3000',
      },
      body: JSON.stringify({ text: 'hello' }),
    });

    const result = await guardRequest(req, deps, 1000);
    expect(result.ok).toBe(true);
  });
});
