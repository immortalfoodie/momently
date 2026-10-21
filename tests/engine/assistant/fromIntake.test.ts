import { describe, expect, it } from 'vitest';
import { DEMO_SCENARIO } from '@/data/demoScenario';
import { buildPlanFromIntake } from '@/engine/assistant/fromIntake';
import type { EngineContext } from '@/engine/context';
import { createIdFactory } from '@/lib/id';
import type { IntakeOutput } from '@/llm/schemas/intake';

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

describe('Assistant: buildPlanFromIntake', () => {
  const fixedClock = () => new Date('2026-10-21T12:00:00.000Z');
  const makeCtx = (): EngineContext => ({
    ids: createIdFactory('intake_test'),
    clock: fixedClock,
  });

  const demoIntakeOutput: IntakeOutput = {
    title: DEMO_SCENARIO.meta.title,
    type: 'anniversary',
    city: 'Mumbai',
    dateIso: '2026-12-15',
    guestCount: 80,
    setting: 'indoor',
    budgetCap: 150000,
    budgetIsHard: true,
    constraints: [
      { kind: 'must_have', description: 'Retro Bollywood playlist', severity: 'hard' },
      { kind: 'dietary', description: 'Dedicated Jain food counter', severity: 'hard' },
    ],
    guestNeeds: { vegetarian: 30, jain: 8 },
    styleTags: ['vintage', 'bollywood'],
    missingInfo: [],
  };

  it('builds a viable, fitting plan from benchmark demo brief', () => {
    const ctx = makeCtx();
    const frozenInput = deepFreeze(demoIntakeOutput);

    const { plan, fit, assumptions, missingInfo } = buildPlanFromIntake(
      frozenInput,
      ctx,
      '2026-10-21',
    );

    expect(fit.fits).toBe(true);
    expect(plan.meta.guestCount).toBe(80);
    expect(plan.meta.city).toBe('Mumbai');
    expect(plan.meta.setting).toBe('indoor');
    expect(plan.meta.dateIso).toBe('2026-12-15');
    expect(assumptions).toHaveLength(0);
    expect(missingInfo).toHaveLength(0);

    const capConstraint = plan.constraints.find((c) => c.kind === 'budget_cap');
    expect(capConstraint).toBeDefined();
    expect(capConstraint?.severity).toBe('hard');
    expect(capConstraint?.numericValue).toBe(150000);
  });

  it('produces honest assumptions when optional fields are missing', () => {
    const ctx = makeCtx();
    const minimalBrief: IntakeOutput = {
      title: 'Community Gathering',
      type: 'community',
      city: null,
      dateIso: null,
      guestCount: null,
      setting: null,
      budgetCap: null,
      budgetIsHard: false,
      constraints: [],
      guestNeeds: {},
      styleTags: [],
      missingInfo: [{ field: 'city', question: 'Which city will the event be hosted in?' }],
    };

    const { plan, assumptions, missingInfo } = buildPlanFromIntake(
      deepFreeze(minimalBrief),
      ctx,
      '2026-10-21',
    );

    expect(plan.meta.guestCount).toBe(50);
    expect(plan.meta.city).toBe('Not specified');
    expect(plan.meta.setting).toBe('undecided');
    expect(plan.meta.dateIso).toBeUndefined();

    expect(assumptions).toContain('Guest count not given, assumed 50');
    expect(assumptions).toContain('City not specified, assumed Not specified (tier 2 pricing)');
    expect(assumptions).toContain('Event setting not specified, assumed undecided');
    expect(missingInfo).toHaveLength(1);
  });

  it('drops past dates relative to reference date and records an assumption', () => {
    const ctx = makeCtx();
    const pastBrief: IntakeOutput = {
      ...demoIntakeOutput,
      dateIso: '2025-01-01',
    };

    const { plan, assumptions } = buildPlanFromIntake(
      deepFreeze(pastBrief),
      ctx,
      '2026-10-21',
    );

    expect(plan.meta.dateIso).toBeUndefined();
    expect(
      assumptions.some((a) => a.includes('past relative to 2026-10-21, omitted')),
    ).toBe(true);
  });

  it('rejects an absurdly low budget cap with fit.fits false and never silently overspends', () => {
    const ctx = makeCtx();
    const impossibleBrief: IntakeOutput = {
      ...demoIntakeOutput,
      budgetCap: 5000,
      budgetIsHard: true,
    };

    const { fit } = buildPlanFromIntake(
      deepFreeze(impossibleBrief),
      ctx,
      '2026-10-21',
    );

    expect(fit.fits).toBe(false);
    expect(fit.total).toBeGreaterThan(5000);
  });

  it('accepts optional user hostBrief and sanitizes it to 1000 chars', () => {
    const ctx = makeCtx();
    const rawBrief = 'Celebrating 25 years with vintage music!\u0000\u0007' + 'A'.repeat(1200);

    const { plan } = buildPlanFromIntake(
      deepFreeze(demoIntakeOutput),
      ctx,
      '2026-10-21',
      rawBrief,
    );

    expect(plan.meta.hostBrief).toBeDefined();
    expect(plan.meta.hostBrief.length).toBe(1000);
    expect(plan.meta.hostBrief).not.toContain('\u0000');
    expect(plan.meta.hostBrief.startsWith('Celebrating 25 years with vintage music!')).toBe(true);
  });
});

