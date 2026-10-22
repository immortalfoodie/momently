import type { Concept, EventPlan, PlanImpact, PlanPatch, PlanPatchOp } from '@/domain/types';
import type { AssistantOutcome } from '@/engine/assistant/types';
import { buildDemoPlan } from '@/engine/demo';
import { createSnapshot, restoreSnapshot } from '@/engine/history';
import type { PatchError } from '@/engine/patch';
import { applyPatch, createPatch } from '@/engine/patch';
import { replaceConcepts } from '@/engine/replaceConcepts';
import type { MissingInfoItem } from '@/llm/schemas/intake';
import { err, ok, type Result } from '@/lib/result';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { engineContext } from './engineContext';
import type { EventRecord } from './persistSchema';
import { eventRecordSchema } from './persistSchema';
import { safeStorage } from './safeStorage';

export interface StoreError {
  code: 'not_found' | 'stale_plan' | 'version_not_found';
  message: string;
}

const MAX_SERIALIZED_CHARS = 2_500_000;

function enforceSizeGuard(
  events: Record<string, EventRecord>,
  order: string[],
): Record<string, EventRecord> {
  let serialized = JSON.stringify({ state: { events, order }, version: 1 });
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
    serialized = JSON.stringify({ state: { events: updated, order }, version: 1 });
  }

  return updated;
}

export interface EventsState {
  events: Record<string, EventRecord>;
  order: string[];
  hydrated: boolean;
  notice: string | null;
  outcomes: Record<string, AssistantOutcome>;
  chatDraft: string;
  hydrate: () => void;
  createEvent: (
    plan: EventPlan,
    extras?: { assumptions?: string[]; missingInfo?: MissingInfoItem[] },
  ) => string;
  createDemoEvent: () => string;
  approveAndApply: (
    eventId: string,
    patch: PlanPatch,
    options: { basedOnVersion: number; recordSnapshot?: boolean },
  ) => Result<PlanImpact, StoreError | PatchError>;
  applyUserEdit: (
    eventId: string,
    ops: PlanPatchOp[],
    reason: string,
    options?: { recordSnapshot?: boolean },
  ) => Result<PlanImpact, StoreError | PatchError>;
  restoreVersion: (eventId: string, version: number) => Result<EventPlan, StoreError>;
  setConcepts: (eventId: string, concepts: Concept[]) => void;
  deleteEvent: (id: string) => void;
  addMessage: (eventId: string, message: { role: 'user' | 'assistant'; text: string; outcomeKind?: string; basedOnVersion?: number }) => void;
  clearMessages: (eventId: string) => void;
  setOutcome: (messageId: string, outcome: AssistantOutcome) => void;
  setChatDraft: (draft: string) => void;
  dismissNotice: () => void;
}

// eslint-disable-next-line complexity
function runHydrateValidation(set: (fn: (state: EventsState) => Partial<EventsState>) => void) {
  try {
    const raw = safeStorage.getItem('momently.v1');
    if (!raw || typeof raw !== 'string') {
      set(() => ({ hydrated: true }));
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      set(() => ({ events: {}, order: [], hydrated: true, notice: "Saved events couldn't be loaded: corrupted storage format" }));
      return;
    }
    const stateObj = typeof parsed === 'object' && parsed !== null && 'state' in parsed ? (parsed as { state: unknown }).state : parsed;
    if (typeof stateObj !== 'object' || stateObj === null) {
      set(() => ({ hydrated: true }));
      return;
    }
    const rawEvents = (stateObj as { events?: Record<string, unknown> }).events ?? {};
    const rawOrder = (stateObj as { order?: unknown[] }).order ?? [];
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
    const validOrder = (Array.isArray(rawOrder) ? rawOrder : []).filter((id): id is string => typeof id === 'string' && Boolean(validEvents[id]));
    for (const id of Object.keys(validEvents)) {
      if (!validOrder.includes(id)) validOrder.push(id);
    }
    const notice = invalidCount > 0 ? `${invalidCount} saved event(s) couldn't be loaded` : null;
    set(() => ({ events: validEvents, order: validOrder, hydrated: true, ...(notice ? { notice } : {}) }));
  } catch {
    set(() => ({ hydrated: true }));
  }
}

