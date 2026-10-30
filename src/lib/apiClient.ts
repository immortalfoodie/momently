import type { EventPlan } from '@/domain/types';
import type {
  ChaosDescribeRequest,
  ChaosDescribeResponse,
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

function buildHeaders(hasBody: boolean): Record<string, string> {
  return hasBody
    ? { Accept: 'application/json', 'Content-Type': 'application/json' }
    : { Accept: 'application/json' };
}

function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = parseInt(header, 10);
  return Number.isNaN(seconds) ? undefined : seconds;
}

async function readErrorBody(
  response: Response,
): Promise<{ error?: { code?: string; message?: string } } | undefined> {
  try {
    return await response.json();
  } catch {
    // Non-JSON error response from an edge proxy
    return undefined;
  }
}

async function toClientError(response: Response): Promise<ClientError> {
  const errorBody = await readErrorBody(response);
  const retryAfterSeconds = parseRetryAfter(response.headers.get('retry-after'));
  return {
    code: errorBody?.error?.code ?? `http_${response.status}`,
    message: errorBody?.error?.message ?? response.statusText ?? 'Request failed',
    ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
  };
}

function toNetworkError(e: unknown): ClientError {
  if (e instanceof Error && e.name === 'AbortError') {
    return { code: 'network', message: 'Request timed out after 45 seconds' };
  }
  return { code: 'network', message: e instanceof Error ? e.message : 'Network connection failure' };
}

async function executeJsonRequest<TResponse>(
  url: string,
  method: 'GET' | 'POST',
  body?: unknown,
  options?: ApiClientOptions,
): Promise<Result<TResponse, ClientError>> {
  const fetchFn = options?.fetchFn ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options?.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetchFn(`${options?.baseUrl ?? ''}${url}`, {
      method,
      headers: buildHeaders(body !== undefined),
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    if (!response.ok) return err(await toClientError(response));
    return ok((await response.json()) as TResponse);
  } catch (e) {
    return err(toNetworkError(e));
  } finally {
    clearTimeout(timer);
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

/**
 * Maps a host's free-text disaster description to simulatable Chaos Lab scenarios.
 */
export async function describeChaos(
  request: ChaosDescribeRequest,
  options?: ApiClientOptions,
): Promise<Result<ChaosDescribeResponse, ClientError>> {
  return executeJsonRequest<ChaosDescribeResponse>('/api/chaos/describe', 'POST', request, options);
}
