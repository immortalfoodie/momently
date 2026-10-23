import { describe, expect, it } from 'vitest';
import { DEMO_SCENARIO } from '@/data/demoScenario';
import { vendorQuoteSchema } from '@/domain/baseSchemas';
import type { EventPlan, VendorNeed } from '@/domain/types';
import { createPlan } from '@/engine/planFactory';
import { reducePatchOp } from '@/engine/patchOps';
import { createIdFactory } from '@/lib/id';

describe('Patch Ops: Vendor Need Operations & Schema Limits', () => {
  const ids = createIdFactory('test_vendor_patch');
  const clock = () => new Date('2026-10-21T12:00:00.000Z');

  function makeTestPlan(): EventPlan {
    const { plan } = createPlan({
      meta: DEMO_SCENARIO.meta,
      constraints: DEMO_SCENARIO.constraints,
      ids,
      clock,
    });

    const vendorNeed: VendorNeed = {
      id: 'vn_food',
      category: 'food',
      requirements: ['Live chaat counter', 'Buffet lunch'],
      questionsToAsk: ['Is tasting included?', 'Do you provide servers?'],
      quotes: [
        {
          vendorName: 'Royal Spice Caterers',
          price: 150000,
          answers: { 'Is tasting included?': 'Yes, for 4 people' },
        },
      ],
      status: 'comparing',
    };

    return {
      ...plan,
      vendors: [vendorNeed],
    };
  }

  describe('update_vendor_need op', () => {
    it('updates vendor need status case-insensitively', () => {
      const plan = makeTestPlan();
      const res = reducePatchOp(
        plan,
        {
          type: 'update_vendor_need',
          category: 'food',
          status: 'booked',
        },
        ids,
      );

      expect(res.ok).toBe(true);
      if (res.ok) {
        const need = res.value.plan.vendors.find((v) => v.category === 'food');
        expect(need?.status).toBe('booked');
      }
    });

    it('returns vendor_not_found for an unlisted category', () => {
      const plan = makeTestPlan();
      const res = reducePatchOp(
        plan,
        {
          type: 'update_vendor_need',
          category: 'decor',
          status: 'booked',
        },
        ids,
      );

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('vendor_not_found');
      }
    });
  });

  describe('upsert_vendor_quote op', () => {
    it('adds a new quote to the category quotes array', () => {
      const plan = makeTestPlan();
      const res = reducePatchOp(
        plan,
        {
          type: 'upsert_vendor_quote',
          category: 'food',
          quote: {
            vendorName: 'Delight Gourmet',
            price: 180000,
            answers: { 'Is tasting included?': 'Yes' },
          },
        },
        ids,
      );

      expect(res.ok).toBe(true);
      if (res.ok) {
        const need = res.value.plan.vendors.find((v) => v.category === 'food');
        expect(need?.quotes).toHaveLength(2);
        expect(need?.quotes.some((q) => q.vendorName === 'Delight Gourmet')).toBe(true);
      }
    });

    it('replaces an existing quote with matching vendorName (case-insensitive)', () => {
      const plan = makeTestPlan();
      const res = reducePatchOp(
        plan,
        {
          type: 'upsert_vendor_quote',
          category: 'food',
          quote: {
            vendorName: 'royal spice caterers',
            price: 145000,
            answers: { 'Is tasting included?': 'Yes, for 6 people' },
          },
        },
        ids,
      );

      expect(res.ok).toBe(true);
      if (res.ok) {
        const need = res.value.plan.vendors.find((v) => v.category === 'food');
        expect(need?.quotes).toHaveLength(1);
        expect(need?.quotes[0]?.price).toBe(145000);
      }
    });

    it('rejects adding beyond the limit of 10 quotes with invalid_change', () => {
      const plan = makeTestPlan();
      const need = plan.vendors[0]!;
      const tenQuotes = Array.from({ length: 10 }, (_, i) => ({
        vendorName: `Vendor ${i + 1}`,
        price: 100000 + i * 1000,
        answers: {},
      }));
      const planWith10: EventPlan = {
        ...plan,
        vendors: [{ ...need, quotes: tenQuotes }],
      };

      const res = reducePatchOp(
        planWith10,
        {
          type: 'upsert_vendor_quote',
          category: 'food',
          quote: {
            vendorName: '11th Vendor',
            price: 200000,
            answers: {},
          },
        },
        ids,
      );

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('invalid_change');
      }
    });
  });

  describe('remove_vendor_quote op', () => {
    it('removes a quote by vendorName case-insensitively', () => {
      const plan = makeTestPlan();
      const res = reducePatchOp(
        plan,
        {
          type: 'remove_vendor_quote',
          category: 'food',
          vendorName: 'ROYAL SPICE CATERERS',
        },
        ids,
      );

      expect(res.ok).toBe(true);
      if (res.ok) {
        const need = res.value.plan.vendors.find((v) => v.category === 'food');
        expect(need?.quotes).toHaveLength(0);
      }
    });
  });

  describe('vendorQuoteSchema limits', () => {
    it('enforces vendorName max length of 80 characters', () => {
      expect(() =>
        vendorQuoteSchema.parse({
          vendorName: 'A'.repeat(81),
          price: 10000,
          answers: {},
        }),
      ).toThrow();
    });

    it('enforces at most 12 answer entries', () => {
      const thirteenAnswers: Record<string, string> = {};
      for (let i = 0; i < 13; i++) {
        thirteenAnswers[`question_${i}`] = 'answer';
      }

      expect(() =>
        vendorQuoteSchema.parse({
          vendorName: 'Valid Vendor',
          price: 10000,
          answers: thirteenAnswers,
        }),
      ).toThrow();
    });

    it('enforces answer key max 160 and value max 200', () => {
      expect(() =>
        vendorQuoteSchema.parse({
          vendorName: 'Valid Vendor',
          price: 10000,
          answers: { ['Q'.repeat(161)]: 'Valid' },
        }),
      ).toThrow();

      expect(() =>
        vendorQuoteSchema.parse({
          vendorName: 'Valid Vendor',
          price: 10000,
          answers: { ValidQ: 'A'.repeat(201) },
        }),
      ).toThrow();
    });
  });
});
