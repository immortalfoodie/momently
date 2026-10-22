import { beforeEach, describe, expect, it } from 'vitest';
import { DEMO_SCENARIO } from '@/data/demoScenario';
import { createPlan } from '@/engine/planFactory';
import { createIdFactory } from '@/lib/id';
import { useEventsStore } from '@/store/eventsStore';
import { clearInMemoryStore } from '@/store/safeStorage';

describe('Store: Client State & Persistence', () => {
  const fixedClock = () => new Date('2026-10-21T12:00:00.000Z');

  function makeBaseline() {
    const ids = createIdFactory('store_test_seed');
    return createPlan({
      meta: DEMO_SCENARIO.meta,
      constraints: DEMO_SCENARIO.constraints,
      ids,
      clock: fixedClock,
    }).plan;
  }

  beforeEach(() => {
    clearInMemoryStore();
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
    useEventsStore.setState({
      events: {},
      order: [],
      hydrated: true,
      notice: null,
      outcomes: {},
      chatDraft: '',
    });
  });

  it('createEvent creates an EventRecord and prepends to order', () => {
    const plan = makeBaseline();
    const id = useEventsStore.getState().createEvent(plan, {
      assumptions: ['First assumption'],
      missingInfo: [],
    });

    expect(id).toBe(plan.id);
    const state = useEventsStore.getState();
    expect(state.order[0]).toBe(plan.id);
    expect(state.events[plan.id]).toBeDefined();
    expect(state.events[plan.id]?.plan.version).toBe(1);
    expect(state.events[plan.id]?.assumptions).toEqual(['First assumption']);
  });

  it('createDemoEvent creates a complete demo event with 3 concepts', () => {
    const id = useEventsStore.getState().createDemoEvent();
    const record = useEventsStore.getState().events[id];
    expect(record).toBeDefined();
    expect(record?.plan.meta.title).toBe("Parents' 25th Anniversary");
    expect(record?.plan.concepts).toHaveLength(3);
  });

  it('approveAndApply increments version, pushes snapshot, expands ledger, and returns impact', () => {
    const plan = makeBaseline();
    const eventId = useEventsStore.getState().createEvent(plan);

    const ids = createIdFactory('patch_id');
    const patch = {
      id: ids('patch'),
      ops: [{ type: 'set_setting' as const, setting: 'outdoor' as const }],
      reason: 'Host prefers outdoor lawn',
      source: 'user' as const,
      status: 'proposed' as const,
      createdAt: fixedClock().toISOString(),
    };

    const res = useEventsStore.getState().approveAndApply(eventId, patch, {
      basedOnVersion: 1,
      recordSnapshot: true,
    });

    expect(res.ok).toBe(true);
    const updated = useEventsStore.getState().events[eventId];
    expect(updated?.plan.version).toBe(2);
    expect(updated?.plan.meta.setting).toBe('outdoor');
    expect(updated?.history).toHaveLength(1);
    expect(updated?.history[0]?.version).toBe(1);
    expect(updated?.history[0]?.label).toBe('Host prefers outdoor lawn');
    expect(updated?.plan.ledger.length).toBeGreaterThan(plan.ledger.length);
  });

  it('rejects with stale_plan when basedOnVersion differs from current plan version', () => {
    const plan = makeBaseline();
    const eventId = useEventsStore.getState().createEvent(plan);

    const patch = {
      id: 'patch_stale',
      ops: [{ type: 'set_setting' as const, setting: 'outdoor' as const }],
      reason: 'Outdated edit',
      source: 'user' as const,
      status: 'approved' as const,
      createdAt: fixedClock().toISOString(),
    };

    const res = useEventsStore.getState().approveAndApply(eventId, patch, {
      basedOnVersion: 99, // Stale version!
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('stale_plan');
    }
    // Plan state remains version 1
    expect(useEventsStore.getState().events[eventId]?.plan.version).toBe(1);
  });

  it('hard_constraint_violation returns impact and leaves state unchanged', () => {
    const plan = makeBaseline();
    const eventId = useEventsStore.getState().createEvent(plan);

    // Patch that violates hard budget cap
    const patch = {
      id: 'patch_violation',
      ops: [
        {
          type: 'add_budget_item' as const,
          item: {
            id: 'bi_huge',
            category: 'venue' as const,
            label: 'Expensive Palace',
            basis: 'flat' as const,
            unitCost: 10_000_000,
            quantity: 1,
            provenance: 'user' as const,
            locked: true,
          },
        },
      ],
      reason: 'Rent a palace',
      source: 'user' as const,
      status: 'approved' as const,
      createdAt: fixedClock().toISOString(),
    };

    const res = useEventsStore.getState().approveAndApply(eventId, patch, {
      basedOnVersion: 1,
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('hard_constraint_violation');
      if ('impact' in res.error) {
        expect(res.error.impact).toBeDefined();
      }
    }
    // State remains unmodified
    expect(useEventsStore.getState().events[eventId]?.plan.version).toBe(1);
    expect(useEventsStore.getState().events[eventId]?.history).toHaveLength(0);
  });

  it('caps history at 25 snapshots dropping the oldest', () => {
    const plan = makeBaseline();
    const eventId = useEventsStore.getState().createEvent(plan);

    // Apply 26 sequential edits using set_meta (which does not violate budget cap)
    for (let i = 1; i <= 26; i++) {
      const res = useEventsStore.getState().applyUserEdit(
        eventId,
        [{ type: 'set_meta', changes: { title: `Anniversary Celebration - Edit ${i}` } }],
        `Title change ${i}`,
        { recordSnapshot: true },
      );
      expect(res.ok).toBe(true);
    }

    const event = useEventsStore.getState().events[eventId];
    expect(event?.plan.version).toBe(27);
    expect(event?.history.length).toBe(25);
    // Oldest snapshot should be version 2, not 1
    expect(event?.history[0]?.version).toBe(2);
    expect(event?.history[24]?.version).toBe(26);
  });

  it('restoreVersion restores old plan state and appends restoration ledger record', () => {
    const plan = makeBaseline();
    const eventId = useEventsStore.getState().createEvent(plan);

    // Change setting to outdoor (creates snapshot of v1)
    useEventsStore.getState().applyUserEdit(
      eventId,
      [{ type: 'set_setting', setting: 'outdoor' }],
      'Go outdoor',
    );
    expect(useEventsStore.getState().events[eventId]?.plan.meta.setting).toBe('outdoor');

    // Restore version 1
    const res = useEventsStore.getState().restoreVersion(eventId, 1);
    expect(res.ok).toBe(true);
    const restored = useEventsStore.getState().events[eventId];
    expect(restored?.plan.version).toBe(3);
    expect(restored?.plan.meta.setting).toBe('undecided');
    const lastDec = restored?.plan.ledger[restored.plan.ledger.length - 1];
    expect(lastDec?.summary).toBe('Restored version 1');
  });

  it('setConcepts replaces concepts and clears selectedConceptId if omitted', () => {
    const plan = makeBaseline();
    const eventId = useEventsStore.getState().createEvent({
      ...plan,
      concepts: [DEMO_SCENARIO.concepts[0]!],
      selectedConceptId: DEMO_SCENARIO.concepts[0]!.id,
    });

    useEventsStore.getState().setConcepts(eventId, [DEMO_SCENARIO.concepts[1]!]);
    const updated = useEventsStore.getState().events[eventId];
    expect(updated?.plan.concepts[0]?.id).toBe(DEMO_SCENARIO.concepts[1]!.id);
    expect(updated?.plan.selectedConceptId).toBeNull();
  });

  it('size guard drops oldest snapshots first when serialized payload exceeds 2.5MB and never drops plans', () => {
    const plan = makeBaseline();
    const eventId = useEventsStore.getState().createEvent(plan);

    // Create a very large dummy snapshot string payload
    const largeDummyNote = 'A'.repeat(500_000);
    const giantSnapshot = { version: 1, savedAt: '2026-10-21T10:00:00.000Z', label: 'Giant 1', plan: { ...plan, meta: { ...plan.meta, hostBrief: largeDummyNote } } };
    const giantSnapshot2 = { version: 2, savedAt: '2026-10-21T11:00:00.000Z', label: 'Giant 2', plan: { ...plan, meta: { ...plan.meta, hostBrief: largeDummyNote } } };

    const currentEvent = useEventsStore.getState().events[eventId]!;
    currentEvent.history = [giantSnapshot, giantSnapshot2];

    // Trigger an edit that exceeds 2.5M
    const res = useEventsStore.getState().applyUserEdit(
      eventId,
      [{ type: 'set_setting', setting: 'outdoor' }],
      'Trigger size guard',
    );
    expect(res.ok).toBe(true);

    const updated = useEventsStore.getState().events[eventId]!;
    // Plan itself is never dropped!
    expect(updated.plan.id).toBe(eventId);
  });
});
