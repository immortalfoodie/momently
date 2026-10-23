import type { EventPlan } from '@/domain/types';
import { buildOption } from './chaos/option';
import type { RecoveryOption } from './chaos/types';
import type { EngineContext } from './context';
import { proposeDelayOptions } from './scheduleDelay';
import type { ScheduleDelayInput } from './scheduleDelayTypes';

const STRATEGY_LABELS: Record<string, string> = {
  cascade: 'Push everything back',
  absorb: 'Squeeze to finish on time',
  swap: 'Swap two activities',
};

/**
 * Builds host recovery options for timeline delays, sharing strategy logic with Chaos Lab.
 * WHY: Provides consistent, deterministic delay triage across Timeline and Chaos simulations.
 *
 * @param plan - Current EventPlan.
 * @param input - Delay parameters containing anchorSlotId and delayMinutes.
 * @param ctx - Engine context for deterministic patch and ID generation.
 * @returns Array of RecoveryOption sorted with feasible and least-disruptive options first.
 */
export function buildDelayOptions(
  plan: EventPlan,
  input: Pick<ScheduleDelayInput, 'anchorSlotId' | 'delayMinutes'> & { endLimitMinute?: number },
  ctx: EngineContext,
): RecoveryOption[] {
  if (plan.schedule.length === 0) return [];

  const outcomes = proposeDelayOptions(plan.schedule, {
    anchorSlotId: input.anchorSlotId,
    delayMinutes: input.delayMinutes,
    endLimitMinute: input.endLimitMinute,
  });

  const options: RecoveryOption[] = [];

  for (const outcome of outcomes) {
    const notes: string[] = [outcome.summary];

    if (outcome.overflowMinutes > 0) {
      notes.push(
        `Overtime of ${outcome.overflowMinutes} minutes: confirm overtime rates with the venue, caterer, photographer and DJ; no prices are assumed`,
      );
    }

    if (!outcome.feasible) {
      notes.push(
        `Infeasible: overruns timeline limit by ${outcome.overflowMinutes} minutes`,
      );
    }

    const label = STRATEGY_LABELS[outcome.strategy] ?? outcome.strategy;

    const opt = buildOption(
      plan,
      outcome.ops,
      {
        id: `opt_delay_${outcome.strategy}`,
        label,
        tradeoff: outcome.summary,
        notes,
      },
      ctx,
      false,
      'user',
    );

    if (opt) {
      options.push(opt);
    }
  }

  return options;
}
