import type { EventPlan } from '@/domain/types';
import type {
  ConceptsRequest,
  ConceptsResponse,
  HealthResponse,
  IntakeRequest,
  IntakeResponse,
  MessageRequest,
  MessageResponse,
  NarrateRequest,
  NarrateResponse,
} from './contracts';
import { err, ok, type Result } from './result';

export interface ClientError {
  code: string;
  message: string;
  retryAfterSeconds?: number;
}

export interface ApiClientOptions {
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  baseUrl?: string;
}

const DEFAULT_TIMEOUT_MS = 45_000;

/** Number of most recent ledger entries kept in request payloads. */
export const SLIM_LEDGER_ENTRIES = 20;

/**
 * Returns a request-sized copy of a plan with the ledger cut to the most recent entries.
 * WHY: The server only needs the current state to classify and resolve a request; the full audit
 * ledger (up to 500 entries) would bloat every request. Patches are applied by the client to its
 * own full plan, so nothing is lost. The original plan object is never mutated.
 *
 * @param plan - The full client-side plan.
 * @returns A shallow copy whose ledger holds at most SLIM_LEDGER_ENTRIES entries.
 */
export function slimPlanForRequest(plan: EventPlan): EventPlan {
  if (!Array.isArray(plan.ledger)) return plan;
  return { ...plan, ledger: plan.ledger.slice(-SLIM_LEDGER_ENTRIES) };
}

// eslint-disable-next-line complexity
async function executeJsonRequest<TResponse>(
  url: string,
  method: 'GET' | 'POST',
  body?: unknown,
  options?: ApiClientOptions,
): Promise<Result<TResponse, ClientError>> {
  const fetchFn = options?.fetchFn ?? fetch;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const baseUrl = options?.baseUrl ?? '';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetchFn(`${baseUrl}${url}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      let errorBody: { error?: { code?: string; message?: string } } | undefined;
      try {
        errorBody = await response.json();
      } catch {
        // Non-JSON error response from edge proxy
      }

      const retryAfterHeader = response.headers.get('retry-after');
      const parsedRetry = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;
      const retryAfterSeconds = Number.isNaN(parsedRetry) ? undefined : parsedRetry;

      const code = errorBody?.error?.code ?? `http_${response.status}`;
      const message =
        errorBody?.error?.message ?? response.statusText ?? 'Request failed';

      return err({
        code,
        message,
        ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
      });
    }

    const json = (await response.json()) as TResponse;
    return ok(json);
  } catch (e) {
    clearTimeout(timer);

    if (e instanceof Error && e.name === 'AbortError') {
      return err({
        code: 'network',
        message: 'Request timed out after 45 seconds',
      });
    }

    return err({
      code: 'network',
      message: e instanceof Error ? e.message : 'Network connection failure',
    });
  }
}

/**
 * Fetches the application operational mode and health status.
 */
export async function fetchHealth(
  options?: ApiClientOptions,
): Promise<Result<HealthResponse, ClientError>> {
  return executeJsonRequest<HealthResponse>('/api/health', 'GET', undefined, options);
}

/**
 * Submits a natural language host brief to initialize an event celebration plan.
 */
export async function submitIntake(
  text: string,
  options?: ApiClientOptions,
): Promise<Result<IntakeResponse, ClientError>> {
  const payload: IntakeRequest = { text };
  return executeJsonRequest<IntakeResponse>('/api/intake', 'POST', payload, options);
}

/**
 * Sends a host instruction or query against an active EventPlan.
 */
export async function sendMessage(
  request: MessageRequest,
  options?: ApiClientOptions,
): Promise<Result<MessageResponse, ClientError>> {
  const payload: MessageRequest = { ...request, plan: slimPlanForRequest(request.plan) };
  return executeJsonRequest<MessageResponse>('/api/message', 'POST', payload, options);
}

/**
 * Requests an executive narrative grounded in verified plan facts.
 */
export async function requestNarration(
  request: NarrateRequest,
  options?: ApiClientOptions,
): Promise<Result<NarrateResponse, ClientError>> {
  return executeJsonRequest<NarrateResponse>('/api/narrate', 'POST', request, options);
}

/**
 * Requests fresh celebration concepts for an active plan.
 */
export async function requestConcepts(
  plan: EventPlan,
  options?: ApiClientOptions,
): Promise<Result<ConceptsResponse, ClientError>> {
  const payload: ConceptsRequest = { plan: slimPlanForRequest(plan) };
  return executeJsonRequest<ConceptsResponse>('/api/concepts', 'POST', payload, options);
}
