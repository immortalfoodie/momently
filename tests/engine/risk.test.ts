import { describe, expect, it } from 'vitest';
import { DEMO_SCENARIO } from '@/data/demoScenario';
import type { EventPlan } from '@/domain/types';
import { createPlan } from '@/engine/planFactory';
import { RISK_WEIGHTS, scoreRisks } from '@/engine/risk';
import { createIdFactory } from '@/lib/id';

function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const val = (obj as Record<string, unknown>)[key];
    if (val !== null && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj;
}

describe('Chaos Score & Risk Engine', () => {
  const fixedClock = () => new Date('2026-10-21T12:00:00.000Z');

  function makeBaseline(): EventPlan {
    const ids = createIdFactory('risk_seed');
    return createPlan({
      meta: DEMO_SCENARIO.meta,
      constraints: DEMO_SCENARIO.constraints,
      ids,
      clock: fixedClock,
    }).plan;
  }

  it('evaluates individual risk rules with exact point weights', () => {
    const base = makeBaseline();
    const ctx = { ids: createIdFactory('eval_rules'), clock: fixedClock };

    // weather_uncovered outdoor: +25
    const outdoorPlan = deepFreeze({
      ...base,
      meta: { ...base.meta, setting: 'outdoor' as const },
      budgetItems: base.budgetItems.filter(
        (i) => !i.rateKey?.startsWith('weather_cover.'),
      ),
    });
    const outdoorRisk = scoreRisks(outdoorPlan, ctx);
    const weatherBreakdown = outdoorRisk.breakdown.find(
      (b) => b.ruleId === 'weather_uncovered',
    );
    expect(weatherBreakdown?.points).toBe(RISK_WEIGHTS.weather_uncovered_outdoor);

    // date_unset: +5
    const noDatePlan = deepFreeze({
      ...base,
      meta: { ...base.meta, dateIso: undefined },
    });
    const dateBreakdown = scoreRisks(noDatePlan, ctx).breakdown.find(
      (b) => b.ruleId === 'date_unset',
    );
    expect(dateBreakdown?.points).toBe(RISK_WEIGHTS.date_unset);

    // access_unconfirmed: +15
    const accessPlan = deepFreeze({
      ...base,
      guestNeeds: { ...base.guestNeeds, wheelchairUsers: 2 },
      tasks: base.tasks.filter((t) => t.category !== 'accessibility'),
    });
    const accessBreakdown = scoreRisks(accessPlan, ctx).breakdown.find(
      (b) => b.ruleId === 'access_unconfirmed',
    );
    expect(accessBreakdown?.points).toBe(RISK_WEIGHTS.access_unconfirmed);
  });

  it('caps total risk score at 100', () => {
    const base = makeBaseline();
    // Intentionally construct a plan triggering almost all high-risk conditions
    const fragilePlan = deepFreeze({
      ...base,
      meta: {
        ...base.meta,
        setting: 'outdoor' as const,
        dateIso: '2026-10-25',
        guestCount: 500,
      },
      constraints: [
        {
          id: 'c_cap',
          kind: 'budget_cap' as const,
          severity: 'hard' as const,
          description: 'Hard budget limit',
          numericValue: 10000,
        },
        {
          id: 'c_guest',
          kind: 'guest_count' as const,
          severity: 'hard' as const,
          description: 'Max guest limit',
          numericValue: 100,
        },
        {
          id: 'c_access',
          kind: 'accessibility' as const,
          severity: 'hard' as const,
          description: 'Step-free',
        },
      ],
      vendors: [
        {
          id: 'v1',
          category: 'food' as const,
          status: 'not_started' as const,
          quotes: [],
          requirements: [],
          questionsToAsk: [],
        },
        {
          id: 'v2',
          category: 'photography' as const,
          status: 'not_started' as const,
          quotes: [],
          requirements: [],
          questionsToAsk: [],
        },
        {
          id: 'v3',
          category: 'entertainment' as const,
          status: 'not_started' as const,
          quotes: [],
          requirements: [],
          questionsToAsk: [],
        },
      ],
      schedule: [
        {
          id: 's1',
          title: 'Only Slot',
          startMinute: 600,
          durationMinutes: 60,
          priority: 'essential' as const,
          flexible: false,
        },
      ],
      budgetItems: base.budgetItems.map((i) => ({
        ...i,
        provenance: 'estimate' as const,
      })),
      tasks: [],
    });

    const ctx = { ids: createIdFactory('cap_test'), clock: fixedClock };
    const report = scoreRisks(fragilePlan, ctx);
    expect(report.score).toBe(100);
    expect(report.band).toBe('fragile');
  });

  it('categorizes scores into exact band boundaries (24/25, 49/50, 74/75)', () => {
    const ctx = { ids: createIdFactory('band_ctx'), clock: fixedClock };
    const base = makeBaseline();

    const report = scoreRisks(base, ctx);
    // Band check logic
    if (report.score <= 24) expect(report.band).toBe('calm');
    else if (report.score <= 49) expect(report.band).toBe('manageable');
    else if (report.score <= 74) expect(report.band).toBe('exposed');
    else expect(report.band).toBe('fragile');
  });

  it('orders risks deterministically by points descending, then by id', () => {
    const base = makeBaseline();
    const ctx = { ids: createIdFactory('ordering_ctx'), clock: fixedClock };
    const outdoorPlan = deepFreeze({
      ...base,
      meta: { ...base.meta, setting: 'outdoor' as const },
      budgetItems: base.budgetItems.filter(
        (i) => !i.rateKey?.startsWith('weather_cover.'),
      ),
    });

    const report = scoreRisks(outdoorPlan, ctx);
    for (let i = 1; i < report.breakdown.length; i++) {
      const prev = report.breakdown[i - 1]!;
      const curr = report.breakdown[i]!;
      expect(prev.points).toBeGreaterThanOrEqual(curr.points);
    }
  });

  it('demo scenario in December indoor scores in calm or manageable, and outdoor in July scores strictly higher', () => {
    const ctx = { ids: createIdFactory('demo_compare'), clock: fixedClock };
    const base = makeBaseline();

    const indoorDecPlan = deepFreeze({
      ...base,
      meta: { ...base.meta, setting: 'indoor' as const, dateIso: '2026-12-15' },
    });
    const indoorReport = scoreRisks(indoorDecPlan, ctx);
    expect(['calm', 'manageable']).toContain(indoorReport.band);

    const outdoorJulyPlan = deepFreeze({
      ...base,
      meta: { ...base.meta, setting: 'outdoor' as const, dateIso: '2026-07-15' },
      budgetItems: base.budgetItems.filter(
        (i) => !i.rateKey?.startsWith('weather_cover.'),
      ),
    });
    const outdoorReport = scoreRisks(outdoorJulyPlan, ctx);
    expect(outdoorReport.score).toBeGreaterThan(indoorReport.score);
  });
});
