import type { EventPlan, ScheduleSlot } from '@/domain/types';
import { err, ok, type Result } from '@/lib/result';

const utf8Encoder = new TextEncoder();
const MAX_LINE_OCTETS = 75;

/**
 * Escapes special characters in iCalendar TEXT values per RFC 5545 Section 3.3.11.
 * Escapes backslash, semicolon, comma, and line breaks (`\r\n`, `\r`, `\n` -> `\n`).
 */
export function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/**
 * Folds an iCalendar content line at 75 UTF-8 octets per RFC 5545 Section 3.1.
 * Iterates by Unicode code points so multi-byte characters (such as `₹`, Devanagari, or emoji)
 * are never split across line boundaries. Continuation lines begin with a single space (` `).
 */
export function foldIcsLine(line: string): string {
  if (utf8Encoder.encode(line).length <= MAX_LINE_OCTETS) {
    return line;
  }

  const segments: string[] = [];
  let currentSegment = '';
  let currentBytes = 0;

  for (const char of line) {
    const charBytes = utf8Encoder.encode(char).length;
    if (currentBytes + charBytes > MAX_LINE_OCTETS) {
      segments.push(currentSegment);
      currentSegment = ` ${char}`;
      currentBytes = 1 + charBytes;
    } else {
      currentSegment += char;
      currentBytes += charBytes;
    }
  }

  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  return segments.join('\r\n');
}

function formatUtcTimestamp(date: Date): string {
  const y = String(date.getUTCFullYear()).padStart(4, '0');
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  return `${y}${m}${d}T${hh}${mm}${ss}Z`;
}

function formatFloatingDateTime(dateIso: string, minuteOfDay: number): string {
  const parts = dateIso.slice(0, 10).split('-').map(Number);
  const year = parts[0] ?? 2026;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;

  const dt = new Date(Date.UTC(year, month - 1, day, 0, minuteOfDay, 0));
  const y = String(dt.getUTCFullYear()).padStart(4, '0');
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  const hh = String(dt.getUTCHours()).padStart(2, '0');
  const mm = String(dt.getUTCMinutes()).padStart(2, '0');
  return `${y}${m}${d}T${hh}${mm}00`;
}

function buildVEventLines(
  plan: EventPlan,
  slot: ScheduleSlot,
  dateIso: string,
  dtstamp: string,
): string[] {
  const dtStart = formatFloatingDateTime(dateIso, slot.startMinute);
  const dtEnd = formatFloatingDateTime(dateIso, slot.startMinute + slot.durationMinutes);
  const summary = escapeIcsText(`${slot.title} - ${plan.meta.title}`);
  const description = escapeIcsText(slot.note ?? '');
  const uid = `${plan.id}-${slot.id}@momently.local`;

  return [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    'END:VEVENT',
  ];
}

/**
 * Generates an RFC 5545 `.ics` calendar file containing one `VEVENT` per schedule slot.
 *
 * ARCHITECTURAL DECISION (WHY FLOATING TIME):
 * `DTSTART` and `DTEND` are emitted without a `Z` suffix or `TZID` parameter (floating local time).
 * A 7:00 PM ceremony in a run-of-show should display as 7:00 PM in the host's calendar app
 * regardless of the device's current timezone setting.
 *
 * @param plan - Active EventPlan.
 * @param now - Injected clock timestamp used for `DTSTAMP` in UTC.
 * @returns Result containing CRLF-delimited `.ics` content or a descriptive error message.
 */
export function buildIcs(
  plan: EventPlan,
  now: Date,
): Result<string, { message: string }> {
  const dateIso = plan.meta.dateIso;
  if (!dateIso) {
    return err({ message: 'Set an event date first' });
  }
  if (plan.schedule.length === 0) {
    return err({ message: 'Add at least one session to the timeline' });
  }

  const dtstamp = formatUtcTimestamp(now);
  const sortedSlots = [...plan.schedule].sort((a, b) => a.startMinute - b.startMinute);

  const logicalLines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Momently//Event Kit//EN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeIcsText(plan.meta.title)}`,
  ];

  for (const slot of sortedSlots) {
    logicalLines.push(...buildVEventLines(plan, slot, dateIso, dtstamp));
  }

  logicalLines.push('END:VCALENDAR');

  const folded = logicalLines.map(foldIcsLine).join('\r\n');
  return ok(`${folded}\r\n`);
}
