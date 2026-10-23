import type { EventPlan, EventType } from '@/domain/types';
import { formatMinuteOfDay } from '@/lib/format';

export type InvitationTone = 'warm' | 'formal' | 'playful';

const EVENT_TYPE_PHRASES: Record<EventType, string> = {
  wedding: 'wedding celebration',
  birthday: 'birthday celebration',
  anniversary: 'anniversary celebration',
  community: 'community gathering',
};

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * Formats a YYYY-MM-DD date string into a long human-friendly calendar date
 * (e.g. "Tuesday, 15 December 2026"), or "[date to be confirmed]" if absent.
 */
export function formatLongDate(dateIso?: string): string {
  if (!dateIso) return '[date to be confirmed]';
  const parts = dateIso.slice(0, 10).split('-').map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (!year || !month || !day) return '[date to be confirmed]';

  const dt = new Date(Date.UTC(year, month - 1, day));
  const weekday = WEEKDAYS[dt.getUTCDay()] ?? '';
  const monthName = MONTHS[month - 1] ?? '';
  return `${weekday}, ${day} ${monthName} ${year}`;
}

function getFirstStartTime(plan: EventPlan): string | null {
  if (plan.schedule.length === 0) return null;
  const sorted = [...plan.schedule].sort((a, b) => a.startMinute - b.startMinute);
  return formatMinuteOfDay(sorted[0]!.startMinute);
}

function getSelectedTagline(plan: EventPlan): string | null {
  if (!plan.selectedConceptId) return null;
  const concept = plan.concepts.find((c) => c.id === plan.selectedConceptId);
  return concept?.tagline ?? null;
}

/**
 * Deterministically builds guest invitation copy from plan facts without AI.
 *
 * PRIVACY & SAFETY (WHY):
 * Strictly omits budgets, caps, prices, dietary counts, and unverified accessibility claims.
 * Keeps host-specific details as explicit bracketed placeholders (`[Host names]`,
 * `[Venue name and address]`, `[RSVP contact and date]`) for the host to fill in.
 *
 * @param plan - Active EventPlan.
 * @param tone - Selected invitation tone ('warm' | 'formal' | 'playful').
 * @returns Plain-text invitation ready to copy and customize.
 */
export function buildInvitationText(plan: EventPlan, tone: InvitationTone): string {
  const typePhrase = EVENT_TYPE_PHRASES[plan.meta.type];
  const title = plan.meta.title;
  const longDate = formatLongDate(plan.meta.dateIso);
  const startTime = getFirstStartTime(plan);
  const city = plan.meta.city;
  const tagline = getSelectedTagline(plan);

  const timeClause = startTime ? ` starting at ${startTime}` : '';
  const taglineLine = tagline ? `\n"${tagline}"\n` : '';

  if (tone === 'formal') {
    return [
      '[Host names] cordially request the pleasure of your company',
      `at the ${typePhrase}:`,
      '',
      title,
      ...(taglineLine ? [taglineLine.trim()] : []),
      '',
      `Date: ${longDate}${timeClause}`,
      `Location: [Venue name and address], ${city}`,
      '',
      'Kindly respond by [RSVP contact and date].',
    ].join('\n');
  }

  if (tone === 'playful') {
    return [
      `Save the date! [Host names] would love for you to join our ${typePhrase}!`,
      '',
      `${title}`,
      ...(taglineLine ? [taglineLine.trim()] : []),
      '',
      `When: ${longDate}${timeClause}`,
      `Where: [Venue name and address], ${city}`,
      '',
      'Let us know you are coming: [RSVP contact and date]. We cannot wait to celebrate together!',
    ].join('\n');
  }

  // Default: 'warm'
  return [
    `With joy and gratitude, [Host names] warmly invite you to share in our ${typePhrase}:`,
    '',
    title,
    ...(taglineLine ? [taglineLine.trim()] : []),
    '',
    `Date: ${longDate}${timeClause}`,
    `Venue: [Venue name and address], ${city}`,
    '',
    'Your presence would mean the world to us. Please RSVP via [RSVP contact and date].',
  ].join('\n');
}
