import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_SCENARIO } from '@/data/demoScenario';
import type { EventPlan } from '@/domain/types';
import type { RecoveryOption } from '@/engine/chaos/types';
import type { Conflict } from '@/engine/conflicts';
import { createPlan } from '@/engine/planFactory';
import { LiveRegionProvider } from '@/components/ui/LiveRegion';
import { ConflictCard, OptionCard } from '@/components/review';
import { useEventsStore } from '@/store/eventsStore';
import { expectNoAxeViolations } from '../helpers/a11y';

describe('Review & Approval UI: OptionCard & ConflictCard', () => {
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
      ops: [
        {
          type: 'add_budget_item',
          item: {
            id: 'item_duo',
            category: 'entertainment',
            label: 'Acoustic Duo',
            basis: 'flat',
            unitCost: 12000,
            quantity: 1,
            provenance: 'user',
            locked: false,
          },
        },
      ],
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

  it('renders OptionCard with required sections, passes axe, and handles approval', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <LiveRegionProvider>
        <OptionCard option={baseOption} eventId={testEventId} isRecommended />
      </LiveRegionProvider>,
    );

    // Required sections
    expect(screen.getByRole('heading', { level: 3, name: 'Acoustic Duo Performance' })).toBeInTheDocument();
    expect(screen.getByText('Adds acoustic music but increases entertainment line-item')).toBeInTheDocument();
    expect(screen.getByText('Recommended')).toBeInTheDocument();
    expect(screen.getByText('Meets your budget cap')).toBeInTheDocument();
    expect(screen.getByText(/Chaos Score 55/)).toBeInTheDocument();
    expect(screen.getByText("You'd be approving:")).toBeInTheDocument();
    expect(screen.getByText('Approve a budget change of ₹12,000')).toBeInTheDocument();

    const approveBtn = screen.getByRole('button', { name: 'Approve this change' });
    expect(approveBtn).toBeEnabled();

    await expectNoAxeViolations(container);

    // Clicking approve calls store and updates plan version
    await user.click(approveBtn);
    const updated = useEventsStore.getState().events[testEventId];
    expect(updated?.plan.version).toBe(testPlan.version + 1);
  });

  it('disables Approve on over-cap option with visible reason and swaps with funding strategy', async () => {
    const user = userEvent.setup();

    const overCapOption: RecoveryOption = {
      ...baseOption,
      id: 'opt_over',
      meetsCap: false,
      impact: {
        ...baseOption.impact,
        budgetTotalBefore: 145000,
        budgetTotalAfter: 165000,
        budgetCap: 150000,
        overCap: true,
      },
      fundingOptions: [
        {
          id: 'strat_decor_cut',
          label: 'Scale Back Decor Elements',
          target: 15000,
          achieved: 20000,
          met: true,
          shortfall: 0,
          levers: [
            {
              id: 'lever_decor_down',
              label: 'Step down decor package',
              savings: 20000,
              experienceImpact: 'medium',
              rationale: 'Reduces floral accents',
              ops: [],
            },
          ],
          ops: [],
        },
      ],
    };

    const { container } = render(
      <LiveRegionProvider>
        <OptionCard option={overCapOption} eventId={testEventId} plan={testPlan} />
      </LiveRegionProvider>,
    );

    // Approve is disabled with visible reason
    const approveBtn = screen.getByRole('button', { name: 'Approve this change' });
    expect(approveBtn).toBeDisabled();
    expect(screen.getByText(/Cannot approve: Budget cap exceeded/)).toBeInTheDocument();
    expect(screen.getByText(/Goes over your cap by ₹15,000/)).toBeInTheDocument();

    // Choose funding strategy radio
    const radio = screen.getByRole('radio', { name: /Scale Back Decor Elements/ });
    expect(radio).toBeInTheDocument();
    await user.click(radio);

    // Choosing funding swaps the card to funded version and enables Approve
    expect(screen.getByText(/funded by: Scale Back Decor Elements/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve this change' })).toBeEnabled();

    await expectNoAxeViolations(container);
  });

  it('blocks stale option and renders disabled out-of-date state', () => {
    render(
      <LiveRegionProvider>
        <OptionCard option={baseOption} eventId={testEventId} disabled />
      </LiveRegionProvider>,
    );

    expect(screen.getByText('Out of date')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve this change' })).toBeDisabled();
  });

  it('renders ConflictCard with severity badge, opens preview dialog on ops-bearing resolution, and triggers callback on no-ops', async () => {
    const user = userEvent.setup();
    const handleAskToRelax = vi.fn();

    const conflict: Conflict = {
      id: 'conflict_monsoon',
      kind: 'monsoon_outdoor',
      severity: 'blocking',
      message: 'Outdoor terrace celebration scheduled during active monsoon season.',
      options: [
        {
          id: 'res_shift_indoor',
          label: 'Move to Indoor Hall',
          tradeoff: 'Shifts venue to banquet hall',
          ops: [{ type: 'set_meta', changes: { setting: 'indoor' } }],
        },
        {
          id: 'res_ask_relax',
          label: 'Tell me which to relax',
          tradeoff: 'Keep terrace and discuss waterproof canopy',
          ops: [],
        },
      ],
    };

    const { container } = render(
      <LiveRegionProvider>
        <ConflictCard
          conflict={conflict}
          eventId={testEventId}
          plan={testPlan}
          onAskToRelax={handleAskToRelax}
        />
      </LiveRegionProvider>,
    );

    expect(screen.getByText('Blocking Conflict')).toBeInTheDocument();
    expect(screen.getByText('Outdoor terrace celebration scheduled during active monsoon season.')).toBeInTheDocument();

    await expectNoAxeViolations(container);

    // Click no-ops resolution triggers callback
    const relaxBtn = screen.getByRole('button', { name: 'Tell me which to relax' });
    await user.click(relaxBtn);
    expect(handleAskToRelax).toHaveBeenCalledWith(conflict, conflict.options[1]);

    // Click ops-bearing resolution opens preview modal
    const moveBtn = screen.getByRole('button', { name: 'Move to Indoor Hall' });
    await user.click(moveBtn);
    expect(screen.getByRole('dialog', { name: 'Preview: Move to Indoor Hall' })).toBeInTheDocument();
  });
});
