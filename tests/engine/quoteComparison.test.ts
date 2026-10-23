import { describe, expect, it } from 'vitest';
import { DEMO_SCENARIO } from '@/data/demoScenario';
import type { EventPlan, VendorNeed } from '@/domain/types';
import { createPlan } from '@/engine/planFactory';
import { compareQuotes } from '@/engine/quoteComparison';
import { quoteToBudgetOps } from '@/engine/quoteToBudget';
import { createIdFactory } from '@/lib/id';
import { buildVendorBrief } from '@/lib/vendorBrief';
import { summarizePlanForLlm } from '@/llm/context';

describe('Engine: Quote Comparison, Budget Ops & Vendor Brief', () => {
  const ids = createIdFactory('quote_unit_test');
  const clock = () => new Date('2026-10-21T12:00:00.000Z');
  const engineContext = { ids, clock };

  function makeBasePlan(): EventPlan {
    const { plan } = createPlan({
      meta: {
        ...DEMO_SCENARIO.meta,
        guestCount: 100,
        city: 'Pune',
        dateIso: '2026-11-20',
        setting: 'outdoor',
        hostBrief: 'Exclusive private family celebration with strict secret details',
      },
      constraints: [
        ...DEMO_SCENARIO.constraints,
        {
          id: 'c_cap',
          kind: 'budget_cap',
          severity: 'hard',
          description: 'Hard budget limit',
          numericValue: 500000,
        },
      ],
      ids,
      clock,
    });

    const vendorNeed: VendorNeed = {
      id: 'vn_photo',
      category: 'photography',
      requirements: ['Full day coverage', 'Drone videography'],
      questionsToAsk: [
        'How many photographers attend?',
        'What is your delivery turnaround?',
        'Do you include raw files?',
      ],
      quotes: [],
      status: 'comparing',
    };

    return {
      ...plan,
      vendors: [vendorNeed],
    };
  }

  describe('compareQuotes', () => {
    it('handles empty and single quote scenarios cleanly', () => {
      const plan = makeBasePlan();
      const emptyNeed: VendorNeed = { ...plan.vendors[0]!, quotes: [] };
      const emptyComp = compareQuotes(plan, emptyNeed);
      expect(emptyComp.columns).toHaveLength(0);
      expect(emptyComp.lowestPriceVendor).toBeUndefined();

      const singleNeed: VendorNeed = {
        ...plan.vendors[0]!,
        quotes: [
          {
            vendorName: 'Studio Single',
            price: 60000,
            answers: { 'How many photographers attend?': 'Two' },
          },
        ],
      };
      const singleComp = compareQuotes(plan, singleNeed);
      expect(singleComp.columns).toHaveLength(1);
      expect(singleComp.lowestPriceVendor).toBe('Studio Single');
      expect(singleComp.columns[0]?.completenessPercent).toBe(33);
    });

    it('identifies lowest price, most complete, and warns on 40% budget delta', () => {
      const plan = makeBasePlan();
      const photoItem = plan.budgetItems.find((i) => i.category === 'photography');
      const baseLineTotal = photoItem ? photoItem.unitCost * photoItem.quantity : 80000;

      const multiNeed: VendorNeed = {
        ...plan.vendors[0]!,
        quotes: [
          {
            vendorName: 'CheapShots',
            price: Math.round(baseLineTotal * 0.4),
            answers: {},
          },
          {
            vendorName: 'PerfectPix',
            price: baseLineTotal,
            answers: {
              'How many photographers attend?': '2 shooters',
              'What is your delivery turnaround?': '14 days',
              'Do you include raw files?': 'Yes',
            },
          },
        ],
      };

      const comp = compareQuotes(plan, multiNeed);
      expect(comp.lowestPriceVendor).toBe('CheapShots');
      expect(comp.mostCompleteVendor).toBe('PerfectPix');
      expect(comp.columns.find((c) => c.vendorName === 'PerfectPix')?.completenessPercent).toBe(100);

      expect(
        comp.observations.some(
          (o) => o.includes('lowest price') && o.includes("hasn't answered 3 of your questions"),
        ),
      ).toBe(true);

      expect(
        comp.observations.some((o) => o.includes('CheapShots is more than 40% away')),
      ).toBe(true);
    });
  });

  describe('quoteToBudgetOps', () => {
    it('updates existing unlocked budget line with flat basis and correct provenance', () => {
      const plan = makeBasePlan();
      const need = plan.vendors[0]!;
      const quote = { vendorName: 'Luxe Stills', price: 95000, answers: {} };

      const resVerified = quoteToBudgetOps(plan, need, quote, true, engineContext);
      expect(resVerified.ok).toBe(true);
      if (resVerified.ok && resVerified.value.ops[0]?.type === 'update_budget_item') {
        expect(resVerified.value.ops[0].changes.provenance).toBe('verified');
        expect(resVerified.value.ops[0].changes.unitCost).toBe(95000);
      }

      const resUser = quoteToBudgetOps(plan, need, quote, false, engineContext);
      expect(resUser.ok).toBe(true);
      if (resUser.ok && resUser.value.ops[0]?.type === 'update_budget_item') {
        expect(resUser.value.ops[0].changes.provenance).toBe('user');
      }
    });

    it('rejects updating a locked budget line with friendly error message', () => {
      const plan = makeBasePlan();
      const lockedPlan: EventPlan = {
        ...plan,
        budgetItems: plan.budgetItems.map((i) =>
          i.category === 'photography' ? { ...i, locked: true } : i,
        ),
      };
      const need = lockedPlan.vendors[0]!;
      const quote = { vendorName: 'Luxe Stills', price: 95000, answers: {} };

      const res = quoteToBudgetOps(lockedPlan, need, quote, true, engineContext);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.message).toBe('Unlock this budget line first');
      }
    });

    it('adds a new budget line when no matching category exists in the budget', () => {
      const plan = makeBasePlan();
      const newCategoryNeed: VendorNeed = {
        id: 'vn_ent',
        category: 'entertainment',
        requirements: ['DJ & Sound system'],
        questionsToAsk: [],
        quotes: [],
        status: 'comparing',
      };
      const quote = { vendorName: 'DJ Groove', price: 40000, answers: {} };

      const res = quoteToBudgetOps(plan, newCategoryNeed, quote, true, engineContext);
      expect(res.ok).toBe(true);
      if (res.ok && res.value.ops[0]?.type === 'add_budget_item') {
        expect(res.value.ops[0].item.category).toBe('entertainment');
        expect(res.value.ops[0].item.unitCost).toBe(40000);
        expect(res.value.ops[0].item.provenance).toBe('verified');
      }
    });
  });

  describe('buildVendorBrief and Privacy Verification', () => {
    it('builds clear plain text brief with bullets, numbered questions, and closing line', () => {
      const plan = makeBasePlan();
      const need = plan.vendors[0]!;
      const brief = buildVendorBrief(plan, need);

      expect(brief).toContain('Event: Anniversary celebration');
      expect(brief).toContain('Date: 2026-11-20');
      expect(brief).toContain('Location: Pune');
      expect(brief).toContain('Guest count: 100 guests');
      expect(brief).toContain('Setting: outdoor');
      expect(brief).toContain('- Full day coverage');
      expect(brief).toContain('1. How many photographers attend?');
      expect(brief).toContain(
        'Please share a written quote that covers the points above, including taxes, overtime and cancellation terms.',
      );

      expect(brief).not.toContain('500000');
      expect(brief).not.toContain('budget');
      expect(brief).not.toContain('cap');
      expect(brief).not.toContain('Exclusive private family celebration');
    });

    it('summarizePlanForLlm never contains a quote vendorName or answer text', () => {
      const plan = makeBasePlan();
      const secretVendorName = 'SuperSecretPhotoCo_XYZ';
      const secretAnswer = 'ConfidentialSpecialAccessSecretCode_98765';

      const planWithSecretQuote: EventPlan = {
        ...plan,
        vendors: [
          {
            ...plan.vendors[0]!,
            quotes: [
              {
                vendorName: secretVendorName,
                price: 125000,
                answers: { 'Do you include raw files?': secretAnswer },
              },
            ],
          },
        ],
      };

      const summary = summarizePlanForLlm(planWithSecretQuote);
      const serialized = JSON.stringify(summary);

      expect(serialized).not.toContain(secretVendorName);
      expect(serialized).not.toContain(secretAnswer);
    });
  });
});
