import { describe, expect, it } from 'vitest';
import { DEMO_SCENARIO } from '@/data/demoScenario';
import type { EventPlan } from '@/domain/types';
import { guestInsights, insightTaskOps } from '@/engine/guestInsights';
import { createPlan } from '@/engine/planFactory';
import { createIdFactory } from '@/lib/id';

describe('Engine: Guest Insights and Actionable Tasks', () => {
  const ids = createIdFactory('insight_unit_test');
  const clock = () => new Date('2026-10-21T12:00:00.000Z');
  const engineContext = { ids, clock };

  function makeBasePlan(): EventPlan {
    const { plan } = createPlan({
      meta: DEMO_SCENARIO.meta,
      constraints: DEMO_SCENARIO.constraints,
      ids,
      clock,
    });
    return plan;
  }

  it('generates insights according to demographic needs without assuming culture or pricing', () => {
    const plan: EventPlan = {
      ...makeBasePlan(),
      guestNeeds: {
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
      },
    };

    const insights = guestInsights(plan);
    const resultIds = insights.map((i) => i.id);

    expect(resultIds).toContain('insight_accessibility');
    expect(resultIds).toContain('insight_elderly');
    expect(resultIds).toContain('insight_children');
    expect(resultIds).toContain('insight_jain');
    expect(resultIds).toContain('insight_vegan');
    expect(resultIds).toContain('insight_gluten_free');
    expect(resultIds).toContain('insight_allergies');
    expect(resultIds).toContain('insight_quiet_space');
    expect(resultIds).toContain('insight_languages');

    for (const ins of insights) {
      expect(ins.detail).not.toMatch(/₹|\brupees\b|\bcost\b|\bprice\b/i);
    }
  });

  it('insightTaskOps returns add_task op and is idempotent when task is already present', () => {
    const plan = makeBasePlan();
    const insight = guestInsights({
      ...plan,
      guestNeeds: { ...plan.guestNeeds, elderly: 5 },
    }).find((i) => i.id === 'insight_elderly')!;

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
