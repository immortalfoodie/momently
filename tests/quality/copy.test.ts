import { describe, expect, it } from 'vitest';
import { PAGE_COPY } from '@/lib/copy';

const BANNED_WORDS = [
  'ledger',
  'deterministic',
  'provenance',
  'lever',
  'triage',
  'floor',
  'utilization',
  'milestone',
  'operational',
  'synthesize',
  'orchestration',
  'rate-card',
];

describe('Quality Guard: PAGE_COPY plain English and size limits', () => {
  it('enforces every description is under 140 characters', () => {
    for (const [key, entry] of Object.entries(PAGE_COPY)) {
      expect(
        entry.description.length,
        `PAGE_COPY.${key}.description is ${entry.description.length} chars (must be <= 140)`
      ).toBeLessThanOrEqual(140);
    }
  });

  it('enforces no banned jargon words in titles or descriptions', () => {
    for (const [key, entry] of Object.entries(PAGE_COPY)) {
      const combined = `${entry.title} ${entry.description}`.toLowerCase();
      for (const banned of BANNED_WORDS) {
        expect(
          combined.includes(banned.toLowerCase()),
          `PAGE_COPY.${key} contains banned word "${banned}"`
        ).toBe(false);
      }
    }
  });
});
