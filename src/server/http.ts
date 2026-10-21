import type { ApiErrorBody, ApiErrorCode } from '@/lib/contracts';
import { err, ok, type Result } from '@/lib/result';

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  status: number;
}

/**
 * Creates a JSON response with strict no-store caching headers.
 * WHY: Event plan operations and AI completions are sensitive, ephemeral, and must never be cached downstream.
 */
export function jsonResponse(
  body: unknown,
  status = 200,
  headers?: HeadersInit,
): Response {
  const mergedHeaders = new Headers(headers);
  mergedHeaders.set('Content-Type', 'application/json');
  mergedHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  return new Response(JSON.stringify(body), {
    status,
    headers: mergedHeaders,
  });
}

/**
 * Creates a standard structured error response.
 * WHY: Guarantees generic, safe error payloads that never leak stack traces, environment keys, or user inputs.
 */
export function errorResponse(
  code: ApiErrorCode,
  message: string,
  status: number,
  headers?: HeadersInit,
): Response {
  const payload: ApiErrorBody = {
    error: { code, message },
  };
  return jsonResponse(payload, status, headers);
}

/**
 * Reads, verifies length limits, and parses incoming JSON request bodies safely.
 * WHY: Enforces Content-Type checks, guards against chunked transfer-encoding size attacks, and prevents JSON parse bombs.
 */
export async function readJsonBody(
  req: Request,
  maxBytes: number,
): Promise<Result<unknown, ApiError>> {
  const contentType = req.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return err({
      code: 'unsupported_media_type',
      message: 'Content-Type must be application/json',
      status: 415,
    });
  }

  const contentLengthStr = req.headers.get('content-length');
  if (contentLengthStr) {
    const contentLength = parseInt(contentLengthStr, 10);
    if (!Number.isNaN(contentLength) && contentLength > maxBytes) {
      return err({
        code: 'payload_too_large',
        message: 'Request payload exceeds maximum allowed size',
        status: 413,
      });
    }
  }

  let text: string;
  try {
    text = await req.text();
  } catch {
    return err({
      code: 'invalid_request',
      message: 'Failed to read request body stream',
      status: 400,
    });
  }

  const actualBytes = new TextEncoder().encode(text).length;
  if (actualBytes > maxBytes) {
    return err({
      code: 'payload_too_large',
      message: 'Request payload exceeds maximum allowed size',
      status: 413,
    });
  }

  try {
    const parsed: unknown = JSON.parse(text);
    return ok(parsed);
  } catch {
    return err({
      code: 'invalid_request',
      message: 'Malformed JSON payload',
      status: 400,
    });
  }
}
