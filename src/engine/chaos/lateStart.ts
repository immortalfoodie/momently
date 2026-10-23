import type { LateStartScenarioInput } from '@/domain/chaosSchemas';
import type { EventPlan } from '@/domain/types';
import type { EngineContext } from '@/engine/context';
import { buildDelayOptions } from '@/engine/delayOptions';
import { scoreRisks } from '@/engine/risk';
import type { ScenarioResult } from './types';

/**
 * Simulates the late_start chaos scenario by delegating to shared buildDelayOptions.
 * WHY: Shares deterministic delay triage between Chaos Lab and the host Timeline.
 */
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

  const options = buildDelayOptions(
    plan,
    {
      anchorSlotId: anchor.id,
      delayMinutes: input.delayMinutes,
      endLimitMinute: input.endLimitMinute,
    },
    ctx,
  );

  const recommendedOptionId = options[0]?.id;

  return {
    input,
    applicable: options.length > 0,
    headline: `Timeline delayed by ${input.delayMinutes} minutes`,
    summary: `Evaluate cascade, slot-compression, and milestone-swapping options to manage the ${input.delayMinutes}-minute delay.`,
    options,
    recommendedOptionId,
    scoreBefore,
  };
}
