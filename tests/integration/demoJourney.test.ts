import { beforeEach, describe, expect, it } from 'vitest';
import { DEMO_TOUR } from '@/data/demoTour';
import { eventPlanSchema } from '@/domain/schemas';
import type { EventPlan } from '@/domain/types';
import type { AssistantOutcome } from '@/engine/assistant/types';
import { budgetTotal, getBudgetCap } from '@/engine/budget';
import type { RecoveryOption } from '@/engine/chaos/types';
import type { EngineContext } from '@/engine/context';
import { buildDemoPlan } from '@/engine/demo';
import { scoreRisks } from '@/engine/risk';
import type { MessageResponse } from '@/lib/contracts';
import { createIdFactory } from '@/lib/id';
import { MockProvider } from '@/llm/mock';
import { createDeps } from '@/server/deps';
import { handleMessage } from '@/server/handlers/message';
import { useEventsStore } from '@/store/eventsStore';

const HARD_CAP = 150_000;

function isRaiseCapOption(opt: RecoveryOption): boolean {
  return (
    opt.id.includes('raise') ||
    opt.patch.ops.some((op) => op.type === 'set_budget_cap')
  );
}

function getOutcomeOptions(outcome: AssistantOutcome): {
  options: RecoveryOption[];
  recommendedId?: string;
} {
  if (outcome.kind === 'proposal') {
    return { options: outcome.options, recommendedId: outcome.recommendedOptionId };
  }
  if (outcome.kind === 'conflict') {
    return { options: outcome.options };
  }
  if (outcome.kind === 'chaos') {
    return {
      options: outcome.result.options,
      recommendedId: outcome.result.recommendedOptionId,
    };
  }
  return { options: [] };
}

function selectOptionForApproval(outcome: AssistantOutcome): RecoveryOption {
  const { options, recommendedId } = getOutcomeOptions(outcome);
  const nonRaiseOptions = options.filter((o) => !isRaiseCapOption(o));
  const rec = nonRaiseOptions.find((o) => o.id === recommendedId && o.meetsCap);
  if (rec) return rec;
  const firstViable = nonRaiseOptions.find((o) => o.meetsCap);
  if (firstViable) return firstViable;
  throw new Error(`No cap-compliant non-raise option found in outcome: ${outcome.kind}`);
}

function isDecorFundingTouch(planBefore: EventPlan, opt: RecoveryOption): boolean {
  return opt.patch.ops.some((op) => {
    if (op.type === 'remove_budget_item') {
      const target = planBefore.budgetItems.find((i) => i.id === op.id);
      return Boolean(target?.rateKey?.startsWith('decor_theme.'));
    }
    if (op.type === 'update_budget_item' && typeof op.changes.rateKey === 'string') {
      return (
        op.changes.rateKey.startsWith('decor_theme.') &&
        op.changes.rateKey !== 'decor_theme.premium'
      );
    }
    return false;
  });
}

function assertPreApprovalOutcome(
  stepId: string,
  planBefore: EventPlan,
  outcome: AssistantOutcome,
) {
  if (stepId === 'step_3_upgrade_decor') {
    expect(outcome.kind).toBe('proposal');
    if (outcome.kind === 'proposal') {
      for (const opt of outcome.options) {
        expect(isDecorFundingTouch(planBefore, opt)).toBe(false);
      }
    }
  }

  if (stepId === 'step_5_rain_contingency') {
    expect(outcome.kind).toBe('chaos');
    if (outcome.kind === 'chaos') {
      expect(outcome.result.options.length).toBeGreaterThanOrEqual(2);
      const recOption = outcome.result.options.find(
        (o) => o.id === outcome.result.recommendedOptionId,
      );
      expect(recOption).toBeDefined();
      if (recOption) {
        expect(recOption.scoreAfter).toBeLessThan(recOption.scoreBefore);
      }
    }
  }
}

function lockPhotoVideoItem(eventId: string, planAfter: EventPlan) {
  const photoItem = planAfter.budgetItems.find((i) => i.rateKey?.startsWith('photo_video.'));
  if (!photoItem) return;
  useEventsStore.setState((state) => {
    const rec = state.events[eventId];
    if (!rec) return state;
    return {
      events: {
        ...state.events,
        [eventId]: {
          ...rec,
          plan: {
            ...rec.plan,
            budgetItems: rec.plan.budgetItems.map((bi) =>
              bi.id === photoItem.id ? { ...bi, locked: true } : bi,
            ),
          },
        },
      },
    };
  });
}

