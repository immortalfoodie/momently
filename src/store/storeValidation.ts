import { prepareImport } from '@/lib/export/backup';
import type { IdFactory } from '@/lib/id';
import type { EventRecord } from './persistSchema';
import { eventRecordSchema } from './persistSchema';
import {
  safeStorage,
  suppressNextStorageWrite,
  withSuppressedStorageWrite,
} from './safeStorage';

const MAX_SERIALIZED_CHARS = 2_500_000;
export const MAX_STORED_EVENTS = 50;
export const CURRENT_PERSIST_VERSION = 1;
export const UNKNOWN_VERSION_NOTICE =
  "Your saved data came from a different version of Momently and couldn't be loaded";

export function applyImportEvents(
  currentEvents: Record<string, EventRecord>,
  currentOrder: string[],
  records: readonly EventRecord[],
  ids: IdFactory,
): {
  events: Record<string, EventRecord>;
  order: string[];
  imported: number;
  skipped: number;
} {
  try {
    const prepared = prepareImport(records, ids);
    const available = Math.max(0, MAX_STORED_EVENTS - currentOrder.length);
    const accepted = prepared.slice(0, available);
    const skipped = Math.max(0, records.length - accepted.length);

    if (accepted.length === 0) {
      return { events: currentEvents, order: currentOrder, imported: 0, skipped };
    }

    const nextEvents: Record<string, EventRecord> = { ...currentEvents };
    const nextOrder: string[] = [...currentOrder];

    for (const rec of accepted) {
      nextEvents[rec.plan.id] = rec;
      if (!nextOrder.includes(rec.plan.id)) {
        nextOrder.push(rec.plan.id);
      }
    }

    return {
      events: enforceSizeGuard(nextEvents, nextOrder),
      order: nextOrder,
      imported: accepted.length,
      skipped,
    };
  } catch {
    return {
      events: currentEvents,
      order: currentOrder,
      imported: 0,
      skipped: records.length,
    };
  }
}

export function enforceSizeGuard(
  events: Record<string, EventRecord>,
  order: string[],
): Record<string, EventRecord> {
  let serialized = JSON.stringify({ state: { events, order }, version: CURRENT_PERSIST_VERSION });
  if (serialized.length <= MAX_SERIALIZED_CHARS) return events;

  const updated: Record<string, EventRecord> = {};
  for (const [id, rec] of Object.entries(events)) {
    updated[id] = { ...rec, history: [...rec.history] };
  }

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
    serialized = JSON.stringify({
      state: { events: updated, order },
      version: CURRENT_PERSIST_VERSION,
    });
  }

  return updated;
}

export interface HydrateTargetState {
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
  return typeof stateObj === 'object' && stateObj !== null
    ? (stateObj as Record<string, unknown>)
    : null;
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

/**
 * Zustand persist migrate handler.
 * WHY: Rejects unknown storage versions without destroying raw stored data and sets a friendly notice.
 */
export function migratePersistedState(
  persistedState: unknown,
  version: number,
  onUnknownVersion?: () => void,
): { events: Record<string, EventRecord>; order: string[]; notice?: string } {
  if (version !== CURRENT_PERSIST_VERSION) {
    suppressNextStorageWrite(1);
    onUnknownVersion?.();
    return { events: {}, order: [], notice: UNKNOWN_VERSION_NOTICE };
  }
  const stateObj = extractStateObject(persistedState);
  if (!stateObj) return { events: {}, order: [] };
  const rawEvents = (stateObj.events as Record<string, unknown>) ?? {};
  const { validEvents } = validateEventRecords(rawEvents);
  const validOrder = reconcileOrder(stateObj.order, validEvents);
  return { events: validEvents, order: validOrder };
}

function isUnknownPersistVersion(parsed: unknown): parsed is { version: unknown } {
  return (
    typeof parsed === 'object' &&
    parsed !== null &&
    'version' in parsed &&
    (parsed as { version: unknown }).version !== CURRENT_PERSIST_VERSION
  );
}

function applyParsedStorageState(
  parsed: unknown,
  set: (fn: (state: HydrateTargetState) => Partial<HydrateTargetState>) => void,
): void {
  if (isUnknownPersistVersion(parsed)) {
    const migrated = migratePersistedState(parsed, Number(parsed.version));
    set(() => ({
      events: migrated.events,
      order: migrated.order,
      hydrated: true,
      notice: migrated.notice ?? UNKNOWN_VERSION_NOTICE,
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
}

export function runHydrateValidation(
  set: (fn: (state: HydrateTargetState) => Partial<HydrateTargetState>) => void,
): void {
  withSuppressedStorageWrite(() => {
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

      applyParsedStorageState(parsed, set);
    } catch {
      set(() => ({ hydrated: true }));
    }
  });
}
