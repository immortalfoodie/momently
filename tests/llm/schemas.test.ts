import { describe, expect, it } from 'vitest';
import {
  intakeInputSchema,
  intakeOutputSchema,
  conceptsOutputSchema,
  intentOutputSchema,
  narrateInputSchema,
  narrateOutputSchema,
} from '@/llm/schemas/index';

describe('LLM Task Schemas', () => {
  it('validates task input schemas', () => {
    expect(() =>
      intakeInputSchema.parse({
        text: 'Anniversary celebration for 80 guests in Mumbai',
        today: '2026-10-21',
      }),
    ).not.toThrow();

    expect(() =>
      intakeInputSchema.parse({
        text: '',
        today: 'invalid-date',
      }),
    ).toThrow();
  });

  it('validates a valid intake output and rejects budget_cap in constraints', () => {
    const valid = {
      title: 'Grand Birthday Party',
      type: 'birthday',
      city: 'Bengaluru',
      dateIso: '2026-11-20',
      guestCount: 50,
      setting: 'outdoor',
      budgetCap: 100000,
      budgetIsHard: true,
      constraints: [
        {
          kind: 'style',
          description: 'Neon cyberpunk theme with warm lighting',
          severity: 'soft',
        },
      ],
      guestNeeds: {
        vegetarian: 10,
      },
      styleTags: ['neon', 'cyberpunk'],
      missingInfo: [],
    };

    expect(() => intakeOutputSchema.parse(valid)).not.toThrow();

    // Rejection: budget_cap in constraints must fail validation
    const invalidConstraint = {
      ...valid,
      constraints: [
        {
          kind: 'budget_cap',
          description: 'Cap expenditure',
          severity: 'hard',
        },
      ],
    };
    expect(() => intakeOutputSchema.parse(invalidConstraint)).toThrow();

    // Rejection: guest_count in constraints must fail validation
    const invalidGuestConstraint = {
      ...valid,
      constraints: [
        {
          kind: 'guest_count',
          description: 'Guest count constraint',
          severity: 'hard',
        },
      ],
    };
    expect(() => intakeOutputSchema.parse(invalidGuestConstraint)).toThrow();
  });

  it('ensures guestNeeds schema remains strict within intakeOutputSchema', () => {
    const withExtraKey = {
      title: 'Party',
      type: 'birthday',
      city: null,
      dateIso: null,
      guestCount: null,
      setting: null,
      budgetCap: null,
      budgetIsHard: true,
      constraints: [],
      guestNeeds: {
        vegetarian: 5,
        unrecognizedSecretNeed: 10, // Must be rejected
      },
      styleTags: [],
      missingInfo: [],
    };

    expect(() => intakeOutputSchema.parse(withExtraKey)).toThrow();
  });

  it('validates concepts schema requires exactly 3 proposals', () => {
    const singleConcept = {
      title: 'Vintage Retro',
      tagline: 'Timeless glamour',
      summary: 'Retro cinema aesthetic',
      palette: ['#111111', '#222222', '#333333'],
      experienceHighlights: ['Live Singer', 'Photo Wall', 'Classic Dinner'],
      qualityProfile: { decor: 'standard' },
      tradeoffs: ['Lean sound setup'],
      whyItFits: 'Fits host taste',
      tags: ['retro'],
    };

    // Exactly 3 concepts passes
    expect(() =>
      conceptsOutputSchema.parse({
        concepts: [singleConcept, singleConcept, singleConcept],
      }),
    ).not.toThrow();

    // 2 concepts fails
    expect(() =>
      conceptsOutputSchema.parse({
        concepts: [singleConcept, singleConcept],
      }),
    ).toThrow();

    // 4 concepts fails
    expect(() =>
      conceptsOutputSchema.parse({
        concepts: [singleConcept, singleConcept, singleConcept, singleConcept],
      }),
    ).toThrow();
  });

  it('validates intent discriminated union and rejects an unknown kind', () => {
    const validChangeGuests = {
      kind: 'change_guest_count',
      guestCount: 120,
    };
    expect(() => intentOutputSchema.parse(validChangeGuests)).not.toThrow();

    const validSimulate = {
      kind: 'simulate',
      scenario: { type: 'rain' },
    };
    expect(() => intentOutputSchema.parse(validSimulate)).not.toThrow();

    const validAffordCheck = {
      kind: 'afford_check',
      description: 'live singer',
      family: 'entertainment_music',
      userStatedCost: 15000,
    };
    expect(() => intentOutputSchema.parse(validAffordCheck)).not.toThrow();

    const validAddPreference = {
      kind: 'add_preference',
      preferenceKind: 'accessibility',
      description: 'Wheelchair ramp required',
      severity: 'hard',
    };
    expect(() => intentOutputSchema.parse(validAddPreference)).not.toThrow();

    // Unknown kind rejected
    const unknownKind = {
      kind: 'book_flight_to_mars',
      details: 'flight',
    };
    expect(() => intentOutputSchema.parse(unknownKind)).toThrow();
  });

  it('validates narrate input and output schemas', () => {
    const validNarrateInput = {
      purpose: 'chaos_summary',
      facts: {
        title: 'Silver Jubilee',
        scenario: 'Sudden rain',
        score: 82,
        highlights: ['Indoor backup confirmed'],
      },
    };
    expect(() => narrateInputSchema.parse(validNarrateInput)).not.toThrow();

    const validNarrateOutput = {
      text: 'Your rain contingency plan has been prepared.',
      highlights: ['Indoor hall reserved', 'Timelines protected'],
    };
    expect(() => narrateOutputSchema.parse(validNarrateOutput)).not.toThrow();

    // More than 30 keys in facts is rejected
    const tooManyFacts: Record<string, string> = {};
    for (let i = 0; i < 35; i++) {
      tooManyFacts[`fact_${i}`] = `value_${i}`;
    }
    expect(() =>
      narrateInputSchema.parse({
        purpose: 'chat_reply',
        facts: tooManyFacts,
      }),
    ).toThrow();
  });
});
