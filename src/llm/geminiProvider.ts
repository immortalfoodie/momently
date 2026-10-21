import { GoogleGenAI } from '@google/genai';
import { err, ok, type Result } from '@/lib/result';
import type { LlmError, LlmRequest, LLMProvider } from './types';

export interface GeminiClientLike {
  models: {
    generateContent(params: {
      model: string;
      contents: string;
      config?: {
        systemInstruction?: string;
        temperature?: number;
        maxOutputTokens?: number;
        responseMimeType?: string;
        abortSignal?: AbortSignal;
      };
    }): Promise<{
      text?: string;
      candidates?: Array<{
        finishReason?: string;
      }>;
      promptFeedback?: {
        blockReason?: string;
      };
    }>;
  };
}

export interface GeminiProviderOptions {
  apiKey: string;
  model?: string;
  client?: GeminiClientLike;
}

const BLOCKED_FINISH_REASONS = new Set(['SAFETY', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII']);
const AUTH_KEYWORDS = ['401', '403', 'api_key_invalid', 'unauthorized', 'permission_denied'];

function isFinishReasonBlocked(reason?: string): boolean {
  return reason !== undefined && BLOCKED_FINISH_REASONS.has(reason.toUpperCase());
}

function checkResponseSafety(response: {
  text?: string;
  candidates?: Array<{ finishReason?: string }>;
  promptFeedback?: { blockReason?: string };
}): Result<string, LlmError> {
  if (response.promptFeedback?.blockReason) {
    return err({ code: 'blocked', message: 'Prompt was blocked by safety filters', retryable: false });
  }

  const candidate = response.candidates?.[0];
  if (isFinishReasonBlocked(candidate?.finishReason)) {
    return err({ code: 'blocked', message: 'Model completion was blocked by safety filters', retryable: false });
  }

  if (!response.text) {
    return err({ code: 'provider_unavailable', message: 'Empty response returned from Gemini API', retryable: true });
  }

  return ok(response.text);
}

function isTimeoutError(name: string, message: string): boolean {
  return name === 'AbortError' || name === 'TimeoutError' || message.includes('timeout') || message.includes('aborted');
}

function isRateLimitError(status?: number, message = ''): boolean {
  return status === 429 || message.includes('429') || message.includes('resource_exhausted') || message.includes('rate limit');
}

function isAuthError(status?: number, message = ''): boolean {
  if (status === 401 || status === 403) return true;
  return AUTH_KEYWORDS.some((kw) => message.includes(kw));
}

function isSafetyError(message: string): boolean {
  return message.includes('safety') || message.includes('blocked') || message.includes('prohibited');
}

/**
 * Concrete LLM provider communicating with Google Gemini via the official @google/genai SDK.
 * WHY: Delivers live generative completions with strict JSON output configuration, timeout controls,
 * and sanitized error boundaries preventing API key or prompt leaks.
 */
export class GeminiProvider implements LLMProvider {
  readonly name = 'gemini';
  private readonly model: string;
  private readonly client: GeminiClientLike;

  constructor(options: GeminiProviderOptions) {
    this.model = options.model ?? 'gemini-2.5-flash';
    this.client = options.client ?? new GoogleGenAI({ apiKey: options.apiKey });
  }

  async complete(request: LlmRequest): Promise<Result<string, LlmError>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort(new Error('Request timed out'));
    }, request.timeoutMs);

    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: request.user,
        config: {
          systemInstruction: request.system,
          responseMimeType: 'application/json',
          temperature: request.temperature,
          maxOutputTokens: request.maxOutputTokens,
          abortSignal: controller.signal,
        },
      });

      return checkResponseSafety(response);
    } catch (e: unknown) {
      return this.mapError(e);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private mapError(e: unknown): Result<string, LlmError> {
    const errorObj = e as { name?: string; message?: string; status?: number; code?: number };
    const name = errorObj.name ?? '';
    const message = (errorObj.message ?? '').toLowerCase();
    const status = errorObj.status ?? errorObj.code;

    if (isTimeoutError(name, message)) {
      return err({ code: 'timeout', message: 'Gemini request timed out', retryable: true });
    }
    if (isRateLimitError(status, message)) {
      return err({ code: 'rate_limited', message: 'Gemini API rate limit exceeded (HTTP 429)', retryable: true });
    }
    if (isAuthError(status, message)) {
      return err({ code: 'config', message: 'Gemini API authentication failed (401/403)', retryable: false });
    }
    if (isSafetyError(message)) {
      return err({ code: 'blocked', message: 'Gemini request blocked by safety policies', retryable: false });
    }
    return err({ code: 'provider_unavailable', message: 'Gemini service unavailable', retryable: true });
  }
}
