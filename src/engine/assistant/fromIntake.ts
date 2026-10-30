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
 * Returns the provided value, or a default while recording why the default was used.
 * WHY: Every gap in the brief becomes a visible assumption instead of a silent guess.
 */
function withDefault<T>(value: T | null, fallback: T, note: string, assumptions: string[]): T {
  if (value !== null) return value;
  assumptions.push(note);
  return fallback;
}

function resolveDate(dateIso: string | null | undefined, today: string, assumptions: string[]): string | undefined {
  if (!dateIso) return undefined;
  if (dateIso < today) {
    assumptions.push(`Event date ${dateIso} is in the past relative to ${today}, omitted`);
    return undefined;
  }
  return dateIso;
}

function buildConstraints(intake: IntakeOutput, ctx: EngineContext): Constraint[] {
  // The budget cap is created first so constraint IDs keep their original order.
  const cap: Constraint[] =
    intake.budgetCap === null
      ? []
      : [
          {
            id: ctx.ids('constraint'),
            kind: 'budget_cap',
            severity: intake.budgetIsHard ? 'hard' : 'soft',
            description: `Budget cap of ₹${intake.budgetCap} (${intake.budgetIsHard ? 'hard limit' : 'flexible target'})`,
            numericValue: intake.budgetCap,
          },
        ];
  const rest = intake.constraints.map(
    (c): Constraint => ({
      id: ctx.ids('constraint'),
      kind: c.kind,
      severity: c.severity,
      description: c.description,
    }),
  );
  return [...cap, ...rest];
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
export function buildPlanFromIntake(
  intake: IntakeOutput,
  ctx: EngineContext,
  today: string,
  hostBrief?: string,
): PlanFromIntakeResult {
  const assumptions: string[] = [];

  // Honest defaults for missing fields, each recorded as an assumption
  const guestCount = withDefault(intake.guestCount, 50, 'Guest count not given, assumed 50', assumptions);
  const city = withDefault(
    intake.city,
    'Not specified',
    'City not specified, assumed Not specified (tier 2 pricing)',
    assumptions,
  );
  const setting = withDefault(
    intake.setting,
    'undecided',
    'Event setting not specified, assumed undecided',
    assumptions,
  );
  const dateIso = resolveDate(intake.dateIso, today, assumptions);

  const constraints = buildConstraints(intake, ctx);

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
