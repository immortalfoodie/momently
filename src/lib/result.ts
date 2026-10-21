/**
 * Discriminated union representing either a successful outcome or an error.
 * WHY: Enforces deterministic, typed error handling across engine domain functions without throwing runtime exceptions.
 */
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

/**
 * Creates a successful Result wrapping a value.
 * WHY: Provides standard factory for successful execution branches.
 *
 * @param value - The successful payload value.
 * @returns An ok Result variant.
 */
export function ok<T, E = never>(value: T): Result<T, E> {
  return { ok: true, value };
}

/**
 * Creates an error Result wrapping an error description or object.
 * WHY: Provides standard factory for anticipated domain errors without throwing.
 *
 * @param error - The domain error payload.
 * @returns An err Result variant.
 */
export function err<T = never, E = unknown>(error: E): Result<T, E> {
  return { ok: false, error };
}
