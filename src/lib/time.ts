/**
 * Pure date and time utilities for local-time calendar calculations and run-sheet scheduling.
 * WHY: Decouples UI components and engine coordinators from raw Date manipulation and timezone discrepancies.
 */

/**
 * Formats a Date into a local ISO calendar date string "YYYY-MM-DD".
 * Uses local calendar components (getFullYear, getMonth, getDate).
 */
export function localIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns the minute of the day (0-1439) for a Date using local hours and minutes.
 */
export function minuteOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * Parses a "HH:MM" time string into minute of day (0-1439).
 * Returns undefined if format is invalid or hours/minutes are out of bounds.
 */
export function parseTimeInput(timeStr: string): number | undefined {
  if (!/^\d{1,2}:\d{2}$/.test(timeStr)) return undefined;
  const parts = timeStr.split(':');
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (Number.isNaN(h) || Number.isNaN(m)) return undefined;
  if (h < 0 || h > 23 || m < 0 || m > 59) return undefined;
  return h * 60 + m;
}

/**
 * Converts a minute of the day into a zero-padded "HH:MM" string suitable for HTML time inputs.
 */
export function minuteToTimeInput(minute: number): string {
  const clamped = Math.max(0, Math.min(1439, Math.floor(minute)));
  const h = String(Math.floor(clamped / 60)).padStart(2, '0');
  const m = String(clamped % 60).padStart(2, '0');
  return `${h}:${m}`;
}
