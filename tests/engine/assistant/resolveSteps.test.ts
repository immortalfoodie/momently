import { describe, expect, it } from 'vitest';
import { DEMO_SCENARIO } from '@/data/demoScenario';
import type { EventPlan } from '@/domain/types';
import { resolveSteps } from '@/engine/assistant/resolveSteps';
import { describeIntent, findStepClash } from '@/engine/assistant/stepLabels';
import { getBudgetCap } from '@/engine/budget';
import type { EngineContext } from '@/engine/context';
import { createPlan } from '@/engine/planFactory';
import { createIdFactory } from '@/lib/id';
import type { IntentOutput } from '@/llm/schemas/intent';
import { deepFreeze } from '../../helpers/deepFreeze';

const TODAY = '2026-10-21';
const clock = () => new Date('2026-10-21T12:00:00.000Z');
const makeCtx = (): EngineContext => ({ ids: createIdFactory('steps_test'), clock });

function demoPlan(): EventPlan {
  const { plan } = createPlan({
    meta: DEMO_SCENARIO.meta,
    constraints: DEMO_SCENARIO.constraints,
    ids: createIdFactory('steps_plan'),
    clock,
  });
  return { ...plan, concepts: DEMO_SCENARIO.concepts };
}

const UPGRADE: IntentOutput = { kind: 'upgrade', family: 'decor_theme', toQuality: 'premium' };
const RAIN: IntentOutput = { kind: 'simulate', scenario: { type: 'rain' } };

describe('Assistant: compound requests (resolveSteps)', () => {
  it('delegates a single step to the normal resolver', () => {
    const outcome = resolveSteps(demoPlan(), [{ kind: 'find_forgotten' }], makeCtx(), TODAY);
    expect(outcome.kind).toBe('info');
    if (outcome.kind === 'info') expect(outcome.steps).toBeUndefined();
  });

  it('combines two changes into one approvable proposal in order', () => {
    const plan = deepFreeze(demoPlan());
    const outcome = resolveSteps(
      plan,
      [UPGRADE, { kind: 'change_guest_count', guestCount: plan.meta.guestCount + 20 }],
      makeCtx(),
      TODAY,
    );

    expect(outcome.kind).toBe('proposal');
    if (outcome.kind !== 'proposal') return;
    expect(outcome.options).toHaveLength(1);
    expect(outcome.steps?.map((s) => s.status)).toEqual(['planned', 'planned']);
    expect(outcome.steps?.[0]?.label).toBe('Upgrade decor theme to premium');

    const option = outcome.options[0]!;
    expect(option.patch.status).toBe('proposed');
    expect(option.patch.source).toBe('ai');
    const guestOp = option.patch.ops.find((op) => op.type === 'set_guest_count');
    expect(guestOp).toMatchObject({ type: 'set_guest_count', guestCount: plan.meta.guestCount + 20 });
  });

  it('never silently breaks the hard budget cap on the combined result', () => {
    const plan = demoPlan();
    const cap = getBudgetCap(plan.constraints);
    expect(cap).not.toBeNull();

    const outcome = resolveSteps(
      plan,
      [UPGRADE, { kind: 'change_guest_count', guestCount: plan.meta.guestCount + 60 }],
      makeCtx(),
      TODAY,
    );
    if (outcome.kind !== 'proposal') return;
    const option = outcome.options[0]!;
    expect(option.meetsCap).toBe(option.impact.budgetTotalAfter <= (cap ?? Infinity));
    if (!option.meetsCap) expect(option.fundingOptions).toBeDefined();
  });

  it('tests a simulation against the plan after earlier steps, read-only', () => {
    const plan = demoPlan();
    const outcome = resolveSteps(plan, [UPGRADE, RAIN], makeCtx(), TODAY);
    expect(outcome.kind).toBe('proposal');
    if (outcome.kind !== 'proposal') return;
    const [first, second] = outcome.steps ?? [];
    expect(first?.status).toBe('planned');
    expect(second?.status === 'checked' || second?.status === 'skipped').toBe(true);
    expect(second?.label).toMatch(/rain/i);
    expect(outcome.options[0]!.patch.ops.every((op) => op.type !== 'add_slot')).toBe(true);
  });

  it('returns an info summary when no step changes the plan', () => {
    const outcome = resolveSteps(demoPlan(), [{ kind: 'find_forgotten' }, RAIN], makeCtx(), TODAY);
    expect(outcome.kind).toBe('info');
    if (outcome.kind === 'info') expect(outcome.steps).toHaveLength(2);
  });

  it('keeps resolved steps and explains a step it could not do', () => {
    const outcome = resolveSteps(
      demoPlan(),
      [UPGRADE, { kind: 'clarify', question: 'Which vendor did you mean?' }],
      makeCtx(),
      TODAY,
    );
    expect(outcome.kind).toBe('proposal');
    if (outcome.kind !== 'proposal') return;
    expect(outcome.steps?.[1]).toMatchObject({ status: 'skipped', detail: 'Which vendor did you mean?' });
    expect(outcome.message).toMatch(/1 step could not be done/);
  });

  it('asks for clarification when two steps contradict each other', () => {
    const outcome = resolveSteps(
      demoPlan(),
      [
        { kind: 'change_guest_count', guestCount: 100 },
        { kind: 'change_guest_count', guestCount: 120 },
      ],
      makeCtx(),
      TODAY,
    );
    expect(outcome.kind).toBe('clarify');
    if (outcome.kind === 'clarify') {
      expect(outcome.question).toContain('100');
      expect(outcome.question).toContain('120');
    }
  });

  it('flags upgrading and downgrading the same item as a clash', () => {
    expect(
      findStepClash([UPGRADE, { kind: 'downgrade', family: 'decor_theme', toQuality: 'essential' }]),
    ).toMatch(/Which one/);
    expect(findStepClash([UPGRADE, RAIN])).toBeNull();
  });

  it('never mutates the stored plan', () => {
    const plan = deepFreeze(demoPlan());
    expect(() =>
      resolveSteps(plan, [UPGRADE, { kind: 'save_money', amount: 10000 }, RAIN], makeCtx(), TODAY),
    ).not.toThrow();
  });

  it('labels every intent kind in plain English', () => {
    expect(describeIntent({ kind: 'change_budget', amount: 150000, hard: true })).toBe(
      'Set the budget to ₹1,50,000 (hard cap)',
    );
    expect(describeIntent({ kind: 'adjust_category', category: 'decor', percent: -20 })).toBe('Reduce decor by 20%');
    expect(describeIntent(RAIN)).toMatch(/^Test: Rain/);
  });
});
