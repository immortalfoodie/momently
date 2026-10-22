import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEMO_SCENARIO } from '@/data/demoScenario';
import type { EventPlan } from '@/domain/types';
import type { RecoveryOption } from '@/engine/chaos/types';
import { createPlan } from '@/engine/planFactory';
import { AssistantOutcomeView } from '@/components/review/AssistantOutcomeView';
import { useEventsStore } from '@/store/eventsStore';
import { expectNoAxeViolations } from '../helpers/a11y';

describe('AssistantOutcomeView Component', () => {
  const fixedClock = () => new Date('2026-10-22T10:00:00.000Z');
  let idCount = 0;
  const ids = (p?: string) => `${p ?? 'id'}_${++idCount}`;

  let testPlan: EventPlan;
  let testEventId: string;

  beforeEach(() => {
    useEventsStore.setState({ events: {}, order: [], hydrated: true });
    testPlan = createPlan({
      meta: DEMO_SCENARIO.meta,
      constraints: [
        {
          id: 'c_cap',
          kind: 'budget_cap',
          severity: 'hard',
          numericValue: 150000,
          description: 'Hard budget cap',
        },
      ],
      ids,
      clock: fixedClock,
      quality: 'essential',
    }).plan;

    testEventId = useEventsStore.getState().createEvent(testPlan);
  });

  const baseOption: RecoveryOption = {
    id: 'opt_1',
    label: 'Acoustic Duo Performance',
    tradeoff: 'Adds acoustic music but increases entertainment line-item',
    patch: {
      id: 'patch_1',
      ops: [],
      reason: 'Host requested live music',
      source: 'chaos',
      status: 'proposed',
      createdAt: '2026-10-22T10:00:00.000Z',
    },
    impact: {
      budgetTotalBefore: 120000,
      budgetTotalAfter: 132000,
      budgetCap: 150000,
      overCap: false,
      changedItems: [{ label: 'Acoustic Duo', before: 0, after: 12000 }],
      notes: ['Live music approved by venue rules'],
    },
    scoreBefore: 55,
    scoreAfter: 42,
    approvalsRequired: ['Approve a budget change of ₹12,000'],
    notes: ['Subject to sound curfew at 10 PM'],
    meetsCap: true,
  };

  it('renders all 7 outcome variants and dims stale outcomes', async () => {
    // 1. Proposal
    const { container: c1 } = render(
      <AssistantOutcomeView
        outcome={{
          kind: 'proposal',
          message: 'Here are two options to optimize your catering',
          options: [baseOption],
          recommendedOptionId: 'opt_1',
          notes: ['Vegetarian menu prioritised'],
        }}
        eventId={testEventId}
        plan={testPlan}
      />,
    );
    expect(screen.getByText('Here are two options to optimize your catering')).toBeInTheDocument();
    expect(screen.getByText('Recommended')).toBeInTheDocument();
    await expectNoAxeViolations(c1);

    // 2. Conflict
    const { container: c2 } = render(
      <AssistantOutcomeView
        outcome={{
          kind: 'conflict',
          message: 'A scheduling constraint needs resolution',
          conflicts: [
            {
              id: 'c1',
              kind: 'access_unconfirmed',
              severity: 'warning',
              message: 'Wheelchair ramp unconfirmed',
              options: [],
            },
          ],
          options: [baseOption],
        }}
        eventId={testEventId}
        plan={testPlan}
      />,
    );
    expect(screen.getByText('Plan Warning')).toBeInTheDocument();
    await expectNoAxeViolations(c2);

    // 3. Info
    const { container: c3 } = render(
      <AssistantOutcomeView
        outcome={{
          kind: 'info',
          message: 'Event logistics summary',
          items: [{ title: 'Vendor curfew', detail: '10:30 PM sharp' }],
        }}
      />,
    );
    expect(screen.getByText('Vendor curfew')).toBeInTheDocument();
    expect(screen.getByText('10:30 PM sharp')).toBeInTheDocument();
    await expectNoAxeViolations(c3);

    // 4. Chaos
    const { container: c4 } = render(
      <AssistantOutcomeView
        outcome={{
          kind: 'chaos',
          result: {
            input: { type: 'rain' },
            applicable: true,
            headline: 'Heavy Downpour Simulated',
            summary: 'Lawn decor flooded without tenting',
            options: [baseOption],
            scoreBefore: 55,
          },
        }}
        eventId={testEventId}
        plan={testPlan}
        narration="The sudden rainstorm shifts 80 guests indoors."
      />,
    );
    expect(screen.getByText('Heavy Downpour Simulated')).toBeInTheDocument();
    expect(screen.getByText(/The sudden rainstorm shifts/)).toBeInTheDocument();
    await expectNoAxeViolations(c4);

    // 5. Clarify
    const { container: c5 } = render(
      <AssistantOutcomeView
        outcome={{
          kind: 'clarify',
          question: 'Would you prefer plated dinner or buffet?',
        }}
      />,
    );
    expect(screen.getByText('Would you prefer plated dinner or buffet?')).toBeInTheDocument();
    await expectNoAxeViolations(c5);

    // 6. Reply
    const { container: c6 } = render(
      <AssistantOutcomeView
        outcome={{
          kind: 'reply',
          text: 'I have noted your dietary requirements.',
        }}
      />,
    );
    expect(screen.getByText('I have noted your dietary requirements.')).toBeInTheDocument();
    await expectNoAxeViolations(c6);

    // 7. Error
    const { container: c7 } = render(
      <AssistantOutcomeView
        outcome={{
          kind: 'error',
          message: 'Unable to resolve rate card.',
        }}
      />,
    );
    expect(screen.getByText('Unable to resolve rate card.')).toBeInTheDocument();
    await expectNoAxeViolations(c7);

    // Stale outcome dimming
    const { container: cStale } = render(
      <AssistantOutcomeView
        outcome={{
          kind: 'reply',
          text: 'Superceded proposal',
        }}
        basedOnVersion={0}
        currentVersion={2}
      />,
    );
    expect(screen.getByText('Out of date')).toBeInTheDocument();
    await expectNoAxeViolations(cStale);
  });
});
