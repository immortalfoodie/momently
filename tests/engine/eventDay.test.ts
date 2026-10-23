import { describe, expect, it } from 'vitest';
import type { Contact } from '@/domain/contactSchemas';
import type { EventPlan, ScheduleSlot } from '@/domain/types';
import { DEMO_SCENARIO } from '@/data/demoScenario';
import { createPlan } from '@/engine/planFactory';
import { createIdFactory } from '@/lib/id';
import {
  contactsGroupedByCategory,
  dayStatus,
  isEventToday,
  selectDayTasks,
} from '@/engine/eventDay';
import {
  localIsoDate,
  minuteOfDay,
  minuteToTimeInput,
  parseTimeInput,
} from '@/lib/time';

describe('Pure time helpers (src/lib/time.ts)', () => {
  it('formats local ISO calendar date using local date components', () => {
    const d = new Date(2026, 11, 15, 14, 30); // 15 Dec 2026
    expect(localIsoDate(d)).toBe('2026-12-15');
  });

  it('calculates minute of day in local time', () => {
    const d = new Date(2026, 5, 1, 19, 42); // 7:42 PM = 19 * 60 + 42 = 1182
    expect(minuteOfDay(d)).toBe(1182);
  });

  it('parses valid HH:MM inputs and rejects invalid strings or out-of-range bounds', () => {
    expect(parseTimeInput('10:00')).toBe(600);
    expect(parseTimeInput('00:00')).toBe(0);
    expect(parseTimeInput('23:59')).toBe(1439);
    expect(parseTimeInput('24:00')).toBeUndefined();
    expect(parseTimeInput('12:60')).toBeUndefined();
    expect(parseTimeInput('invalid')).toBeUndefined();
    expect(parseTimeInput('')).toBeUndefined();
  });

  it('formats minutes to HH:MM time inputs with clamping', () => {
    expect(minuteToTimeInput(0)).toBe('00:00');
    expect(minuteToTimeInput(600)).toBe('10:00');
    expect(minuteToTimeInput(1439)).toBe('23:59');
    expect(minuteToTimeInput(-10)).toBe('00:00');
    expect(minuteToTimeInput(2000)).toBe('23:59');
  });
});

describe('dayStatus operational coordinator (src/engine/eventDay.ts)', () => {
  const sampleSlots: ScheduleSlot[] = [
    { id: 's1', title: 'Welcome Drinks', startMinute: 600, durationMinutes: 60, priority: 'important', flexible: true },
    { id: 's2', title: 'Grand Entrance', startMinute: 660, durationMinutes: 30, priority: 'essential', flexible: false },
    { id: 's3', title: 'Dinner Buffet', startMinute: 720, durationMinutes: 90, priority: 'important', flexible: true },
    { id: 's4', title: 'Dessert & Speeches', startMinute: 810, durationMinutes: 45, priority: 'optional', flexible: true },
  ];

  it('returns phase "before" with empty lists on an empty schedule', () => {
    const res = dayStatus([], 600);
    expect(res.phase).toBe('before');
    expect(res.current).toBeUndefined();
    expect(res.next).toBeUndefined();
    expect(res.concurrent).toEqual([]);
    expect(res.later).toEqual([]);
  });

  it('detects phase "before" prior to the earliest session', () => {
    const res = dayStatus(sampleSlots, 540); // 9:00 AM (first is 10:00 AM)
    expect(res.phase).toBe('before');
    expect(res.current).toBeUndefined();
    expect(res.next?.id).toBe('s1');
    expect(res.minutesUntilNext).toBe(60);
    expect(res.later.map((s) => s.id)).toEqual(['s2', 's3', 's4']);
  });

  it('detects phase "during" and calculates minutes left and next up', () => {
    const res = dayStatus(sampleSlots, 620); // 10:20 AM (s1 is 600-660)
    expect(res.phase).toBe('during');
    expect(res.current?.id).toBe('s1');
    expect(res.minutesLeftInCurrent).toBe(40);
    expect(res.next?.id).toBe('s2');
    expect(res.minutesUntilNext).toBe(40);
  });

  it('respects boundary minutes: start minute is active, end minute is not active', () => {
    // Exactly at start minute of s2 (660): s1 is done, s2 is active
    const at660 = dayStatus(sampleSlots, 660);
    expect(at660.phase).toBe('during');
    expect(at660.current?.id).toBe('s2');

    // Exactly at end minute of s2 (690): gap until s3 (720)
    const at690 = dayStatus(sampleSlots, 690);
    expect(at690.phase).toBe('between');
    expect(at690.current).toBeUndefined();
    expect(at690.next?.id).toBe('s3');
    expect(at690.minutesUntilNext).toBe(30);
  });

  it('breaks overlaps: primary is most recently started, ties break to essential then ID', () => {
    const overlapping: ScheduleSlot[] = [
      { id: 'early_imp', title: 'Photo Booth', startMinute: 600, durationMinutes: 120, priority: 'important', flexible: true },
      { id: 'late_opt', title: 'Cocktail Bar', startMinute: 630, durationMinutes: 60, priority: 'optional', flexible: true },
      { id: 'late_ess', title: 'Ring Ceremony', startMinute: 630, durationMinutes: 60, priority: 'essential', flexible: false },
    ];

    const res = dayStatus(overlapping, 640);
    expect(res.phase).toBe('during');
    // Both late_opt and late_ess started at 630 (more recent than 600).
    // late_ess has priority 'essential' > 'optional', so late_ess is primary!
    expect(res.current?.id).toBe('late_ess');
    expect(res.concurrent.map((s) => s.id)).toContain('early_imp');
    expect(res.concurrent.map((s) => s.id)).toContain('late_opt');
  });

  it('detects phase "after" when all activities have ended', () => {
    const res = dayStatus(sampleSlots, 900); // 3:00 PM (last ended at 855)
    expect(res.phase).toBe('after');
    expect(res.current).toBeUndefined();
    expect(res.next).toBeUndefined();
    expect(res.concurrent).toEqual([]);
    expect(res.later).toEqual([]);
  });
});

