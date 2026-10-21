import type { LateStartScenarioInput } from '@/domain/chaosSchemas';
import type { EventPlan } from '@/domain/types';
import type { EngineContext } from '@/engine/context';
import { scoreRisks } from '@/engine/risk';
import { proposeDelayOptions } from '@/engine/scheduleDelay';
import { buildOption } from './option';
import type { RecoveryOption, ScenarioResult } from './types';

export function simulateLateStart(
  plan: EventPlan,
  input: LateStartScenarioInput,
  ctx: EngineContext,
): ScenarioResult {
  const scoreBefore = scoreRisks(plan, ctx).score;

  if (plan.schedule.length === 0) {
    return {
      input,
      applicable: false,
      headline: 'No schedule slots exist in event plan to delay',
      summary: 'Please populate event schedule slots before simulating timeline delays.',
      options: [],
      scoreBefore,
    };
  }

  const sorted = [...plan.schedule].sort((a, b) => a.startMinute - b.startMinute);
  const anchor = sorted[0];
  if (!anchor) {
    return {
      input,
      applicable: false,
      headline: 'Anchor slot could not be identified',
      summary: 'Schedule contains no accessible milestone slots.',
      options: [],
      scoreBefore,
    };
  }

  const outcomes = proposeDelayOptions(plan.schedule, {
    anchorSlotId: anchor.id,
    delayMinutes: input.delayMinutes,
    endLimitMinute: input.endLimitMinute,
  });

  const options: RecoveryOption[] = [];

  for (const outcome of outcomes) {
    const notes: string[] = [outcome.summary];
    if (outcome.overflowMinutes > 0) {
      notes.push(
        `Overtime of ${outcome.overflowMinutes} minutes: confirm overtime rates with venue, caterer, photographer and DJ.`,
      );
    }

    const opt = buildOption(
      plan,
      outcome.ops,
      {
        id: `opt_delay_${outcome.strategy}`,
        label: `${outcome.strategy.toUpperCase()}: ${outcome.strategy === 'cascade' ? 'Shift schedule later' : outcome.strategy === 'absorb' ? 'Absorb via slot reductions' : 'Swap flexible slots'}`,
        tradeoff: outcome.summary,
        notes,
      },
      ctx,
    );
    if (opt) options.push(opt);
  }

  return {
    input,
    applicable: options.length > 0,
    headline: `Timeline delayed by ${input.delayMinutes} minutes`,
    summary: `Evaluate cascade, slot-compression, and milestone-swapping options to manage the ${input.delayMinutes}-minute delay.`,
    options,
    scoreBefore,
  };
}
