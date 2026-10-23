import { describe, expect, it } from 'vitest';
import {
  budgetItemSchema,
  conceptSchema,
  constraintSchema,
  decisionRecordSchema,
  eventMetaSchema,
  eventPlanSchema,
  guestNeedsSchema,
  moneySchema,
  planImpactSchema,
  planPatchSchema,
  provenanceSchema,
  riskSchema,
  scheduleSlotSchema,
  taskSchema,
  vendorNeedSchema,
  vendorQuoteSchema,
} from '@/domain/schemas';

describe('Domain Zod Schemas - Valid Samples', () => {
  it('validates primitive and atomic schemas', () => {
    expect(moneySchema.parse(50000)).toBe(50000);
    expect(provenanceSchema.parse('estimate')).toBe('estimate');
  });

  it('validates BudgetItem and Constraint schemas', () => {
    const item = budgetItemSchema.parse({
      id: 'bi_1',
      category: 'food',
      label: 'Buffet Lunch',
      basis: 'per_guest',
      unitCost: 1200,
      quantity: 150,
      provenance: 'estimate',
      locked: false,
      note: 'Includes dessert counter',
      rateKey: 'catering_buffet.standard',
    });
    expect(item.id).toBe('bi_1');
    expect(item.rateKey).toBe('catering_buffet.standard');

    const constraint = constraintSchema.parse({
      id: 'c_1',
      kind: 'budget_cap',
      severity: 'hard',
      description: 'Strict budget cap of 15 lakhs',
      numericValue: 1500000,
    });
    expect(constraint.severity).toBe('hard');
  });

  it('validates GuestNeeds aggregate privacy requirements', () => {
    const needs = guestNeedsSchema.parse({
      vegetarian: 80,
      jain: 20,
      vegan: 5,
      glutenFree: 2,
      allergyAlerts: 1,
      wheelchairUsers: 3,
      elderly: 15,
      children: 25,
      quietSpaceNeeded: true,
      languages: ['English', 'Hindi', 'Marathi'],
    });
    expect(needs.jain).toBe(20);
  });

  it('validates Concept and ScheduleSlot schemas', () => {
    const concept = conceptSchema.parse({
      id: 'cp_1',
      title: 'Royal Heritage',
      tagline: 'Timeless elegance and regal traditions',
      summary: 'Grand banquet with traditional decor and classical music',
      palette: ['#800020', '#FFD700', '#FFFFFF', '#1A1A1A'],
      experienceHighlights: [
        'Grand Royal Entrance',
        'Live Sitar Performance',
        'Traditional Thali Feast',
      ],
      estimatedTotal: 850000,
      tradeoffs: ['Higher venue requirement', 'Longer setup time'],
      whyItFits: 'Matches host desire for classical grandeur',
      tags: ['royal', 'traditional'],
    });
    expect(concept.palette).toHaveLength(4);

    const slot = scheduleSlotSchema.parse({
      id: 'sl_1',
      title: 'Welcome Drinks & Arrival',
      startMinute: 1080,
      durationMinutes: 60,
      priority: 'essential',
      flexible: false,
    });
    expect(slot.startMinute).toBe(1080);
  });

  it('validates Task, Vendor, Risk, and DecisionRecord schemas', () => {
    const task = taskSchema.parse({
      id: 'tk_1',
      title: 'Finalize Guest List',
      category: 'planning',
      dueDaysBefore: 14,
      status: 'todo',
      priority: 'high',
    });
    expect(task.status).toBe('todo');

    const quote = vendorQuoteSchema.parse({
      vendorName: 'Apex Catering',
      price: 250000,
      answers: { tastingDone: 'yes' },
    });
    const vendor = vendorNeedSchema.parse({
      id: 'vn_1',
      category: 'food',
      requirements: ['Live chaat counter', 'Jain counter separate'],
      questionsToAsk: ['Are servers included?'],
      quotes: [quote],
      status: 'comparing',
    });
    expect(vendor.quotes).toHaveLength(1);

    const risk = riskSchema.parse({
      id: 'rk_1',
      severity: 'medium',
      title: 'Monsoon Rain Risk',
      explanation: 'Outdoor reception can face sudden showers',
      mitigation: 'Reserve indoor hall on standby',
    });
    expect(risk.severity).toBe('medium');

    const decision = decisionRecordSchema.parse({
      id: 'dec_1',
      timestamp: '2026-10-21T12:00:00Z',
      summary: 'Selected outdoor venue',
      source: 'user',
      status: 'approved',
    });
    expect(decision.id).toBe('dec_1');
  });

  it('validates EventMeta, EventPlan, PlanPatch, and PlanImpact', () => {
    const meta = eventMetaSchema.parse({
      title: 'Aarav & Meera Wedding',
      type: 'wedding',
      city: 'Pune',
      dateIso: '2026-12-15',
      guestCount: 250,
      setting: 'outdoor',
      hostBrief: 'Elegant outdoor wedding celebration with warm lighting',
    });
    expect(meta.guestCount).toBe(250);

    const plan = eventPlanSchema.parse({
      id: 'ep_1',
      version: 1,
      createdAt: '2026-10-21T12:00:00Z',
      updatedAt: '2026-10-21T12:00:00Z',
      meta,
      constraints: [],
      concepts: [],
      selectedConceptId: null,
      budgetItems: [],
      schedule: [],
      tasks: [],
      vendors: [],
      guestNeeds: {
        vegetarian: 50,
        jain: 10,
        vegan: 0,
        glutenFree: 0,
        allergyAlerts: 0,
        wheelchairUsers: 0,
        elderly: 5,
        children: 10,
        quietSpaceNeeded: false,
        languages: ['English'],
      },
      ledger: [],
    });
    expect(plan.id).toBe('ep_1');

    const patch = planPatchSchema.parse({
      id: 'pt_1',
      ops: [
        { type: 'set_guest_count', guestCount: 180 },
        { type: 'set_budget_cap', amount: 500000 },
        { type: 'remove_task', id: 'tk_1' },
      ],
      reason: 'Budget adjustment after guest list revision',
      source: 'user',
      status: 'proposed',
      createdAt: '2026-10-21T12:00:00Z',
    });
    expect(patch.ops).toHaveLength(3);

    const impact = planImpactSchema.parse({
      budgetTotalBefore: 450000,
      budgetTotalAfter: 480000,
      budgetCap: 500000,
      overCap: false,
      changedItems: [{ label: 'Decor', before: 50000, after: 80000 }],
      notes: ['Budget remains within cap'],
    });
    expect(impact.overCap).toBe(false);
  });
});
