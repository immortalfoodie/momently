import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_SCENARIO } from '@/data/demoScenario';
import { createPlan } from '@/engine/planFactory';
import { createIdFactory } from '@/lib/id';
import { useEventsStore } from '@/store/eventsStore';
import { clearInMemoryStore, safeStorage } from '@/store/safeStorage';

describe('Store: Hydration Validation & SafeStorage', () => {
  const fixedClock = () => new Date('2026-10-21T12:00:00.000Z');

  function makeBaseline() {
    const ids = createIdFactory('store_hydrate_seed');
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

  it('hydrate drops invalid or corrupt persisted data without throwing and sets notice', () => {
    const corruptedPayload = JSON.stringify({
      state: {
        events: {
          valid_one: {
            plan: makeBaseline(),
            history: [],
            messages: [],
            assumptions: [],
            missingInfo: [],
          },
          invalid_one: {
            plan: { corrupted: true },
          },
        },
        order: ['valid_one', 'invalid_one'],
      },
      version: 1,
    });

    useEventsStore.setState({ hydrated: false });
    safeStorage.setItem('momently.v1', corruptedPayload);

    expect(() => useEventsStore.getState().hydrate()).not.toThrow();

    const state = useEventsStore.getState();
    expect(state.hydrated).toBe(true);
    expect(state.events.valid_one).toBeDefined();
    expect(state.events.invalid_one).toBeUndefined();
    expect(state.notice).toContain("1 saved event(s) couldn't be loaded");
  });

  it('hydrate gracefully resets on malformed JSON and sets notice', () => {
    useEventsStore.setState({ hydrated: false });
    safeStorage.setItem('momently.v1', 'NOT_VALID_JSON{{{');

    expect(() => useEventsStore.getState().hydrate()).not.toThrow();
    const state = useEventsStore.getState();
    expect(state.hydrated).toBe(true);
    expect(state.events).toEqual({});
    expect(state.notice).toBeDefined();
  });

  it('safeStorage never throws on quota errors or localStorage unavailability and exposes isPersistent()', () => {
    expect(safeStorage.isPersistent()).toBe(true);

    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });

    expect(() => safeStorage.setItem('key', 'value')).not.toThrow();
    expect(safeStorage.getItem('key')).toBe('value');
    expect(safeStorage.isPersistent()).toBe(false);
    setItemSpy.mockRestore();
  });

  it('refuses to load state saved with an unknown version, sets version notice, and leaves raw storage untouched', () => {
    const plan = makeBaseline();
    const rawFutureVersionPayload = JSON.stringify({
      state: {
        events: {
          [plan.id]: {
            plan,
            history: [],
            messages: [],
            assumptions: [],
            missingInfo: [],
            contacts: [],
          },
        },
        order: [plan.id],
      },
      version: 99,
    });

    useEventsStore.setState({ hydrated: false, events: {}, order: [], notice: null });
    safeStorage.setItem('momently.v1', rawFutureVersionPayload);

    useEventsStore.getState().hydrate();

    const state = useEventsStore.getState();
    expect(state.hydrated).toBe(true);
    expect(state.events).toEqual({});
    expect(state.order).toEqual([]);
    expect(state.notice).toBe(
      "Your saved data came from a different version of Momently and couldn't be loaded",
    );
    expect(safeStorage.getItem('momently.v1')).toBe(rawFutureVersionPayload);
    expect(window.localStorage.getItem('momently.v1')).toBe(rawFutureVersionPayload);
  });
});
