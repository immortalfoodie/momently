import { describe, expect, it } from 'vitest';
import type { DecisionRecord, EventPlan } from '@/domain/types';
import { buildDemoPlan } from '@/engine/demo';
import { createIdFactory } from '@/lib/id';
import {
  SLIM_LEDGER_ENTRIES,
  requestConcepts,
  sendMessage,
  slimPlanForRequest,
} from '@/lib/apiClient';

const ctx = { ids: createIdFactory('slim'), clock: () => new Date('2026-10-22T10:00:00.000Z') };

function planWithLedger(entries: number): EventPlan {
  const { plan } = buildDemoPlan(ctx);
  const ledger: DecisionRecord[] = Array.from({ length: entries }, (_, i) => ({
    id: `dec_${i}`,
    timestamp: '2026-10-22T10:00:00.000Z',
    summary: `Approved change number ${i}: adjusted a line item after review by the host`,
    source: 'user',
    status: 'approved',
  }));
  return { ...plan, ledger };
}

describe('slimPlanForRequest', () => {
  it('keeps only the most recent ledger entries and leaves everything else untouched', () => {
    const plan = planWithLedger(500);
    const slim = slimPlanForRequest(plan);

    expect(slim.ledger).toHaveLength(SLIM_LEDGER_ENTRIES);
    expect(slim.ledger[0]?.id).toBe('dec_480');
    expect(slim.ledger.at(-1)?.id).toBe('dec_499');
    expect({ ...slim, ledger: [] }).toEqual({ ...plan, ledger: [] });
  });

  it('serialises a 500-entry demo plan to under 60,000 characters without mutating the original', () => {
    const plan = planWithLedger(500);
    const before = JSON.stringify(plan);

    const slim = slimPlanForRequest(plan);

    expect(JSON.stringify(slim).length).toBeLessThan(60_000);
    expect(JSON.stringify(plan)).toBe(before);
    expect(plan.ledger).toHaveLength(500);
  });

  it('sends the slim plan to /api/message', async () => {
    const plan = planWithLedger(500);
    let sentLedgerLength = -1;
    const fakeFetch: typeof fetch = async (_url, init) => {
      const body = JSON.parse(init?.body as string) as { plan: EventPlan };
      sentLedgerLength = body.plan.ledger.length;
      return new Response(JSON.stringify({ outcome: { kind: 'reply', text: 'ok' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    await sendMessage({ message: 'hi', plan, recentMessages: [] }, { fetchFn: fakeFetch });

    expect(sentLedgerLength).toBe(SLIM_LEDGER_ENTRIES);
    expect(plan.ledger).toHaveLength(500);
  });

  it('sends the slim plan to /api/concepts', async () => {
    const plan = planWithLedger(500);
    let sentLedgerLength = -1;
    const fakeFetch: typeof fetch = async (_url, init) => {
      const body = JSON.parse(init?.body as string) as { plan: EventPlan };
      sentLedgerLength = body.plan.ledger.length;
      return new Response(
        JSON.stringify({ concepts: [], degraded: false, notes: [] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    };

    await requestConcepts(plan, { fetchFn: fakeFetch });

    expect(sentLedgerLength).toBe(SLIM_LEDGER_ENTRIES);
    expect(plan.ledger).toHaveLength(500);
  });
});