function assertPostApprovalStep(
  stepId: string,
  eventId: string,
  planAfter: EventPlan,
  scoreBeforeStep: number,
  ctx: EngineContext,
) {
  if (stepId === 'step_2_select_concept') {
    expect(planAfter.selectedConceptId).toBe(planAfter.concepts[0]?.id);
    lockPhotoVideoItem(eventId, planAfter);
  }
  if (stepId === 'step_4_increase_guests') {
    expect(planAfter.meta.guestCount).toBe(110);
    expect(budgetTotal(planAfter.budgetItems, planAfter.meta.guestCount)).toBeLessThanOrEqual(
      HARD_CAP,
    );
  }
  if (stepId === 'step_5_rain_contingency') {
    const scoreAfterStep = scoreRisks(planAfter, ctx).score;
    expect(scoreAfterStep).toBeLessThan(scoreBeforeStep);
  }
}

describe('Golden-Path Integration: Guided Demo Tour Journey', () => {
  const fixedClock = () => new Date('2026-10-22T12:00:00.000Z');

  beforeEach(() => {
    useEventsStore.setState({
      events: {},
      order: [],
      hydrated: true,
      notice: null,
      outcomes: {},
      chatDraft: '',
    });
  });

  it('walks through all 4 chat steps of the demo tour via handleMessage + MockProvider + store.approveAndApply while preserving all engine invariants', async () => {
    const ids = createIdFactory('golden_journey');
    const ctx: EngineContext = { ids, clock: fixedClock };
    const mockProvider = new MockProvider();
    const deps = createDeps({
      mode: 'demo',
      provider: mockProvider,
      mockProvider,
      ids,
      clock: fixedClock,
    });

    const demo = buildDemoPlan(ctx);
    const eventId = useEventsStore.getState().createEvent(demo.plan, {
      assumptions: demo.assumptions,
    });

    const chatSteps = DEMO_TOUR.filter((s) => s.kind === 'chat');
    expect(chatSteps).toHaveLength(4);

    for (const step of chatSteps) {
      const recordBefore = useEventsStore.getState().events[eventId]!;
      const planBefore = recordBefore.plan;
      const versionBefore = planBefore.version;
      const ledgerLenBefore = planBefore.ledger.length;
      const lockedBefore = planBefore.budgetItems.filter((i) => i.locked);
      const scoreBeforeStep = scoreRisks(planBefore, ctx).score;

      const req = new Request('http://localhost:3000/api/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: step.userMessage,
          plan: planBefore,
          recentMessages: [],
        }),
      });

      const response = await handleMessage(req, deps);
      expect(response.status).toBe(200);
      const { outcome } = (await response.json()) as MessageResponse;

      assertPreApprovalOutcome(step.stepId, planBefore, outcome);

      const chosenOption = selectOptionForApproval(outcome);
      expect(isRaiseCapOption(chosenOption)).toBe(false);

      const approveRes = useEventsStore.getState().approveAndApply(eventId, chosenOption.patch, {
        basedOnVersion: versionBefore,
      });
      expect(approveRes.ok).toBe(true);

      const planAfter = useEventsStore.getState().events[eventId]!.plan;

      // Global invariants after EVERY step
      expect(eventPlanSchema.safeParse(planAfter).success).toBe(true);
      expect(getBudgetCap(planAfter.constraints)).toBe(HARD_CAP);
      expect(budgetTotal(planAfter.budgetItems, planAfter.meta.guestCount)).toBeLessThanOrEqual(
        HARD_CAP,
      );
      expect(planAfter.version).toBe(versionBefore + 1);
      expect(planAfter.ledger).toHaveLength(ledgerLenBefore + 1);

      for (const lockedItem of lockedBefore) {
        const afterItem = planAfter.budgetItems.find((i) => i.id === lockedItem.id);
        expect(afterItem).toEqual(lockedItem);
      }

      assertPostApprovalStep(step.stepId, eventId, planAfter, scoreBeforeStep, ctx);
    }
  });
});
