import { beforeEach, describe, expect, it } from 'vitest';
import { buildDemoPlan } from '@/engine/demo';
import { createIdFactory } from '@/lib/id';
import { useEventsStore } from '@/store/eventsStore';
import type { EventRecord } from '@/store/persistSchema';
import { safeStorage } from '@/store/safeStorage';
import { useTourStore } from '@/store/tourStore';

const ctx = {
  ids: createIdFactory('store_import_delete_test'),
  clock: () => new Date('2026-10-21T12:00:00.000Z'),
};

function makeRecord(index: number): EventRecord {
  const { plan, assumptions } = buildDemoPlan(ctx);
  return {
    plan: { ...plan, id: `rec_${index}`, meta: { ...plan.meta, title: `Event ${index}` } },
    history: [],
    messages: [],
    assumptions,
    missingInfo: [],
    contacts: [{ id: `c_${index}`, name: `Contact ${index}` }],
  };
}

describe('Store: importEvents, 50-Event Cap & deleteAllData', () => {
  beforeEach(() => {
    useEventsStore.getState().deleteAllData();
    useEventsStore.setState({ hydrated: true });
  });

  it('importEvents appends records with new IDs and respects the 50-event total cap', () => {
    // Seed 48 existing events
    const initialBatch = Array.from({ length: 48 }, (_, i) => makeRecord(i));
    const firstImport = useEventsStore.getState().importEvents(initialBatch);
    expect(firstImport).toEqual({ imported: 48, skipped: 0 });
    expect(useEventsStore.getState().order).toHaveLength(48);

    // Import 5 more -> only 2 fit under the 50-event cap, 3 are skipped
    const secondBatch = Array.from({ length: 5 }, (_, i) => makeRecord(100 + i));
    const secondImport = useEventsStore.getState().importEvents(secondBatch);
    expect(secondImport).toEqual({ imported: 2, skipped: 3 });
    expect(useEventsStore.getState().order).toHaveLength(50);
  });

  it('deleteAllData clears events, order, outcomes, chatDraft, tour state, and removes persisted storage key', () => {
    const store = useEventsStore.getState();
    const eventId = store.createDemoEvent();
    store.setChatDraft('Unsent draft text');
    useTourStore.getState().start(eventId);

    expect(useEventsStore.getState().order).toHaveLength(1);
    expect(useTourStore.getState().active).toBe(true);
    expect(safeStorage.getItem('momently.v1')).not.toBeNull();

    useEventsStore.getState().deleteAllData();

    const after = useEventsStore.getState();
    expect(after.events).toEqual({});
    expect(after.order).toEqual([]);
    expect(after.outcomes).toEqual({});
    expect(after.chatDraft).toBe('');
    expect(useTourStore.getState().active).toBe(false);
    expect(safeStorage.getItem('momently.v1')).toBeNull();
  });
});
