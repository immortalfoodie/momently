import type { Result } from '@/lib/result';

/**
 * Supported LLM operational task identifiers.
 * WHY: Strict union typing prevents invalid prompt execution and routes typed I/O schemas.
 */
export type LlmTaskName = 'intake' | 'concepts' | 'intent' | 'narrate';

/**
 * Standard error codes returned by the LLM layer.
 * WHY: Disambiguates operational failures (e.g. rate limits, network timeouts) from validation rejections.
 */
export type LlmErrorCode =
  | 'invalid_input'
  | 'invalid_output'
  | 'provider_unavailable'
  | 'timeout'
  | 'rate_limited'
  | 'blocked'
  | 'config';

/**
 * Structured LLM error record.
 * WHY: Guides deterministic retry strategies without throwing uncontrolled exceptions.
 */
export interface LlmError {
  code: LlmErrorCode;
  message: string;
  retryable: boolean;
}

/**
 * Standard payload passed to an LLM provider.
 * WHY: Encapsulates prompt instructions, hyperparameters, and raw typed input for offline mock execution.
 */
export interface LlmRequest {
  task: LlmTaskName;
  system: string;
  user: string;
  input: unknown;
  temperature: number;
  maxOutputTokens: number;
  timeoutMs: number;
}

/**
 * Provider contract for completing LLM requests.
 * WHY: Decouples prompt execution from concrete model backends (Gemini API vs offline Mock).
 */
export interface LLMProvider {
  readonly name: string;
  complete(request: LlmRequest): Promise<Result<string, LlmError>>;
}
