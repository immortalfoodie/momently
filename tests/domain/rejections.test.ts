import { describe, expect, it } from 'vitest';
import {
  budgetItemSchema,
  conceptSchema,
  eventMetaSchema,
  guestNeedsSchema,
  moneySchema,
  planPatchOpSchema,
  planPatchSchema,
} from '@/domain/schemas';

describe('Domain Zod Schemas - Strict Rejection Rules', () => {
  it('rejects negative or fractional money', () => {
    expect(() => moneySchema.parse(-100)).toThrow();
    expect(() => moneySchema.parse(1500.5)).toThrow();
  });

  it('rejects guestCount 0 or above 5000', () => {
    expect(() =>
      eventMetaSchema.parse({
        title: 'Event',
        type: 'wedding',
        city: 'Delhi',
        guestCount: 0,
        setting: 'indoor',
        hostBrief: 'Brief',
      }),
    ).toThrow();

    expect(() =>
      eventMetaSchema.parse({
        title: 'Event',
        type: 'wedding',
        city: 'Delhi',
        guestCount: 5001,
        setting: 'indoor',
        hostBrief: 'Brief',
      }),
    ).toThrow();
  });

  it('rejects invalid palette hex colors', () => {
    expect(() =>
      conceptSchema.parse({
        id: 'c_bad',
        title: 'Title',
        tagline: 'Tagline',
        summary: 'Summary',
        palette: ['#ZZZZZZ', '#123456', '#FFFFFF'],
        experienceHighlights: ['H1', 'H2', 'H3'],
        estimatedTotal: 100000,
        tradeoffs: ['T1'],
        whyItFits: 'Fit',
        tags: [],
      }),
    ).toThrow();
  });

  it('rejects invalid ISO dates in eventMetaSchema', () => {
    const baseMeta = {
      title: 'Event',
      type: 'wedding',
      city: 'Delhi',
      guestCount: 100,
      setting: 'indoor',
      hostBrief: 'Brief',
    };
    expect(() => eventMetaSchema.parse({ ...baseMeta, dateIso: '2026-13-45' })).toThrow();
    expect(() => eventMetaSchema.parse({ ...baseMeta, dateIso: '2026/10/21' })).toThrow();
    expect(() =>
      eventMetaSchema.parse({ ...baseMeta, dateIso: 'invalid-date' }),
    ).toThrow();
  });

  it('rejects a patch with 0 ops', () => {
    expect(() =>
      planPatchSchema.parse({
        id: 'p_empty',
        ops: [],
        reason: 'Empty ops patch',
        source: 'user',
        status: 'proposed',
        createdAt: '2026-10-21T12:00:00Z',
      }),
    ).toThrow();
  });

  it('rejects an unknown plan patch op type', () => {
    expect(() =>
      planPatchOpSchema.parse({
        type: 'unknown_magic_op',
        someField: 123,
      }),
    ).toThrow();
  });

  it('rejects unexpected "names" key in GuestNeeds for privacy protection', () => {
    expect(() =>
      guestNeedsSchema.parse({
        vegetarian: 10,
        jain: 0,
        vegan: 0,
        glutenFree: 0,
        allergyAlerts: 0,
        wheelchairUsers: 0,
        elderly: 0,
        children: 0,
        quietSpaceNeeded: false,
        languages: ['English'],
        names: ['John Doe', 'Jane Doe'],
      }),
    ).toThrow();
  });

  it('rejects budget items with rateKey exceeding 60 characters', () => {
    expect(() =>
      budgetItemSchema.parse({
        id: 'bi_long',
        category: 'venue',
        label: 'Hall',
        basis: 'flat',
        unitCost: 20000,
        quantity: 1,
        provenance: 'estimate',
        locked: false,
        rateKey: 'a'.repeat(61),
      }),
    ).toThrow();
  });
});
