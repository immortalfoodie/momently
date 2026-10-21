import type { EventPlan } from '@/domain/types';
import { simulateScenario } from '@/engine/chaos';
import { buildOption } from '@/engine/chaos/option';
import type { EngineContext } from '@/engine/context';
import { findForgottenCosts } from '@/engine/forgottenCosts';
import { rebalanceForImpact } from '@/engine/impactRebalance';
import type {
  AnswerIntent,
  ClarifyIntent,
  DeclineIntent,
  SimulateIntent,
} from '@/llm/schemas/intent';
import type { AssistantOutcome } from '../types';

export function resolveFindForgotten(
  plan: EventPlan,
): AssistantOutcome {
  const costs = findForgottenCosts(plan);
  return {
    kind: 'info',
    message:
      'Here are unpriced operational items and hidden requirements recommended for your celebration format:',
    items: costs.map((c) => ({
      title: c.title,
      detail: c.why,
    })),
  };
}

export function resolveMakeItPremium(
  plan: EventPlan,
  ctx: EngineContext,
): AssistantOutcome {
  const rebalance = rebalanceForImpact(plan, ctx);

  if (!rebalance.changed) {
    return {
      kind: 'info',
      message: rebalance.message,
      items: [],
    };
  }

  const opt = buildOption(
    plan,
    rebalance.ops,
    {
      id: 'opt_make_it_premium',
      label: 'Make it premium: visual impact rebalance',
      tradeoff: rebalance.message,
      notes: [
        `Upgrades: ${rebalance.upgraded.join(', ') || 'none'}.`,
        `Downgrades: ${rebalance.downgraded.join(', ') || 'none'}.`,
      ],
    },
    ctx,
    false,
    'user',
  );

  return {
    kind: 'proposal',
    message: rebalance.message,
    options: opt ? [opt] : [],
    notes: [],
  };
}

export function resolveSimulate(
  plan: EventPlan,
  intent: SimulateIntent,
  ctx: EngineContext,
): AssistantOutcome {
  const result = simulateScenario(plan, intent.scenario, ctx);
  return {
    kind: 'chaos',
    result,
  };
}

export function resolveAnswer(intent: AnswerIntent): AssistantOutcome {
  return {
    kind: 'reply',
    text: intent.reply,
  };
}

export function resolveClarify(intent: ClarifyIntent): AssistantOutcome {
  return {
    kind: 'clarify',
    question: intent.question,
  };
}

export function resolveDecline(intent: DeclineIntent): AssistantOutcome {
  return {
    kind: 'reply',
    text: `Request declined: ${intent.reason}`,
  };
}
