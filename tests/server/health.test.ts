import { describe, expect, it } from 'vitest';
import { createDeps } from '@/server/deps';
import { handleHealth } from '@/server/handlers/health';

describe('Server: Health Handler', () => {
  it('returns valid operational mode and never exposes API keys or env secrets', async () => {
    const fakeKey = 'AIzaSySecretFakeApiKey1234567890';
    const deps = createDeps({
      mode: 'live',
      modeNote: 'Gemini 2.5 Flash active',
    });

    const req = new Request('http://localhost:3000/api/health');
    const res = await handleHealth(req, deps);

    expect(res.status).toBe(200);
    const bodyText = await res.text();

    expect(bodyText).not.toContain(fakeKey);
    expect(bodyText).not.toContain('GEMINI_API_KEY');

    const json = JSON.parse(bodyText);
    expect(json.mode).toBe('live');
    expect(json.note).toBe('Gemini 2.5 Flash active');
  });

  it('sets no-store cache control headers', async () => {
    const deps = createDeps({ mode: 'demo' });
    const req = new Request('http://localhost:3000/api/health');
    const res = await handleHealth(req, deps);

    expect(res.headers.get('Cache-Control')).toContain('no-store');
  });
});