describe('selectDayTasks and isEventToday', () => {
  const { plan: demoCreatedPlan } = createPlan({
    meta: {
      ...DEMO_SCENARIO.meta,
      title: 'Wedding',
      type: 'wedding',
      dateIso: '2026-12-15',
    },
    constraints: DEMO_SCENARIO.constraints,
    ids: createIdFactory('eventday_test'),
    clock: () => new Date('2026-10-21T12:00:00.000Z'),
  });

  const basePlan: EventPlan = {
    ...demoCreatedPlan,
    id: 'plan_1',
    schedule: [],
    tasks: [
      { id: 't_done', title: 'Book Venue', category: 'venue', dueDaysBefore: 0, status: 'done', priority: 'high' },
      { id: 't_day_high', title: 'Bring Rings', category: 'ceremony', dueDaysBefore: 0, status: 'todo', priority: 'high' },
      { id: 't_day_doing', title: 'Set Sound Check', category: 'music', dueDaysBefore: 0, status: 'doing', priority: 'medium' },
      { id: 't_overdue', title: 'Pay Caterer Balance', category: 'food', dueDaysBefore: 10, status: 'todo', priority: 'medium' },
      { id: 't_far_away', title: 'Send Thank You Cards', category: 'post', dueDaysBefore: 30, status: 'todo', priority: 'low' },
    ],
    concepts: [],
    selectedConceptId: null,
    ledger: [],
  };

  it('identifies if event date is today in local time', () => {
    const todayMatch = new Date(2026, 11, 15, 10, 0); // 15 Dec 2026
    const todayMismatch = new Date(2026, 11, 16, 10, 0);
    expect(isEventToday(basePlan, todayMatch)).toBe(true);
    expect(isEventToday(basePlan, todayMismatch)).toBe(false);
    expect(isEventToday({ ...basePlan, meta: { ...basePlan.meta, dateIso: undefined } }, todayMatch)).toBe(false);
  });

  it('filters open tasks for event day and sorts doing first, then high priority, then due days, then title', () => {
    // Today is 1 Nov 2026. Event is 15 Dec 2026.
    // t_far_away is due 15 Nov (not overdue yet, low priority, dueDaysBefore 30 -> excluded).
    // t_overdue is due 25 Oct (dueDaysBefore 51 -> overdue on 1 Nov -> included).
    const planWithDates: EventPlan = {
      ...basePlan,
      tasks: [
        { id: 't_done', title: 'Book Venue', category: 'venue', dueDaysBefore: 0, status: 'done', priority: 'high' },
        { id: 't_day_high', title: 'Bring Rings', category: 'ceremony', dueDaysBefore: 0, status: 'todo', priority: 'high' },
        { id: 't_day_doing', title: 'Set Sound Check', category: 'music', dueDaysBefore: 0, status: 'doing', priority: 'medium' },
        { id: 't_overdue', title: 'Pay Caterer Balance', category: 'food', dueDaysBefore: 60, status: 'todo', priority: 'medium' },
        { id: 't_far_away', title: 'Send Thank You Cards', category: 'post', dueDaysBefore: 15, status: 'todo', priority: 'low' },
      ],
    };

    const today = new Date(2026, 10, 1); // 1 Nov 2026
    const dayTasks = selectDayTasks(planWithDates, today);

    // Done task and far away low priority task are excluded
    const ids = dayTasks.map((t) => t.id);
    expect(ids).not.toContain('t_done');
    expect(ids).not.toContain('t_far_away');

    // Included tasks: t_day_doing (doing), t_day_high (high), t_overdue (overdue)
    expect(ids).toContain('t_day_doing');
    expect(ids).toContain('t_day_high');
    expect(ids).toContain('t_overdue');

    // Order: doing first!
    expect(dayTasks[0]?.id).toBe('t_day_doing');
    // Next: high priority!
    expect(dayTasks[1]?.id).toBe('t_day_high');
  });
});

describe('contactsGroupedByCategory', () => {
  it('groups contacts by category with "Other" sorted last and contacts sorted by name', () => {
    const contacts: Contact[] = [
      { id: 'c1', name: 'Zack DJ', category: 'Music' },
      { id: 'c2', name: 'Aaron Sound', category: 'Music' },
      { id: 'c3', name: 'Bhavna Florist', category: 'Decor' },
      { id: 'c4', name: 'Uncle Suresh' }, // category omitted -> Other
      { id: 'c5', name: 'Auntie Meena', category: '' }, // empty category -> Other
    ];

    const grouped = contactsGroupedByCategory(contacts);
    const categories = grouped.map((g) => g.category);
    expect(categories).toEqual(['Decor', 'Music', 'Other']);

    // Music group sorted by name: Aaron Sound before Zack DJ
    const musicGroup = grouped.find((g) => g.category === 'Music')!;
    expect(musicGroup.contacts.map((c) => c.name)).toEqual(['Aaron Sound', 'Zack DJ']);

    // Other group sorted by name: Auntie Meena before Uncle Suresh
    const otherGroup = grouped.find((g) => g.category === 'Other')!;
    expect(otherGroup.contacts.map((c) => c.name)).toEqual(['Auntie Meena', 'Uncle Suresh']);
  });
});
