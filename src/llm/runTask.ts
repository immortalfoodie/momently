import { err, ok, type Result } from '@/lib/result';
import type { LlmCache } from './cache';
import { LLM_TASKS, type TaskInput, type TaskOutput } from './tasks';
import type { LlmError, LlmRequest, LlmTaskName, LLMProvider } from './types';
import type { z } from 'zod';

export interface RunTaskOptions<TTask extends LlmTaskName> {
  provider: LLMProvider;
  task: TTask;
  input: TaskInput<TTask>;
  cache?: LlmCache;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}
import { extractJson } from './extractJson';
export { extractJson };

function parseAndValidate<T>(
  rawText: string,
  schema: z.ZodType<T>,
): { ok: true; data: T } | { ok: false; issues: string } {
  const extracted = extractJson(rawText);
  if (!extracted) {
    return { ok: false, issues: 'No valid JSON object found in response' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extracted);
  } catch (e) {
    return {
      ok: false,
      issues: `JSON syntax error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    const issueList = result.error.issues
      .map((iss) => `${iss.path.join('.') || 'root'}: ${iss.message}`)
      .join('; ');
    return { ok: false, issues: issueList };
  }

  return { ok: true, data: result.data };
}

async function safeComplete(
  provider: LLMProvider,
  request: LlmRequest,
): Promise<Result<string, LlmError>> {
  try {
    return await provider.complete(request);
  } catch (e) {
    return err({
      code: 'provider_unavailable',
      message: e instanceof Error ? e.message : 'Unknown provider exception',
      retryable: true,
    });
  }
}

async function executeWithRetry(
  provider: LLMProvider,
  request: LlmRequest,
  sleep: (ms: number) => Promise<void>,
): Promise<Result<string, LlmError>> {
  let res = await safeComplete(provider, request);
  if (!res.ok && res.error.retryable) {
    await sleep(250);
    res = await safeComplete(provider, request);
  }
  return res;
}

async function retryWithCorrection<T>(
  provider: LLMProvider,
  request: LlmRequest,
  issues: string,
  schema: z.ZodType<T>,
): Promise<Result<T, LlmError>> {
  const correctionRequest: LlmRequest = {
    ...request,
    user: `${request.user}\n\nCorrection Required: The previous output failed schema validation.\nIssues: ${issues}\nPlease provide ONLY the corrected, valid JSON object matching the required schema.`,
  };
  const res = await safeComplete(provider, correctionRequest);
  if (!res.ok) return res;

  const validation = parseAndValidate<T>(res.value, schema);
  if (!validation.ok) {
    return err({
      code: 'invalid_output',
      message: `Output failed schema validation after correction: ${validation.issues}`,
      retryable: false,
    });
  }
  return ok(validation.data);
}

function validateTaskInput<TTask extends LlmTaskName>(
  task: TTask,
  input: unknown,
): Result<TaskInput<TTask>, LlmError> {
  const taskDef = LLM_TASKS[task];
  const inputResult = taskDef.inputSchema.safeParse(input);
  if (!inputResult.success) {
    const issueList = inputResult.error.issues
      .map((iss) => `${iss.path.join('.') || 'root'}: ${iss.message}`)
      .join('; ');
    return err({
      code: 'invalid_input',
      message: `Invalid input for task "${task}": ${issueList}`,
      retryable: false,
    });
  }
  return ok(inputResult.data as TaskInput<TTask>);
}

async function resolveOutput<TTask extends LlmTaskName>(
  provider: LLMProvider,
  request: LlmRequest,
  taskDef: (typeof LLM_TASKS)[TTask],
  rawOutput: string,
): Promise<Result<TaskOutput<TTask>, LlmError>> {
  type OutputType = TaskOutput<TTask>;
  const outputSchema = taskDef.outputSchema as unknown as z.ZodType<OutputType>;
  const validation = parseAndValidate<OutputType>(rawOutput, outputSchema);

  if (!validation.ok) {
    return retryWithCorrection(provider, request, validation.issues, outputSchema);
  }
  return ok(validation.data);
}

function getFromCache<T>(cache: LlmCache | undefined, key: string | undefined): T | undefined {
  if (!cache || !key) return undefined;
  return cache.get<T>(key);
}

function saveToCache<T>(cache: LlmCache | undefined, key: string | undefined, data: T): void {
  if (cache && key) {
    cache.set(key, data);
  }
}

/**
 * Orchestrates an end-to-end LLM task execution pipeline with input validation, caching,
 * provider retry on transient errors, JSON extraction, schema validation, and single-shot correction.
 * WHY: Guarantees that callers always receive verified, type-safe data and never throws unhandled exceptions.
 */
export async function runTask<TTask extends LlmTaskName>(
  options: RunTaskOptions<TTask>,
): Promise<Result<TaskOutput<TTask>, LlmError>> {
  const { provider, task, input, cache } = options;
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));

  // 1. Validate structured input
  const validated = validateTaskInput(task, input);
  if (!validated.ok) return validated;
  const validatedInput = validated.value;

  // 2. Cache lookup
  const cacheKey = cache?.computeKey(task, validatedInput);
  const cached = getFromCache<TaskOutput<TTask>>(cache, cacheKey);
  if (cached !== undefined) return ok(cached);

  // 3. Build task prompt
  const taskDef = LLM_TASKS[task];
  const { system, user } = (
    taskDef.build as (inp: TaskInput<TTask>) => { system: string; user: string }
  )(validatedInput);

  const request: LlmRequest = {
    task,
    system,
    user,
    input: validatedInput,
    temperature: taskDef.temperature,
    maxOutputTokens: taskDef.maxOutputTokens,
    timeoutMs: taskDef.timeoutMs,
  };

  // 4. Complete via provider with 1 retry on retryable errors
  const responseResult = await executeWithRetry(provider, request, sleep);
  if (!responseResult.ok) return responseResult;

  // 5. Extract, parse, and validate output schema with correction retry
  const outputResult = await resolveOutput(provider, request, taskDef, responseResult.value);
  if (!outputResult.ok) return outputResult;

  // 6. Cache successful result
  saveToCache(cache, cacheKey, outputResult.value);

  return outputResult;
}
