import { describe, expect, it } from 'vitest';
import { err, ok, type Result } from '@/lib/result';
import { LlmCache } from '@/llm/cache';
import { runTask } from '@/llm/runTask';
import type { LlmError, LlmRequest, LLMProvider } from '@/llm/types';
import type { IntakeInput, IntakeOutput } from '@/llm/schemas/intake';

class ScriptedProvider implements LLMProvider {
  readonly name = 'scripted';
  callCount = 0;
  requests: LlmRequest[] = [];
  responses: Array<Result<string, LlmError> | (() => Result<string, LlmError>)>;

  constructor(responses: Array<Result<string, LlmError> | (() => Result<string, LlmError>)>) {
    this.responses = responses;
  }

  async complete(request: LlmRequest): Promise<Result<string, LlmError>> {
    this.callCount++;
    this.requests.push(request);
    const next = this.responses.shift();
    if (!next) {
      throw new Error('ScriptedProvider ran out of configured responses');
    }
    return typeof next === 'function' ? next() : next;
  }
}

describe('runTask Execution Pipeline', () => {
  const validInput: IntakeInput = {
    text: 'Birthday party for 50 guests in Mumbai',
    today: '2026-10-21',
  };

  const validOutput: IntakeOutput = {
    title: '50th Birthday Party',
    type: 'birthday',
    city: 'Mumbai',
    dateIso: '2026-11-15',
    guestCount: 50,
    setting: 'indoor',
    budgetCap: 100000,
    budgetIsHard: true,
    constraints: [],
    guestNeeds: {},
    styleTags: ['birthday'],
    missingInfo: [],
  };

  it('successfully extracts and validates plain JSON output from provider', async () => {
    const provider = new ScriptedProvider([ok(JSON.stringify(validOutput))]);
    const res = await runTask({
      provider,
      task: 'intake',
      input: validInput,
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.title).toBe('50th Birthday Party');
      expect(res.value.guestCount).toBe(50);
    }
    expect(provider.callCount).toBe(1);
  });

  it('strips markdown code fences from model response', async () => {
    const fenced = '```json\n' + JSON.stringify(validOutput) + '\n```';
    const provider = new ScriptedProvider([ok(fenced)]);
    const res = await runTask({
      provider,
      task: 'intake',
      input: validInput,
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.city).toBe('Mumbai');
    }
  });

  it('performs single correction retry when schema validation fails, then succeeds', async () => {
    const invalidJson = JSON.stringify({
      title: 'Invalid party',
      type: 'birthday',
      guestCount: -50, // Invalid: must be >= 1
    });

    const provider = new ScriptedProvider([
      ok(invalidJson),
      ok(JSON.stringify(validOutput)),
    ]);

    const res = await runTask({
      provider,
      task: 'intake',
      input: validInput,
    });

    expect(res.ok).toBe(true);
    expect(provider.callCount).toBe(2);
    // Verify correction note was sent in 2nd request
    expect(provider.requests[1]?.user).toContain('Correction Required');
    expect(provider.requests[1]?.user).toContain('guestCount');
  });

  it('returns invalid_output error when schema validation fails twice', async () => {
    const invalidJson = JSON.stringify({
      title: 'Still invalid',
      type: 'birthday',
      guestCount: -50,
    });

    const provider = new ScriptedProvider([ok(invalidJson), ok(invalidJson)]);
    const res = await runTask({
      provider,
      task: 'intake',
      input: validInput,
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('invalid_output');
      expect(res.error.retryable).toBe(false);
    }
    expect(provider.callCount).toBe(2);
  });

  it('retries on retryable provider error and succeeds on second attempt', async () => {
    const provider = new ScriptedProvider([
      err({ code: 'provider_unavailable', message: 'Network hiccup', retryable: true }),
      ok(JSON.stringify(validOutput)),
    ]);

    let sleptMs = 0;
    const res = await runTask({
      provider,
      task: 'intake',
      input: validInput,
      sleep: async (ms) => {
        sleptMs += ms;
      },
    });

    expect(res.ok).toBe(true);
    expect(provider.callCount).toBe(2);
    expect(sleptMs).toBeGreaterThan(0);
  });

  it('does not retry when provider returns a non-retryable error', async () => {
    const provider = new ScriptedProvider([
      err({ code: 'config', message: '401 Unauthorized', retryable: false }),
    ]);

    const res = await runTask({
      provider,
      task: 'intake',
      input: validInput,
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('config');
    }
    expect(provider.callCount).toBe(1);
  });

  it('rejects invalid input before calling provider with code invalid_input', async () => {
    const provider = new ScriptedProvider([ok(JSON.stringify(validOutput))]);
    const badInput = {
      text: '', // Invalid: min 1 char
      today: 'not-a-date',
    };

    const res = await runTask({
      provider,
      task: 'intake',
      input: badInput as unknown as IntakeInput,
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('invalid_input');
    }
    expect(provider.callCount).toBe(0);
  });

  it('calls provider once and reuses cache on second invocation', async () => {
    const provider = new ScriptedProvider([ok(JSON.stringify(validOutput))]);
    const cache = new LlmCache();

    const res1 = await runTask({
      provider,
      task: 'intake',
      input: validInput,
      cache,
    });
    expect(res1.ok).toBe(true);
    expect(provider.callCount).toBe(1);

    const res2 = await runTask({
      provider,
      task: 'intake',
      input: validInput,
      cache,
    });
    expect(res2.ok).toBe(true);
    expect(provider.callCount).toBe(1); // Not called again!
  });

  it('never throws even when provider throws an unexpected exception', async () => {
    const explodingProvider: LLMProvider = {
      name: 'exploding',
      async complete() {
        throw new Error('Catastrophic network socket explosion');
      },
    };

    const res = await runTask({
      provider: explodingProvider,
      task: 'intake',
      input: validInput,
      sleep: async () => {},
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('provider_unavailable');
    }
  });
});
