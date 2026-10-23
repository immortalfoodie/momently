import { beforeEach, describe, expect, it } from 'vitest';
import { buildDemoPlan } from '@/engine/demo';
import { createPatch } from '@/engine/patch';
import { createIdFactory } from '@/lib/id';
import { useEventsStore } from '@/store/eventsStore';

describe('Store: setTaskStatus Invariants (TASK 1 & TASK 4)', () => {
  const ctx = {
    ids: createIdFactory('store_task_test'),
    clock: () => new Date('2026-10-21T12:00:00.000Z'),
  };

  let eventId: string;

  beforeEach(() => {
    useEventsStore.setState({ events: {}, order: [], hydrated: true });
    const demo = buildDemoPlan(ctx);
    eventId = useEventsStore.getState().createEvent(demo.plan, {
      assumptions: demo.assumptions,
    });
  });

  it('preserves plan version, ledger, and history when updating task status', () => {
    const store = useEventsStore.getState();
    const event = store.events[eventId]!;
    const initialVersion = event.plan.version;
    const initialLedger = [...event.plan.ledger];
    const initialHistory = [...event.history];
    const targetTaskId = event.plan.tasks[0]!.id;

    const res = store.setTaskStatus(eventId, targetTaskId, 'done');
    expect(res.ok).toBe(true);

    const updatedEvent = useEventsStore.getState().events[eventId]!;
    expect(updatedEvent.plan.version).toBe(initialVersion);
    expect(updatedEvent.plan.ledger).toEqual(initialLedger);
    expect(updatedEvent.history).toEqual(initialHistory);
    expect(updatedEvent.plan.tasks.find((t) => t.id === targetTaskId)?.status).toBe('done');
    expect(useEventsStore.getState().order[0]).toBe(eventId);
  });

  it('allows open proposals built from pre-tick version to apply without staleness', () => {
    const store = useEventsStore.getState();
    const event = store.events[eventId]!;
    const preTickVersion = event.plan.version;

    // Build a proposal based on preTickVersion
    const patch = createPatch(
      [{ type: 'set_setting', setting: 'indoor' }],
      'Set setting to indoor',
      'user',
      ctx.ids,
      ctx.clock,
      'proposed',
    );

    // Host ticks 3 tasks in the checklist
    store.setTaskStatus(eventId, event.plan.tasks[0]!.id, 'done');
    store.setTaskStatus(eventId, event.plan.tasks[1]!.id, 'doing');
    store.setTaskStatus(eventId, event.plan.tasks[2]!.id, 'done');

    // The proposal based on preTickVersion must still apply cleanly without stale_plan error!
    const applyRes = store.approveAndApply(eventId, patch, { basedOnVersion: preTickVersion });
    expect(applyRes.ok).toBe(true);
    expect(useEventsStore.getState().events[eventId]!.plan.version).toBe(preTickVersion + 1);
  });

  it('never throws for unknown event or unknown task', () => {
    const store = useEventsStore.getState();
    const validTaskId = store.events[eventId]!.plan.tasks[0]!.id;

    // Unknown event
    const badEventRes = store.setTaskStatus('evt_nonexistent', validTaskId, 'done');
    expect(badEventRes.ok).toBe(false);
    if (!badEventRes.ok) {
      expect(badEventRes.error.code).toBe('not_found');
    }

    // Unknown task
    const badTaskRes = store.setTaskStatus(eventId, 'task_nonexistent', 'done');
    expect(badTaskRes.ok).toBe(false);
    if (!badTaskRes.ok) {
      expect(badTaskRes.error.code).toBe('task_not_found');
    }
  });
});
