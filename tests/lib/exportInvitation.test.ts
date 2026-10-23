import { describe, expect, it } from 'vitest';
import { buildDemoPlan } from '@/engine/demo';
import { buildInvitationText } from '@/lib/export/invitation';
import { createIdFactory } from '@/lib/id';

const ctx = {
  ids: createIdFactory('export_invite_test'),
  clock: () => new Date('2026-10-21T12:00:00.000Z'),
};

describe('Export: Invitation Text Builder', () => {
  it('includes bracketed placeholders, long date, first session start time, city, and concept tagline', () => {
    const { plan } = buildDemoPlan(ctx);
    const planWithConcept = {
      ...plan,
      selectedConceptId: plan.concepts[0]?.id ?? null,
    };

    const text = buildInvitationText(planWithConcept, 'warm');

    expect(text).toContain('[Host names]');
    expect(text).toContain('[Venue name and address]');
    expect(text).toContain('[RSVP contact and date]');
    expect(text).toContain('Tuesday, 15 December 2026');
    expect(text).toContain(plan.meta.city);
    expect(text).toContain(plan.concepts[0]!.tagline);
  });

  it('never mentions budget words, caps, prices, guest needs or accessibility claims', () => {
    const { plan } = buildDemoPlan(ctx);
    const planWithNeeds = {
      ...plan,
      guestNeeds: {
        ...plan.guestNeeds,
        wheelchairUsers: 4,
        vegetarian: 50,
        jain: 15,
      },
    };

    for (const tone of ['warm', 'formal', 'playful'] as const) {
      const text = buildInvitationText(planWithNeeds, tone);
      expect(text).not.toMatch(/₹|INR|budget|cap|1,50,000|150000|wheelchair|vegetarian|jain/i);
    }
  });

  it('works cleanly without a date and produces distinct output for each tone', () => {
    const { plan } = buildDemoPlan(ctx);
    const undatedPlan = {
      ...plan,
      meta: { ...plan.meta, dateIso: undefined },
    };

    const warm = buildInvitationText(undatedPlan, 'warm');
    const formal = buildInvitationText(undatedPlan, 'formal');
    const playful = buildInvitationText(undatedPlan, 'playful');

    expect(warm).toContain('[date to be confirmed]');
    expect(formal).toContain('[date to be confirmed]');
    expect(playful).toContain('[date to be confirmed]');

    expect(warm).not.toBe(formal);
    expect(warm).not.toBe(playful);
    expect(formal).not.toBe(playful);
  });
});
