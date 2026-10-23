import { describe, expect, it } from 'vitest';
import { contactSchema } from '@/domain/contactSchemas';
import { eventRecordSchema } from '@/store/persistSchema';
import { useEventsStore } from '@/store/eventsStore';
import { engineContext } from '@/store/engineContext';
import { buildDemoPlan } from '@/engine/demo';
import { requestConcepts, sendMessage } from '@/lib/apiClient';
import { summarizePlanForLlm } from '@/llm/context';

describe('Contacts domain schema and backward compatibility', () => {
  it('validates a valid contact', () => {
    const valid = {
      id: 'c1',
      name: 'Ramesh Sharma',
      role: 'Catering Lead',
      phone: '+91 98765 43210',
      category: 'food',
      note: 'Gate 2 delivery only',
    };
    expect(contactSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects invalid names and invalid phone numbers', () => {
    expect(contactSchema.safeParse({ id: 'c1', name: '' }).success).toBe(false);
    expect(
      contactSchema.safeParse({ id: 'c1', name: 'Valid Name', phone: 'invalid-phone' }).success,
    ).toBe(false);
  });

  it('loads older event records missing contacts by defaulting to an empty array', () => {
    const demo = buildDemoPlan(engineContext);
    const legacyRecord = {
      plan: demo.plan,
      history: [],
      messages: [],
      assumptions: [],
      missingInfo: [],
    };
    const parsed = eventRecordSchema.safeParse(legacyRecord);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.contacts).toEqual([]);
    }
  });
});

describe('Store contact actions (privacy and immutability)', () => {
  it('adds, updates, and removes contacts without bumping plan version or touching ledger/history', () => {
    const store = useEventsStore.getState();
    const eventId = store.createDemoEvent();
    const initialRecord = useEventsStore.getState().events[eventId]!;
    const initialVersion = initialRecord.plan.version;
    const initialLedgerLen = initialRecord.plan.ledger.length;
    const initialHistoryLen = initialRecord.history.length;

    // Add contact
    store.addContact(eventId, {
      id: 'contact_1',
      name: 'Priya Mehta',
      role: 'Decorator',
      phone: '+919876543210',
      category: 'decor',
    });

    let rec = useEventsStore.getState().events[eventId]!;
    expect(rec.contacts).toHaveLength(1);
    expect(rec.contacts[0]?.name).toBe('Priya Mehta');
    expect(rec.plan.version).toBe(initialVersion);
    expect(rec.plan.ledger.length).toBe(initialLedgerLen);
    expect(rec.history.length).toBe(initialHistoryLen);

    // Update contact
    store.updateContact(eventId, 'contact_1', { role: 'Lead Floral Designer' });
    rec = useEventsStore.getState().events[eventId]!;
    expect(rec.contacts[0]?.role).toBe('Lead Floral Designer');
    expect(rec.plan.version).toBe(initialVersion);
    expect(rec.plan.ledger.length).toBe(initialLedgerLen);

    // Remove contact
    store.removeContact(eventId, 'contact_1');
    rec = useEventsStore.getState().events[eventId]!;
    expect(rec.contacts).toHaveLength(0);
    expect(rec.plan.version).toBe(initialVersion);
    expect(rec.plan.ledger.length).toBe(initialLedgerLen);

    // Never throws for unknown event or contact
    expect(() => store.addContact('unknown_event', { id: 'c2', name: 'Test' })).not.toThrow();
    expect(() => store.updateContact('unknown_event', 'c2', { name: 'Test' })).not.toThrow();
    expect(() => store.removeContact('unknown_event', 'c2')).not.toThrow();
    expect(() => store.updateContact(eventId, 'unknown_contact', { name: 'Test' })).not.toThrow();
    expect(() => store.removeContact(eventId, 'unknown_contact')).not.toThrow();
  });
});

describe('Contacts Privacy By Construction', () => {
  it('never leaks contact details to AI client requests or LLM summaries', async () => {
    const store = useEventsStore.getState();
    const eventId = store.createDemoEvent();
    const secretMarker = 'SECRET_VIP_PHONE_AND_NAME_99999';

    store.addContact(eventId, {
      id: 'secret_c1',
      name: secretMarker,
      role: 'Confidential Coordinator',
      phone: '+91 99999 88888',
      note: 'Do not share with LLM',
    });

    const currentRecord = useEventsStore.getState().events[eventId]!;
    const plan = currentRecord.plan;

    // 1. LLM context summary does not contain the contact
    const summary = summarizePlanForLlm(plan);
    const summaryStr = JSON.stringify(summary);
    expect(summaryStr).not.toContain(secretMarker);
    expect(summaryStr).not.toContain('+91 99999 88888');

    // 2. ApiClient requests (sendMessage, requestConcepts)
    const capturedBodies: string[] = [];
    const capturingFetch: typeof fetch = async (_input, init) => {
      if (init?.body && typeof init.body === 'string') {
        capturedBodies.push(init.body);
      }
      return new Response(
        JSON.stringify({ ok: true, message: 'Mock response', concepts: [] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    };

    await sendMessage(
      {
        message: 'Can we afford a live band?',
        plan,
        recentMessages: [],
      },
      { fetchFn: capturingFetch },
    );

    await requestConcepts(plan, { fetchFn: capturingFetch });

    expect(capturedBodies.length).toBeGreaterThanOrEqual(2);
    for (const body of capturedBodies) {
      expect(body).not.toContain(secretMarker);
      expect(body).not.toContain('+91 99999 88888');
    }
  });
});
