import { describe, expect, it } from 'vitest';
import { DEMO_SCENARIO } from '@/data/demoScenario';
import type { EventPlan, GuestNeeds } from '@/domain/types';
import { guestInsights, insightTaskOps } from '@/engine/guestInsights';
import { createPlan } from '@/engine/planFactory';
import { createIdFactory } from '@/lib/id';

describe('Engine: Guest Insights and Actionable Tasks', () => {
  const ids = createIdFactory('insight_unit_test');
  const clock = () => new Date('2026-10-21T12:00:00.000Z');
  const engineContext = { ids, clock };

  const emptyNeeds: GuestNeeds = {
    vegetarian: 0,
    jain: 0,
    vegan: 0,
    glutenFree: 0,
    allergyAlerts: 0,
    wheelchairUsers: 0,
    elderly: 0,
    children: 0,
    quietSpaceNeeded: false,
    languages: [],
  };

  function makePlanWithNeeds(overrides: Partial<GuestNeeds>, accessVerified = false): EventPlan {
    const { plan } = createPlan({
      meta: DEMO_SCENARIO.meta,
      constraints: DEMO_SCENARIO.constraints,
      ids,
      clock,
    });
    return {
      ...plan,
      tasks: accessVerified
        ? [
            ...plan.tasks,
            {
              id: 't_access_ok',
              title: 'Verify step-free route',
              category: 'accessibility',
              dueDaysBefore: 60,
              status: 'done',
              priority: 'high',
            },
          ]
        : plan.tasks,
      guestNeeds: { ...emptyNeeds, ...overrides },
    };
  }

  it('rule: wheelchairUsers fires when > 0 and access unconfirmed, silent when 0 or confirmed', () => {
    expect(guestInsights(makePlanWithNeeds({ wheelchairUsers: 0 }))).toEqual([]);
    expect(guestInsights(makePlanWithNeeds({ wheelchairUsers: 2 }, true))).toEqual([]);
    const active = guestInsights(makePlanWithNeeds({ wheelchairUsers: 2 }, false));
    expect(active.map((i) => i.id)).toEqual(['insight_accessibility']);
  });

  it('rule: elderly fires when > 0 and is silent when 0', () => {
    expect(guestInsights(makePlanWithNeeds({ elderly: 0 }))).toEqual([]);
    const active = guestInsights(makePlanWithNeeds({ elderly: 4 }));
    expect(active.map((i) => i.id)).toEqual(['insight_elderly']);
  });

  it('rule: children fires when > 0 and is silent when 0', () => {
    expect(guestInsights(makePlanWithNeeds({ children: 0 }))).toEqual([]);
    const active = guestInsights(makePlanWithNeeds({ children: 6 }));
    expect(active.map((i) => i.id)).toEqual(['insight_children']);
  });

  it('rule: jain fires when > 0 and is silent when 0', () => {
    expect(guestInsights(makePlanWithNeeds({ jain: 0 }))).toEqual([]);
    const active = guestInsights(makePlanWithNeeds({ jain: 10 }));
    expect(active.map((i) => i.id)).toEqual(['insight_jain']);
  });

  it('rule: vegan fires when > 0 and is silent when 0', () => {
    expect(guestInsights(makePlanWithNeeds({ vegan: 0 }))).toEqual([]);
    const active = guestInsights(makePlanWithNeeds({ vegan: 3 }));
    expect(active.map((i) => i.id)).toEqual(['insight_vegan']);
  });

  it('rule: glutenFree fires when > 0 and is silent when 0', () => {
    expect(guestInsights(makePlanWithNeeds({ glutenFree: 0 }))).toEqual([]);
    const active = guestInsights(makePlanWithNeeds({ glutenFree: 2 }));
    expect(active.map((i) => i.id)).toEqual(['insight_gluten_free']);
  });

  it('rule: allergyAlerts fires when > 0 and is silent when 0', () => {
    expect(guestInsights(makePlanWithNeeds({ allergyAlerts: 0 }))).toEqual([]);
    const active = guestInsights(makePlanWithNeeds({ allergyAlerts: 1 }));
    expect(active.map((i) => i.id)).toEqual(['insight_allergies']);
  });

  it('rule: quietSpaceNeeded fires when true and is silent when false', () => {
    expect(guestInsights(makePlanWithNeeds({ quietSpaceNeeded: false }))).toEqual([]);
    const active = guestInsights(makePlanWithNeeds({ quietSpaceNeeded: true }));
    expect(active.map((i) => i.id)).toEqual(['insight_quiet_space']);
  });

  it('rule: multiple languages fires when languages.length > 1 and is silent for 0 or 1', () => {
    expect(guestInsights(makePlanWithNeeds({ languages: [] }))).toEqual([]);
    expect(guestInsights(makePlanWithNeeds({ languages: ['English'] }))).toEqual([]);
    const active = guestInsights(makePlanWithNeeds({ languages: ['English', 'Marathi'] }));
    expect(active.map((i) => i.id)).toEqual(['insight_languages']);
    expect(active[0]?.detail).toContain('English & Marathi');
  });

  it('no insight text mentions prices or assumes a religion or culture beyond what the counts say', () => {
    const plan = makePlanWithNeeds({
      vegetarian: 20,
      jain: 10,
      vegan: 5,
      glutenFree: 4,
      allergyAlerts: 2,
      wheelchairUsers: 3,
      elderly: 8,
      children: 12,
      quietSpaceNeeded: true,
      languages: ['English', 'Marathi'],
    });

    const insights = guestInsights(plan);
    expect(insights).toHaveLength(9);

    for (const ins of insights) {
      const combined = `${ins.title} ${ins.detail} ${ins.task?.title ?? ''}`;
      expect(combined).not.toMatch(/₹|\brupees\b|\binr\b|\bcost\b|\bprice\b|\bfee\b/i);
      expect(combined).not.toMatch(
        /\bhindu\b|\bmuslim\b|\bchristian\b|\bsikh\b|\bbuddhist\b|\btemple\b|\bchurch\b|\bmosque\b|\bhalal\b|\bkosher\b/i,
      );
      if (ins.id !== 'insight_jain') {
        expect(combined).not.toMatch(/\bjain\b/i);
      }
    }
  });

  it('insightTaskOps returns add_task op and is idempotent when task is already present', () => {
    const plan = makePlanWithNeeds({ elderly: 5 });
    const insight = guestInsights(plan).find((i) => i.id === 'insight_elderly')!;

    const op = insightTaskOps(plan, insight, engineContext);
    expect(op).toBeDefined();
    expect(op?.type).toBe('add_task');

    if (op && op.type === 'add_task') {
      const planWithTask: EventPlan = {
        ...plan,
        tasks: [...plan.tasks, op.task],
      };
      const op2 = insightTaskOps(planWithTask, insight, engineContext);
      expect(op2).toBeUndefined();
    }
  });
});
