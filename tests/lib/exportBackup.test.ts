import { describe, expect, it } from 'vitest';
import { buildDemoPlan } from '@/engine/demo';
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  exportBackup,
  parseBackup,
  prepareImport,
} from '@/lib/export/backup';
import { createIdFactory } from '@/lib/id';
import { type EventRecord, eventRecordSchema } from '@/store/persistSchema';

const ctx = {
  ids: createIdFactory('export_backup_test'),
  clock: () => new Date('2026-10-21T12:00:00.000Z'),
};

function makeSampleRecord(idSuffix: string): EventRecord {
  const { plan, assumptions } = buildDemoPlan(ctx);
  return eventRecordSchema.parse({
    plan: { ...plan, id: `evt_${idSuffix}` },
    history: [
      {
        version: 1,
        savedAt: '2026-10-21T12:00:00.000Z',
        label: 'Initial snapshot',
        plan: { ...plan, id: `evt_${idSuffix}` },
      },
    ],
    messages: [
      {
        id: 'msg_1',
        role: 'user',
        text: 'Hello assistant',
        createdAt: '2026-10-21T12:00:00.000Z',
      },
    ],
    assumptions,
    missingInfo: [],
    contacts: [
      {
        id: 'c_1',
        name: 'Asha Coordinator',
        role: 'Planner',
        phone: '+91 98765 43210',
      },
    ],
  });
}

describe('Export: Backup Round-Trip, Validation & Hostile Input Defenses', () => {
  it('round-trips records accurately with fresh IDs and dropped chat messages while preserving history, assumptions and contacts', () => {
    const original = makeSampleRecord('orig');
    const json = exportBackup([original], ctx.clock());

    const parsed = parseBackup(json);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.value.skipped).toBe(0);
    expect(parsed.value.records).toHaveLength(1);

    const importIds = createIdFactory('fresh_import_seed');
    const prepared = prepareImport(parsed.value.records, importIds);
    expect(prepared).toHaveLength(1);

    const imported = prepared[0]!;
    // New non-colliding ID assigned to plan and history snapshots
    expect(imported.plan.id).not.toBe(original.plan.id);
    expect(imported.history[0]?.plan.id).toBe(imported.plan.id);
    // Chat messages dropped
    expect(imported.messages).toEqual([]);
    // Everything else preserved
    expect(imported.contacts).toEqual(original.contacts);
    expect(imported.assumptions).toEqual(original.assumptions);
    expect({ ...imported.plan, id: original.plan.id }).toEqual(original.plan);
  });

  it('rejects hostile inputs: >2MB string, invalid JSON, wrong format, and wrong version without throwing', () => {
    const threeMbString = 'x'.repeat(3_000_000);
    const resTooBig = parseBackup(threeMbString);
    expect(resTooBig.ok).toBe(false);

    const resInvalidJson = parseBackup('{not valid json');
    expect(resInvalidJson.ok).toBe(false);

    const resWrongFormat = parseBackup(
      JSON.stringify({ format: 'other-app', version: 1, events: [] }),
    );
    expect(resWrongFormat.ok).toBe(false);

    const resWrongVersion = parseBackup(
      JSON.stringify({ format: BACKUP_FORMAT, version: 99, events: [] }),
    );
    expect(resWrongVersion.ok).toBe(false);
  });

  it('skips bad records among good ones, caps at 20 events, strips unknown keys, and neutralizes __proto__', () => {
    const good1 = makeSampleRecord('g1');
    const good2 = makeSampleRecord('g2');
    const badRecord = {
      ...good1,
      plan: {
        ...good1.plan,
        meta: { ...good1.plan.meta, guestCount: 'not-a-number' },
      },
    };

    const rawWithProto = `{"format":"${BACKUP_FORMAT}","version":${BACKUP_VERSION},"exportedAt":"2026-10-21T00:00:00Z","__proto__":{"polluted":true},"events":[${JSON.stringify(good1)},${JSON.stringify(badRecord)},{"plan":${JSON.stringify(good2.plan)},"extraUnknownField":"strip_me","__proto__":{"pollutedRecord":true}}]}`;

    const parsed = parseBackup(rawWithProto);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.value.records).toHaveLength(2);
    expect(parsed.value.skipped).toBe(1);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(({} as Record<string, unknown>).pollutedRecord).toBeUndefined();
    expect(
      'extraUnknownField' in (parsed.value.records[1] as unknown as Record<string, unknown>),
    ).toBe(false);

    // 25 valid events -> 20 imported, 5 skipped
    const twentyFive = Array.from({ length: 25 }, (_, i) => makeSampleRecord(`b_${i}`));
    const parsed25 = parseBackup(exportBackup(twentyFive, ctx.clock()));
    expect(parsed25.ok).toBe(true);
    if (!parsed25.ok) return;
    expect(parsed25.value.records).toHaveLength(20);
    expect(parsed25.value.skipped).toBe(5);
  });
});
