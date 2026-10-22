import { describe, expect, it } from 'vitest';
import { DEMO_SCENARIO } from '@/data/demoScenario';
import { createPlan } from '@/engine/planFactory';
import { createIdFactory } from '@/lib/id';
import { summarizePlanForLlm } from '@/llm/context';
import {
  MockProvider,
  mockConcepts,
  mockIntake,
  mockIntent,
  mockNarrate,
} from '@/llm/mock/index';
import {
  conceptsOutputSchema,
  intakeOutputSchema,
  intentOutputSchema,
  narrateOutputSchema,
  type IntentOutput,
} from '@/llm/schemas/index';
import { runTask } from '@/llm/runTask';

describe('Offline Mock LLM Provider (Demo Mode)', () => {
  const fixedClock = () => new Date('2026-10-21T12:00:00.000Z');

  function getTestPlanSummary() {
    const ids = createIdFactory('mock_test_seed');
    const { plan } = createPlan({
      meta: DEMO_SCENARIO.meta,
      constraints: DEMO_SCENARIO.constraints,
      ids,
      clock: fixedClock,
    });
    return summarizePlanForLlm(plan);
  }

  it('maps the milestone demo brief to the exact DEMO_SCENARIO facts', () => {
    const output = mockIntake({
      text: DEMO_SCENARIO.hostBrief,
      today: '2026-10-21',
    });

    expect(() => intakeOutputSchema.parse(output)).not.toThrow();
    expect(output.type).toBe('anniversary');
    expect(output.city).toBe('Mumbai');
    expect(output.guestCount).toBe(80);
    expect(output.budgetCap).toBe(150000);
    expect(output.budgetIsHard).toBe(true);
    expect(output.setting).toBe('undecided');
  });

  it('determines setting as undecided unless explicit outdoor or indoor keywords exist', () => {
    const today = '2026-10-21';
    expect(mockIntake({ text: 'Anniversary in Mumbai for 50 people, lawn venue', today }).setting).toBe('outdoor');
    expect(mockIntake({ text: 'Wedding in Delhi on a terrace with 100 guests', today }).setting).toBe('outdoor');
    expect(mockIntake({ text: 'Birthday celebration in open-air garden in Pune', today }).setting).toBe('outdoor');
    expect(mockIntake({ text: 'Community gathering in society hall in Bangalore', today }).setting).toBe('indoor');
    expect(mockIntake({ text: 'Dinner in hotel banquet with 80 guests', today }).setting).toBe('indoor');
    expect(mockIntake({ text: 'Concert in college auditorium', today }).setting).toBe('indoor');
    expect(mockIntake({ text: 'Intimate celebration with family and friends', today }).setting).toBe('undecided');
  });

  it('maps at least 15 table-driven intent phrases to expected kinds and payloads', () => {
    const planSummary = getTestPlanSummary();

    const testCases: Array<{
      message: string;
      expectedKind: string;
      check: (out: IntentOutput) => boolean;
    }> = [
      { message: 'increase guests from 80 to 110', expectedKind: 'change_guest_count', check: (o) => o.kind === 'change_guest_count' && o.guestCount === 110 },
      { message: '20 more guests', expectedKind: 'change_guest_count', check: (o) => o.kind === 'change_guest_count' && o.guestCount === 100 },
      { message: 'what if it rains', expectedKind: 'simulate', check: (o) => o.kind === 'simulate' && o.scenario.type === 'rain' },
      { message: 'can we fit a live singer into this budget', expectedKind: 'afford_check', check: (o) => o.kind === 'afford_check' && o.family === 'entertainment_music' },
      { message: 'save ₹15,000', expectedKind: 'save_money', check: (o) => o.kind === 'save_money' && o.amount === 15000 },
      { message: 'where can I save', expectedKind: 'answer', check: (o) => o.kind === 'answer' && o.reply.length > 10 },
      { message: 'what am I forgetting', expectedKind: 'find_forgotten', check: (o) => o.kind === 'find_forgotten' },
      { message: 'make it feel expensive', expectedKind: 'make_it_premium', check: (o) => o.kind === 'make_it_premium' },
      { message: 'upgrade the decor but keep the budget fixed', expectedKind: 'upgrade', check: (o) => o.kind === 'upgrade' && o.family === 'decor_theme' && o.toQuality === 'premium' },
      { message: 'combine decorations from option 2 with the atmosphere of option 1 but make it 20% cheaper', expectedKind: 'combine_concepts', check: (o) => o.kind === 'combine_concepts' && o.baseRef === '1' && o.borrowRef === '2' && o.percentCheaper === 20 },
      { message: 'pick option 2', expectedKind: 'select_concept', check: (o) => o.kind === 'select_concept' && o.conceptRef === '2' },
      { message: 'budget drops by 20%', expectedKind: 'simulate', check: (o) => o.kind === 'simulate' && o.scenario.type === 'budget_cut' && o.scenario.percent === 20 },
      { message: 'the photographer cancelled', expectedKind: 'simulate', check: (o) => o.kind === 'simulate' && o.scenario.type === 'vendor_cancels' && o.scenario.category === 'photography' },
      { message: 'event starts two hours late', expectedKind: 'simulate', check: (o) => o.kind === 'simulate' && o.scenario.type === 'late_start' && o.scenario.delayMinutes === 120 },
      { message: 'the cake is unavailable', expectedKind: 'simulate', check: (o) => o.kind === 'simulate' && o.scenario.type === 'item_unavailable' },
      { message: 'must be wheelchair accessible', expectedKind: 'add_preference', check: (o) => o.kind === 'add_preference' && o.preferenceKind === 'accessibility' && o.severity === 'hard' },
      { message: 'my cousin is Jain', expectedKind: 'add_preference', check: (o) => o.kind === 'add_preference' && o.preferenceKind === 'dietary' && o.severity === 'hard' },
    ];

    expect(testCases.length).toBeGreaterThanOrEqual(15);

    for (const tc of testCases) {
      const output = mockIntent({
        message: tc.message,
        planSummary,
        recentMessages: [],
      });

      expect(() => intentOutputSchema.parse(output)).not.toThrow();
      expect(output.kind).toBe(tc.expectedKind);
      expect(tc.check(output)).toBe(true);
    }
  });

  it('returns valid concepts with qualityProfile for demo brief', () => {
    const planSummary = getTestPlanSummary();
    const brief = mockIntake({
      text: DEMO_SCENARIO.hostBrief,
      today: '2026-10-21',
    });

    const output = mockConcepts({ brief, planSummary });
    expect(() => conceptsOutputSchema.parse(output)).not.toThrow();
    expect(output.concepts).toHaveLength(3);

    for (const concept of output.concepts) {
      expect(concept.qualityProfile).toBeDefined();
      expect(Object.keys(concept.qualityProfile).length).toBeGreaterThan(0);
    }
  });

  it('synthesizes valid narrative summaries with highlights across all purposes', () => {
    const purposes = [
      'chat_reply',
      'chaos_summary',
      'budget_explainer',
      'change_summary',
    ] as const;

    for (const purpose of purposes) {
      const output = mockNarrate({
        purpose,
        facts: {
          title: "Parents' 25th Anniversary",
          total: 145000,
          remaining: 5000,
          scenario: 'monsoon rain',
          score: 85,
        },
      });

      expect(() => narrateOutputSchema.parse(output)).not.toThrow();
      expect(output.text.length).toBeGreaterThan(0);
      expect(output.highlights.length).toBeGreaterThan(0);
      expect(output.highlights.length).toBeLessThanOrEqual(4);
    }
  });

  it('runs MockProvider through runTask end-to-end deterministically', async () => {
    const provider = new MockProvider();
    const planSummary = getTestPlanSummary();

    const res1 = await runTask({
      provider,
      task: 'intent',
      input: {
        message: '20 more guests',
        planSummary,
        recentMessages: [],
      },
    });

    const res2 = await runTask({
      provider,
      task: 'intent',
      input: {
        message: '20 more guests',
        planSummary,
        recentMessages: [],
      },
    });

    expect(res1.ok).toBe(true);
    expect(res2.ok).toBe(true);
    if (res1.ok && res2.ok) {
      expect(res1.value).toEqual(res2.value);
    }
  });
});
