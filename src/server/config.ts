/**
 * Server operational configuration constants.
 * WHY: Centralizes payload size limits, sliding window rate limits, and execution timeouts.
 */

export const MAX_BODY_BYTES_INTAKE = 8_000;
export const MAX_BODY_BYTES_MESSAGE = 200_000;
export const MAX_BODY_BYTES_NARRATE = 20_000;

export const DEFAULT_RATE_LIMIT_PER_MINUTE = 30;
export const MIN_RATE_LIMIT_PER_MINUTE = 1;
export const MAX_RATE_LIMIT_PER_MINUTE = 120;

export const MAX_TRACKED_CLIENTS = 5000;

export const ROUTE_TIMEOUT_SECONDS = 30;
export const CLIENT_FETCH_TIMEOUT_MS = 45_000;
