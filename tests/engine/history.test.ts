import { describe, expect, it } from 'vitest';
import { DEMO_SCENARIO } from '@/data/demoScenario';
import { createSnapshot, restoreSnapshot } from '@/engine/history';
import { createPlan } from '@/engine/planFactory';
import { createIdFactory } from '@/lib/id';
import { deepFreeze } from '../helpers/deepFreeze';

describe('Engine: History Snapshots & Forward Restoration', () => {
  const fixedClock = () => new Date('2026-10-21T12:00:00.000Z');

  function makeBaseline() {
    const ids = createIdFactory('hist_seed');
    const { plan } = createPlan({
      meta: DEMO_SCENARIO.meta,
      constraints: DEMO_SCENARIO.constraints,
      ids,
      clock: fixedClock,
    });
    return plan;
  }

  it('creates an immutable snapshot with version, timestamp, and label', () => {
    const plan = deepFreeze(makeBaseline());
    const ids = createIdFactory('hist_ctx');
    const ctx = { ids, clock: fixedClock };

    const snapshot = createSnapshot(plan, 'Initial baseline', ctx);

    expect(snapshot.version).toBe(plan.version);
    expect(snapshot.savedAt).toBe('2026-10-21T12:00:00.000Z');
    expect(snapshot.label).toBe('Initial baseline');
    expect(snapshot.plan.id).toBe(plan.id);
  });

  it('restores snapshot preserving current id, incrementing version, and appending restoration to current ledger', () => {
    const basePlan = makeBaseline();
    const ids = createIdFactory('hist_ctx');
    const ctx = { ids, clock: fixedClock };

    // Take snapshot of version 1
    const snapshotV1 = createSnapshot(basePlan, 'Version 1 baseline', ctx);

    // Evolve the plan to version 3 with its own updated ledger
    const currentPlan = deepFreeze({
      ...basePlan,
      id: 'active_event_123',
      version: 3,
      meta: {
        ...basePlan.meta,
        guestCount: 150,
      },
      ledger: [
        ...basePlan.ledger,
        {
          id: 'dec_2',
          timestamp: '2026-10-21T12:10:00.000Z',
          summary: 'Increased guests to 150',
          source: 'user' as const,
          status: 'approved' as const,
        },
      ],
    });

    const restored = restoreSnapshot(currentPlan, snapshotV1, ctx);

    // Current event ID is preserved
    expect(restored.id).toBe('active_event_123');
    // Version is current.version + 1
    expect(restored.version).toBe(4);
    // Updated at matches clock
    expect(restored.updatedAt).toBe('2026-10-21T12:00:00.000Z');
    // Snapshot content is restored (guest count is 80, not 150)
    expect(restored.meta.guestCount).toBe(80);
    // Ledger is CURRENT ledger plus one new entry
    expect(restored.ledger.length).toBe(currentPlan.ledger.length + 1);
    const lastEntry = restored.ledger[restored.ledger.length - 1];
    expect(lastEntry?.summary).toBe('Restored version 1');
    expect(lastEntry?.source).toBe('user');
    expect(lastEntry?.status).toBe('approved');
  });

  it('trims ledger to 500 entries if current ledger was already at capacity', () => {
    const basePlan = makeBaseline();
    const ids = createIdFactory('hist_ctx');
    const ctx = { ids, clock: fixedClock };
    const snapshotV1 = createSnapshot(basePlan, 'V1', ctx);

    const fullLedger = Array.from({ length: 500 }, (_, i) => ({
      id: `dec_${i}`,
      timestamp: '2026-10-21T12:00:00.000Z',
      summary: `Decision ${i}`,
      source: 'user' as const,
      status: 'approved' as const,
    }));

    const currentPlan = deepFreeze({
      ...basePlan,
      ledger: fullLedger,
    });

    const restored = restoreSnapshot(currentPlan, snapshotV1, ctx);
    expect(restored.ledger.length).toBe(500);
    expect(restored.ledger[0]?.summary).toBe('Decision 1');
    expect(restored.ledger[499]?.summary).toBe('Restored version 1');
  });
});
