import type { Contact } from '@/domain/contactSchemas';
import type { Concept, EventPlan, PlanImpact, PlanPatch, PlanPatchOp } from '@/domain/types';
import type { AssistantOutcome } from '@/engine/assistant/types';
import { buildDemoPlan } from '@/engine/demo';
import { createSnapshot, restoreSnapshot } from '@/engine/history';
import type { PatchError } from '@/engine/patch';
import { applyPatch, createPatch } from '@/engine/patch';
import { replaceConcepts } from '@/engine/replaceConcepts';
import { setTaskStatus as setTaskStatusEngine } from '@/engine/taskStatus';
import type { MissingInfoItem } from '@/llm/schemas/intake';
import { err, ok, type Result } from '@/lib/result';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { engineContext } from './engineContext';
import type { EventRecord } from './persistSchema';
import { safeStorage } from './safeStorage';
import { enforceSizeGuard, runHydrateValidation } from './storeValidation';

export interface StoreError {
  code: 'not_found' | 'stale_plan' | 'version_not_found';
  message: string;
}

export interface EventsState {
  events: Record<string, EventRecord>;
  order: string[];
  hydrated: boolean;
  notice: string | null;
  outcomes: Record<string, AssistantOutcome>;
  chatDraft: string;
  hydrate: () => void;
  createEvent: (plan: EventPlan, extras?: { assumptions?: string[]; missingInfo?: MissingInfoItem[] }) => string;
  createDemoEvent: () => string;
  approveAndApply: (eventId: string, patch: PlanPatch, options: { basedOnVersion: number; recordSnapshot?: boolean }) => Result<PlanImpact, StoreError | PatchError>;
  applyUserEdit: (eventId: string, ops: PlanPatchOp[], reason: string, options?: { recordSnapshot?: boolean }) => Result<PlanImpact, StoreError | PatchError>;
  restoreVersion: (eventId: string, version: number) => Result<EventPlan, StoreError>;
  setConcepts: (eventId: string, concepts: Concept[]) => void;
  setTaskStatus: (eventId: string, taskId: string, status: 'todo' | 'doing' | 'done') => Result<EventPlan, StoreError | PatchError>;
  addContact: (eventId: string, contact: Contact) => void;
  updateContact: (eventId: string, contactId: string, changes: Partial<Omit<Contact, 'id'>>) => void;
  removeContact: (eventId: string, contactId: string) => void;
  deleteEvent: (id: string) => void;
  addMessage: (eventId: string, message: { role: 'user' | 'assistant'; text: string; outcomeKind?: string; basedOnVersion?: number }) => void;
  clearMessages: (eventId: string) => void;
  setOutcome: (messageId: string, outcome: AssistantOutcome) => void;
  setChatDraft: (draft: string) => void;
  dismissNotice: () => void;
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
          contacts: [],
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

      setTaskStatus: (eventId, taskId, status) => {
        const event = get().events[eventId];
        if (!event) return err({ code: 'not_found', message: 'Event not found' });
        const res = setTaskStatusEngine(event.plan, taskId, status, engineContext);
        if (!res.ok) return res;
        const updatedEvents = { ...get().events, [eventId]: { ...event, plan: res.value } };
        const nextOrder = [eventId, ...get().order.filter((id) => id !== eventId)];
        set({ events: enforceSizeGuard(updatedEvents, nextOrder), order: nextOrder });
        return ok(res.value);
      },

      addContact: (eventId, contact) => {
        const event = get().events[eventId];
        if (!event) return;
        const newContact: Contact = { ...contact, id: contact.id || engineContext.ids('contact') };
        const nextContacts = [...(event.contacts ?? []), newContact].slice(0, 30);
        set({ events: { ...get().events, [eventId]: { ...event, contacts: nextContacts } } });
      },

      updateContact: (eventId, contactId, changes) => {
        const event = get().events[eventId];
        if (!event || !event.contacts) return;
        const nextContacts = event.contacts.map((c) => (c.id === contactId ? { ...c, ...changes } : c));
        set({ events: { ...get().events, [eventId]: { ...event, contacts: nextContacts } } });
      },

      removeContact: (eventId, contactId) => {
        const event = get().events[eventId];
        if (!event || !event.contacts) return;
        const nextContacts = event.contacts.filter((c) => c.id !== contactId);
        set({ events: { ...get().events, [eventId]: { ...event, contacts: nextContacts } } });
      },

      deleteEvent: (id) => {
        const nextEvents = { ...get().events };
        delete nextEvents[id];
        set({ events: nextEvents, order: get().order.filter((eId) => eId !== id) });
      },

      addMessage: (eventId, msg) => {
        const event = get().events[eventId];
        if (!event) return;
        const newMsg = { id: engineContext.ids('msg'), createdAt: engineContext.clock().toISOString(), ...msg };
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
