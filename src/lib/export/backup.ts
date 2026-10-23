import type { IdFactory } from '@/lib/id';
import { err, ok, type Result } from '@/lib/result';
import { type EventRecord, eventRecordSchema } from '@/store/persistSchema';

export const BACKUP_FORMAT = 'momently-backup' as const;
export const BACKUP_VERSION = 1 as const;
export const MAX_BACKUP_CHARS = 2_000_000;
export const MAX_BACKUP_EVENTS = 20;

export interface BackupEnvelope {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  events: readonly EventRecord[];
}

export interface ParsedBackup {
  records: EventRecord[];
  skipped: number;
}

/**
 * Serializes stored EventRecords into a versioned JSON backup envelope.
 *
 * @param records - Array of EventRecord objects to export.
 * @param now - Injected clock timestamp for `exportedAt`.
 * @returns Formatted JSON string.
 */
export function exportBackup(records: readonly EventRecord[], now: Date): string {
  const payload: BackupEnvelope = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    events: records,
  };
  return JSON.stringify(payload, null, 2);
}

function validateEnvelopeHeader(
  raw: unknown,
): Result<{ events: unknown[] }, { message: string }> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return err({ message: 'Invalid backup file structure.' });
  }
  const obj = raw as Record<string, unknown>;
  if (obj.format !== BACKUP_FORMAT) {
    return err({
      message: 'Unrecognized backup format. Please choose a Momently backup JSON file.',
    });
  }
  if (obj.version !== BACKUP_VERSION) {
    return err({
      message: `Unsupported backup version (${String(obj.version)}). Expected version ${BACKUP_VERSION}.`,
    });
  }
  if (!Array.isArray(obj.events)) {
    return err({ message: 'Backup file is missing the events list.' });
  }
  return ok({ events: obj.events });
}

/**
 * Safely parses and validates an untrusted backup JSON string.
 *
 * SECURITY & RESILIENCE (WHY):
 * 1. Enforces a strict 2,000,000-character ceiling before JSON parsing to prevent memory exhaustion.
 * 2. Validates the envelope `format` and `version`.
 * 3. Validates each record individually via `eventRecordSchema.safeParse`, which strips unknown keys
 *    and neutralizes `__proto__` prototype pollution vectors.
 * 4. Skips malformed records without failing the valid ones, and caps accepted events at 20.
 *
 * @param text - Raw JSON text read from user file upload.
 * @returns Result with valid records and count of skipped items, or a plain-English error message.
 */
export function parseBackup(text: string): Result<ParsedBackup, { message: string }> {
  if (typeof text !== 'string' || text.length > MAX_BACKUP_CHARS) {
    return err({
      message: 'Backup file is too large (maximum 2 MB allowed).',
    });
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(text);
  } catch {
    return err({ message: 'Backup file is not valid JSON.' });
  }

  const headerRes = validateEnvelopeHeader(parsedJson);
  if (!headerRes.ok) {
    return headerRes;
  }

  const records: EventRecord[] = [];
  let skipped = 0;

  for (const item of headerRes.value.events) {
    if (records.length >= MAX_BACKUP_EVENTS) {
      skipped++;
      continue;
    }
    const validation = eventRecordSchema.safeParse(item);
    if (validation.success) {
      records.push(validation.data);
    } else {
      skipped++;
    }
  }

  return ok({ records, skipped });
}

/**
 * Prepares validated backup records for import by assigning fresh event IDs and clearing ephemeral chat messages.
 *
 * ARCHITECTURAL DECISION (WHY RE-ID ON IMPORT):
 * Re-assigning a fresh `plan.id` guarantees that importing a backup (or importing the same backup twice)
 * never collides with or silently overwrites an existing event in the user's browser.
 *
 * @param records - Validated EventRecords from parseBackup.
 * @param ids - ID factory used to generate fresh collision-free event IDs.
 * @returns Fresh EventRecords ready to append to the store.
 */
export function prepareImport(
  records: readonly EventRecord[],
  ids: IdFactory,
): EventRecord[] {
  return records.map((record) => {
    const newId = ids('evt');
    return {
      plan: {
        ...record.plan,
        id: newId,
      },
      history: record.history.map((snap) => ({
        ...snap,
        plan: {
          ...snap.plan,
          id: newId,
        },
      })),
      messages: [],
      assumptions: [...record.assumptions],
      missingInfo: [...record.missingInfo],
      contacts: [...record.contacts],
    };
  });
}
