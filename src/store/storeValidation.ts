import type { EventRecord } from './persistSchema';
import { eventRecordSchema } from './persistSchema';
import { safeStorage } from './safeStorage';

const MAX_SERIALIZED_CHARS = 2_500_000;

export function enforceSizeGuard(
  events: Record<string, EventRecord>,
  order: string[],
): Record<string, EventRecord> {
  let serialized = JSON.stringify({ state: { events, order }, version: 1 });
  if (serialized.length <= MAX_SERIALIZED_CHARS) return events;

  const updated: Record<string, EventRecord> = {};
  for (const [id, rec] of Object.entries(events)) updated[id] = { ...rec, history: [...rec.history] };

  while (serialized.length > MAX_SERIALIZED_CHARS) {
    let oldestEventId: string | null = null;
    let oldestTimestamp = Infinity;

    for (const [id, rec] of Object.entries(updated)) {
      const snap = rec.history[0];
      if (snap) {
        const time = new Date(snap.savedAt).getTime();
        if (time < oldestTimestamp) {
          oldestTimestamp = time;
          oldestEventId = id;
        }
      }
    }

    if (!oldestEventId) break;
    updated[oldestEventId]?.history.shift();
    serialized = JSON.stringify({ state: { events: updated, order }, version: 1 });
  }

  return updated;
}

interface HydrateTargetState {
  events: Record<string, EventRecord>;
  order: string[];
  hydrated: boolean;
  notice: string | null;
}

function parseStoragePayload(): unknown | null {
  const raw = safeStorage.getItem('momently.v1');
  if (!raw || typeof raw !== 'string') return null;
  return JSON.parse(raw);
}

function validateEventRecords(rawEvents: Record<string, unknown>): {
  validEvents: Record<string, EventRecord>;
  invalidCount: number;
} {
  const validEvents: Record<string, EventRecord> = {};
  let invalidCount = 0;
  for (const [id, data] of Object.entries(rawEvents)) {
    const res = eventRecordSchema.safeParse(data);
    if (res.success) {
      validEvents[id] = res.data;
    } else {
      invalidCount++;
    }
  }
  return { validEvents, invalidCount };
}

function extractStateObject(parsed: unknown): Record<string, unknown> | null {
  if (typeof parsed !== 'object' || parsed === null) return null;
  const stateObj = 'state' in parsed ? (parsed as { state: unknown }).state : parsed;
  return typeof stateObj === 'object' && stateObj !== null ? (stateObj as Record<string, unknown>) : null;
}

function reconcileOrder(rawOrder: unknown, validEvents: Record<string, EventRecord>): string[] {
  const validOrder = (Array.isArray(rawOrder) ? rawOrder : []).filter(
    (id): id is string => typeof id === 'string' && Boolean(validEvents[id]),
  );
  for (const id of Object.keys(validEvents)) {
    if (!validOrder.includes(id)) validOrder.push(id);
  }
  return validOrder;
}

export function runHydrateValidation(
  set: (fn: (state: HydrateTargetState) => Partial<HydrateTargetState>) => void,
): void {
  try {
    let parsed: unknown;
    try {
      parsed = parseStoragePayload();
      if (!parsed) {
        set(() => ({ hydrated: true }));
        return;
      }
    } catch {
      set(() => ({
        events: {},
        order: [],
        hydrated: true,
        notice: "Saved events couldn't be loaded: corrupted storage format",
      }));
      return;
    }

    const stateObj = extractStateObject(parsed);
    if (!stateObj) {
      set(() => ({ hydrated: true }));
      return;
    }

    const rawEvents = (stateObj.events as Record<string, unknown>) ?? {};
    const { validEvents, invalidCount } = validateEventRecords(rawEvents);
    const validOrder = reconcileOrder(stateObj.order, validEvents);
    const notice = invalidCount > 0 ? `${invalidCount} saved event(s) couldn't be loaded` : null;

    set(() => ({
      events: validEvents,
      order: validOrder,
      hydrated: true,
      ...(notice ? { notice } : {}),
    }));
  } catch {
    set(() => ({ hydrated: true }));
  }
}
