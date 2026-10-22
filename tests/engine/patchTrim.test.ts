import { describe, expect, it } from 'vitest';
import { DEMO_SCENARIO } from '@/data/demoScenario';
import { applyPatch, createPatch } from '@/engine/patch';
import { createPlan } from '@/engine/planFactory';
import { createIdFactory } from '@/lib/id';
import { deepFreeze } from '../helpers/deepFreeze';

describe('Patch Engine: Ledger Trimming Bound', () => {
  const fixedClock = () => new Date('2026-10-21T12:00:00.000Z');

  it('trims the ledger to the most recent 500 entries to maintain schema bounds', () => {
    const ids = createIdFactory('trim_seed');
    const base = createPlan({
      meta: DEMO_SCENARIO.meta,
      constraints: DEMO_SCENARIO.constraints,
      ids,
      clock: fixedClock,
    }).plan;

    const existingLedger = Array.from({ length: 500 }, (_, idx) => ({
      id: `dec_${idx}`,
      timestamp: '2026-10-21T12:00:00.000Z',
      summary: `Decision ${idx}`,
      source: 'user' as const,
      status: 'approved' as const,
    }));

    const plan = deepFreeze({
      ...base,
      ledger: existingLedger,
    });

    const patchIds = createIdFactory('ledger_trim');
    const patch = createPatch(
      [{ type: 'set_setting', setting: 'outdoor' }],
      'Trim test patch',
      'user',
      patchIds,
      fixedClock,
      'approved',
    );

    const result = applyPatch(plan, patch, {
      ids: patchIds,
      clock: fixedClock,
      allowHardViolations: true,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.plan.ledger.length).toBe(500);
      expect(result.value.plan.ledger[0]?.summary).toBe('Decision 1');
      expect(result.value.plan.ledger[499]?.summary).toBe('Trim test patch');
    }
  });
});