export const useEventsStore = create<EventsState>()(
  persist(
    (set, get) => ({
      events: {},
      order: [],
      hydrated: false,
      notice: null,
      outcomes: {},
      chatDraft: '',

      hydrate: () => runHydrateValidation(set),

      createEvent: (plan, extras) => {
        const record: EventRecord = {
          plan,
          history: [],
          messages: [],
          assumptions: (extras?.assumptions ?? []).slice(0, 10),
          missingInfo: (extras?.missingInfo ?? []).slice(0, 4),
        };
        const nextEvents = { ...get().events, [plan.id]: record };
        const nextOrder = [plan.id, ...get().order.filter((id) => id !== plan.id)];
        const pruned = enforceSizeGuard(nextEvents, nextOrder);
        set({ events: pruned, order: nextOrder });
        return plan.id;
      },

      createDemoEvent: () => {
        const demo = buildDemoPlan(engineContext);
        return get().createEvent(demo.plan, { assumptions: demo.assumptions });
      },

      approveAndApply: (eventId, patch, options) => {
        const event = get().events[eventId];
        if (!event) return err({ code: 'not_found', message: 'Event not found' });
        if (event.plan.version !== options.basedOnVersion) {
          return err({ code: 'stale_plan', message: `Plan modified: version ${event.plan.version} vs expected ${options.basedOnVersion}` });
        }
        const newHistory = options.recordSnapshot === false ? event.history : [...event.history, createSnapshot(event.plan, patch.reason, engineContext)].slice(-25);
        const approvedPatch = { ...patch, status: 'approved' as const };
        const patchRes = applyPatch(event.plan, approvedPatch, engineContext);
        if (!patchRes.ok) return patchRes;

        const updatedEvents = { ...get().events, [eventId]: { ...event, plan: patchRes.value.plan, history: newHistory } };
        const nextOrder = [eventId, ...get().order.filter((id) => id !== eventId)];
        set({ events: enforceSizeGuard(updatedEvents, nextOrder), order: nextOrder });
        return ok(patchRes.value.impact);
      },

      applyUserEdit: (eventId, ops, reason, options) => {
        const event = get().events[eventId];
        if (!event) return err({ code: 'not_found', message: 'Event not found' });
        const patch = createPatch(ops, reason, 'user', engineContext.ids, engineContext.clock, 'approved');
        return get().approveAndApply(eventId, patch, { basedOnVersion: event.plan.version, recordSnapshot: options?.recordSnapshot });
      },

      restoreVersion: (eventId, version) => {
        const event = get().events[eventId];
        if (!event) return err({ code: 'not_found', message: 'Event not found' });
        const snapshot = event.history.find((s) => s.version === version);
        if (!snapshot) return err({ code: 'version_not_found', message: `Version ${version} not found in history` });
        const restored = restoreSnapshot(event.plan, snapshot, engineContext);
        const updatedEvents = { ...get().events, [eventId]: { ...event, plan: restored } };
        const nextOrder = [eventId, ...get().order.filter((id) => id !== eventId)];
        set({ events: enforceSizeGuard(updatedEvents, nextOrder), order: nextOrder });
        return ok(restored);
      },

      setConcepts: (eventId, concepts) => {
        const event = get().events[eventId];
        if (!event) return;
        const updated = replaceConcepts(event.plan, concepts, engineContext);
        const updatedEvents = { ...get().events, [eventId]: { ...event, plan: updated } };
        const nextOrder = [eventId, ...get().order.filter((id) => id !== eventId)];
        set({ events: enforceSizeGuard(updatedEvents, nextOrder), order: nextOrder });
      },

      deleteEvent: (id) => {
        const nextEvents = { ...get().events };
        delete nextEvents[id];
        set({ events: nextEvents, order: get().order.filter((eId) => eId !== id) });
      },

      addMessage: (eventId, msg) => {
        const event = get().events[eventId];
        if (!event) return;
        const newMsg = {
          id: engineContext.ids('msg'),
          createdAt: engineContext.clock().toISOString(),
          ...msg,
        };
        const nextMessages = [...event.messages, newMsg].slice(-60);
        set({ events: { ...get().events, [eventId]: { ...event, messages: nextMessages } } });
      },

      clearMessages: (eventId) => {
        const event = get().events[eventId];
        if (!event) return;
        set({ events: { ...get().events, [eventId]: { ...event, messages: [] } } });
      },

      setOutcome: (messageId, outcome) => set({ outcomes: { ...get().outcomes, [messageId]: outcome } }),
      setChatDraft: (draft) => set({ chatDraft: draft }),
      dismissNotice: () => set({ notice: null }),
    }),
    {
      name: 'momently.v1',
      version: 1,
      skipHydration: true,
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({ events: state.events, order: state.order }),
    },
  ),
);
