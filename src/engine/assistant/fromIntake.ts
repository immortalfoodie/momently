import type { Constraint, EventMeta, EventPlan, GuestNeeds } from '@/domain/types';
import type { EngineContext } from '@/engine/context';
import type { FitReport } from '@/engine/planFactory';
import { createPlan } from '@/engine/planFactory';
import { sanitizeUserText } from '@/llm/sanitize';
import type { IntakeOutput, MissingInfoItem } from '@/llm/schemas/intake';

const DEFAULT_GUEST_NEEDS: GuestNeeds = {
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

export interface PlanFromIntakeResult {
  plan: EventPlan;
  fit: FitReport;
  assumptions: string[];
  missingInfo: MissingInfoItem[];
}

/**
 * Builds a foundational EventPlan from structured intake output, recording all assumptions honestly.
 * WHY: Transparently transitions validated LLM briefs into concrete domain entities without silent defaults.
 *
 * @param intake - Validated structured intake data.
 * @param ctx - Injected engine context (ID generator and clock).
 * @param today - Current reference date in YYYY-MM-DD format for validating schedule dates.
 * @param hostBrief - Optional original raw user prompt string to preserve on event meta.
 * @returns Resulting plan, budget fit report, recorded assumptions, and remaining missing info questions.
 */
// eslint-disable-next-line complexity
export function buildPlanFromIntake(
  intake: IntakeOutput,
  ctx: EngineContext,
  today: string,
  hostBrief?: string,
): PlanFromIntakeResult {
  const assumptions: string[] = [];

  // Honest defaults for missing fields
  let guestCount: number;
  if (intake.guestCount === null) {
    guestCount = 50;
    assumptions.push('Guest count not given, assumed 50');
  } else {
    guestCount = intake.guestCount;
  }

  let city: string;
  if (intake.city === null) {
    city = 'Not specified';
    assumptions.push('City not specified, assumed Not specified (tier 2 pricing)');
  } else {
    city = intake.city;
  }

  let setting: 'indoor' | 'outdoor' | 'mixed' | 'undecided';
  if (intake.setting === null) {
    setting = 'undecided';
    assumptions.push('Event setting not specified, assumed undecided');
  } else {
    setting = intake.setting;
  }

  let dateIso: string | undefined;
  if (intake.dateIso) {
    if (intake.dateIso < today) {
      assumptions.push(`Event date ${intake.dateIso} is in the past relative to ${today}, omitted`);
      dateIso = undefined;
    } else {
      dateIso = intake.dateIso;
    }
  }

  const constraints: Constraint[] = [];
  if (intake.budgetCap !== null) {
    constraints.push({
      id: ctx.ids('constraint'),
      kind: 'budget_cap',
      severity: intake.budgetIsHard ? 'hard' : 'soft',
      description: `Budget cap of ₹${intake.budgetCap} (${intake.budgetIsHard ? 'hard limit' : 'flexible target'})`,
      numericValue: intake.budgetCap,
    });
  }

  for (const c of intake.constraints) {
    constraints.push({
      id: ctx.ids('constraint'),
      kind: c.kind,
      severity: c.severity,
      description: c.description,
    });
  }

  const mergedGuestNeeds: GuestNeeds = {
    ...DEFAULT_GUEST_NEEDS,
    ...intake.guestNeeds,
  };

  const brief = hostBrief ? sanitizeUserText(hostBrief, 1000).text : intake.title;

  const meta: EventMeta = {
    title: intake.title,
    type: intake.type,
    city,
    dateIso,
    guestCount,
    setting,
    hostBrief: brief,
  };


  const { plan, fit } = createPlan({
    meta,
    constraints,
    guestNeeds: mergedGuestNeeds,
    ids: ctx.ids,
    clock: ctx.clock,
  });

  return {
    plan,
    fit,
    assumptions,
    missingInfo: intake.missingInfo,
  };
}
