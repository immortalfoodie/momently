import { describe, expect, it } from 'vitest';
import { buildDemoPlan } from '@/engine/demo';
import { buildIcs, foldIcsLine } from '@/lib/export/ics';
import { createIdFactory } from '@/lib/id';

const ctx = {
  ids: createIdFactory('export_ics_test'),
  clock: () => new Date('2026-10-21T14:30:45.000Z'),
};

interface ParsedIcs {
  unfoldedLines: string[];
  balanced: boolean;
  calendarProps: Map<string, string>;
  events: Array<Map<string, string>>;
}

function recordPropertyLine(
  line: string,
  currentEvent: Map<string, string> | null,
  calendarProps: Map<string, string>,
): void {
  const colonIdx = line.indexOf(':');
  if (colonIdx <= 0) return;
  const key = line.slice(0, colonIdx);
  const val = line.slice(colonIdx + 1);
  const target = currentEvent ?? calendarProps;
  target.set(key, val);
}

function parseTestIcs(raw: string): ParsedIcs {
  const unfolded = raw.replace(/\r\n /g, '');
  const lines = unfolded.split('\r\n').filter((l) => l.length > 0);

  const stack: string[] = [];
  let balanced = true;
  const calendarProps = new Map<string, string>();
  const events: Array<Map<string, string>> = [];
  let currentEvent: Map<string, string> | null = null;

  for (const line of lines) {
    if (line.startsWith('BEGIN:')) {
      const block = line.slice(6);
      stack.push(block);
      if (block === 'VEVENT') currentEvent = new Map();
    } else if (line.startsWith('END:')) {
      const block = line.slice(4);
      if (stack.pop() !== block) balanced = false;
      if (block === 'VEVENT' && currentEvent) {
        events.push(currentEvent);
        currentEvent = null;
      }
    } else {
      recordPropertyLine(line, currentEvent, calendarProps);
    }
  }

  return {
    unfoldedLines: lines,
    balanced: balanced && stack.length === 0,
    calendarProps,
    events,
  };
}

describe('Export: ICS Calendar Builder (RFC 5545)', () => {
  it('returns an error when dateIso is missing or schedule is empty', () => {
    const { plan } = buildDemoPlan(ctx);

    const noDatePlan = {
      ...plan,
      meta: { ...plan.meta, dateIso: undefined },
    };
    const resNoDate = buildIcs(noDatePlan, ctx.clock());
    expect(resNoDate).toEqual({
      ok: false,
      error: { message: 'Set an event date first' },
    });

    const noSlotsPlan = {
      ...plan,
      schedule: [],
    };
    const resNoSlots = buildIcs(noSlotsPlan, ctx.clock());
    expect(resNoSlots).toEqual({
      ok: false,
      error: { message: 'Add at least one session to the timeline' },
    });
  });

  it('uses CRLF everywhere, balances BEGIN/END, sets DTSTAMP from injected clock, and computes DTEND = start + duration', () => {
    const { plan } = buildDemoPlan(ctx);
    const res = buildIcs(plan, ctx.clock());
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const raw = res.value;
    // Must end with CRLF and contain no bare LF without preceding CR
    expect(raw.endsWith('\r\n')).toBe(true);
    expect(raw.replace(/\r\n/g, '').includes('\n')).toBe(false);

    // Every physical line must be <= 75 UTF-8 octets
    const encoder = new TextEncoder();
    for (const physicalLine of raw.split('\r\n')) {
      expect(encoder.encode(physicalLine).length).toBeLessThanOrEqual(75);
    }

    const parsed = parseTestIcs(raw);
    expect(parsed.balanced).toBe(true);
    expect(parsed.calendarProps.get('VERSION')).toBe('2.0');
    expect(parsed.calendarProps.get('CALSCALE')).toBe('GREGORIAN');
    expect(parsed.calendarProps.get('PRODID')).toBeTruthy();
    expect(parsed.calendarProps.get('X-WR-CALNAME')).toBe(plan.meta.title);

    expect(parsed.events).toHaveLength(plan.schedule.length);

    const uids = new Set<string>();
    const sortedSlots = [...plan.schedule].sort((a, b) => a.startMinute - b.startMinute);

    parsed.events.forEach((ev, idx) => {
      const slot = sortedSlots[idx]!;
      const uid = ev.get('UID')!;
      uids.add(uid);
      expect(uid).toBe(`${plan.id}-${slot.id}@momently.local`);
      expect(ev.get('DTSTAMP')).toBe('20261021T143045Z');

      // Floating local time (no trailing Z)
      const dtStart = ev.get('DTSTART')!;
      const dtEnd = ev.get('DTEND')!;
      expect(dtStart.endsWith('Z')).toBe(false);
      expect(dtEnd.endsWith('Z')).toBe(false);

      const startH = Math.floor(slot.startMinute / 60);
      const startM = slot.startMinute % 60;
      const endMin = slot.startMinute + slot.durationMinutes;
      const endH = Math.floor((endMin % 1440) / 60);
      const endM = endMin % 60;
      const endDay = endMin >= 1440 ? '16' : '15';
      expect(dtStart).toBe(
        `20261215T${String(startH).padStart(2, '0')}${String(startM).padStart(2, '0')}00`,
      );
      expect(dtEnd).toBe(
        `202612${endDay}T${String(endH).padStart(2, '0')}${String(endM).padStart(2, '0')}00`,
      );
    });

    expect(uids.size).toBe(plan.schedule.length);
  });

  it('folds lines longer than 75 octets without splitting multi-byte UTF-8 characters and escapes ; , \\ and newlines', () => {
    const { plan } = buildDemoPlan(ctx);
    const multiByteNote =
      'संगीत संध्या ₹1,50,000; स्पेशल नोट \\ "कोट्स"\nदूसरी पंक्ति 🎉🎊✨ संगीत संध्या ₹1,50,000; स्पेशल नोट';

    const customPlan = {
      ...plan,
      schedule: [
        {
          id: 'slot_mb',
          title: 'Ceremony; Welcome, Blessings \\ Entry',
          startMinute: 600,
          durationMinutes: 90,
          priority: 'essential' as const,
          flexible: false,
          note: multiByteNote,
        },
      ],
    };

    const res = buildIcs(customPlan, ctx.clock());
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const encoder = new TextEncoder();
    for (const physicalLine of res.value.split('\r\n')) {
      expect(encoder.encode(physicalLine).length).toBeLessThanOrEqual(75);
      // Verify no U+FFFD replacement character from broken UTF-8 sequences
      expect(physicalLine.includes('\uFFFD')).toBe(false);
    }

    const parsed = parseTestIcs(res.value);
    const ev = parsed.events[0]!;
    expect(ev.get('SUMMARY')).toBe(
      `Ceremony\\; Welcome\\, Blessings \\\\ Entry - ${plan.meta.title}`,
    );
    expect(ev.get('DESCRIPTION')).toContain('\\;');
    expect(ev.get('DESCRIPTION')).toContain('\\,');
    expect(ev.get('DESCRIPTION')).toContain('\\\\');
    expect(ev.get('DESCRIPTION')).toContain('\\n');

    // Direct fold/unfold round-trip check
    const longDevanagari = `DESCRIPTION:${'नमस्ते₹🎉'.repeat(20)}`;
    const folded = foldIcsLine(longDevanagari);
    expect(folded.split('\r\n').length).toBeGreaterThan(2);
    expect(folded.replace(/\r\n /g, '')).toBe(longDevanagari);
  });
});
