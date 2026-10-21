import type { Result } from '@/lib/result';
import { runTask } from '@/llm/runTask';
import type { TaskInput, TaskOutput } from '@/llm/tasks';
import type { LlmError, LlmTaskName } from '@/llm/types';
import type { Deps } from './deps';

export interface FallbackResult<T> {
  result: Result<T, LlmError>;
  degraded: boolean;
}

const PROVIDER_FAILURE_CODES = new Set([
  'provider_unavailable',
  'timeout',
  'rate_limited',
  'config',
  'blocked',
  'invalid_output',
]);

/**
 * Runs an LLM task against the primary provider with automatic degradation to the offline Mock provider.
 * WHY: High-availability resilience ensures that API failures, network dropouts, or token rate limits
 * never crash the application or leave hosts stranded during a celebration planning session.
 *
 * NOTE: 'invalid_input' is a caller bug and is NEVER masked or retried with fallback.
 */
export async function runWithFallback<TTask extends LlmTaskName>(
  deps: Deps,
  task: TTask,
  input: TaskInput<TTask>,
): Promise<FallbackResult<TaskOutput<TTask>>> {
  try {
    const primaryResult = await runTask({
      provider: deps.provider,
      task,
      input,
      cache: deps.cache,
    });

    if (primaryResult.ok) {
      return { result: primaryResult, degraded: false };
    }

    const { code } = primaryResult.error;

    // Never mask client validation errors with mock fallback
    if (code === 'invalid_input') {
      return { result: primaryResult, degraded: false };
    }

    // Only fallback if the failure is provider-level or persistent invalid_output,
    // and the primary provider is not already the mock provider.
    const isMock = deps.provider.name === deps.mockProvider.name || deps.mode === 'demo';
    if (PROVIDER_FAILURE_CODES.has(code) && !isMock) {
      const mockResult = await runTask({
        provider: deps.mockProvider,
        task,
        input,
        cache: deps.cache,
      });

      return {
        result: mockResult,
        degraded: true,
      };
    }

    return { result: primaryResult, degraded: false };
  } catch (e) {
    return {
      result: {
        ok: false,
        error: {
          code: 'provider_unavailable',
          message: e instanceof Error ? e.message : 'Unexpected execution error',
          retryable: false,
        },
      },
      degraded: false,
    };
  }
}
