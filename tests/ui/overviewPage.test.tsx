import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { EventContextProvider } from '@/components/events';
import { OverviewClient } from '@/components/overview/OverviewClient';
import { computeTaskDueDate } from '@/components/overview/NextSteps';
import { LiveRegionProvider } from '@/components/ui/LiveRegion';
import { buildDemoPlan } from '@/engine/demo';
import { createSnapshot } from '@/engine/history';
import { engineContext } from '@/store/engineContext';
import { useEventsStore } from '@/store/eventsStore';
import { useEvent, useEventDerived } from '@/store/selectors';
import { expectNoAxeViolations } from '../helpers/a11y';

function TestOverviewWrapper({ eventId }: { eventId: string }) {
  const event = useEvent(eventId);
  const derived = useEventDerived(eventId);
  if (!event || !derived) return null;

  return (
    <LiveRegionProvider>
      <EventContextProvider value={{ event, plan: event.plan, derived }}>
        <OverviewClient eventId={eventId} />
      </EventContextProvider>
    </LiveRegionProvider>
  );
}

describe('Overview Page & Components', () => {
  let demoEventId: string;

  beforeEach(() => {
    useEventsStore.setState({ events: {}, order: [], hydrated: true });
    const demo = buildDemoPlan(engineContext);
    demoEventId = useEventsStore.getState().createEvent(demo.plan);
  });

  it('renders overview page with all sections and passes axe audit', async () => {
    const { container } = render(<TestOverviewWrapper eventId={demoEventId} />);

    // Deep-link nav links
    expect(screen.getByRole('link', { name: 'Facts' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Concept' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Conflicts' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Risks' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Next Steps' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'History' })).toBeInTheDocument();

    await expectNoAxeViolations(container);
  });

  it('calculates task due dates correctly with and without event date', () => {
    const task = {
      id: 't1',
      title: 'Book Caterer',
      category: 'catering',
      dueDaysBefore: 14,
      status: 'todo' as const,
      priority: 'high' as const,
    };

    // With date in future: 2026-11-20 minus 14 days = 2026-11-06
    const withDate = computeTaskDueDate(task, '2026-11-20');
    expect(withDate.text).toContain('Nov');
    expect(withDate.text).toContain('2026');

    // With date in past: overdue
    const pastDate = computeTaskDueDate(task, '2020-01-20');
    expect(pastDate.isOverdue).toBe(true);

    // Without date: fallback to relative days
    const noDate = computeTaskDueDate(task, undefined);
    expect(noDate.text).toBe('14 days before the event');
    expect(noDate.isOverdue).toBe(false);
  });

  it('edits celebration facts: city tier change triggers repricing with impact dialog', async () => {
    const user = userEvent.setup();
    render(<TestOverviewWrapper eventId={demoEventId} />);

    // Initial city is Mumbai (tier1)
    expect(screen.getByText('Mumbai')).toBeInTheDocument();

    // Click "Edit details"
    await user.click(screen.getByRole('button', { name: /Edit details/i }));

    // Change city to Jaipur (tier2)
    const cityInput = screen.getByLabelText(/Host city/i);
    await user.clear(cityInput);
    await user.type(cityInput, 'Jaipur');

    await user.click(screen.getByRole('button', { name: /Save Changes/i }));

    // Impact dialog appears acknowledging tier repricing
    expect(await screen.findByText(/Prices Re-estimated for City Rate Tier/i)).toBeInTheDocument();
  });

  it('edits celebration facts: guest count change opens proposal flow', async () => {
    const user = userEvent.setup();
    render(<TestOverviewWrapper eventId={demoEventId} />);

    // Click "Edit details"
    await user.click(screen.getByRole('button', { name: /Edit details/i }));

    // Change guest count to 120
    const guestsInput = screen.getByLabelText(/Guest count/i);
    await user.clear(guestsInput);
    await user.type(guestsInput, '120');

    await user.click(screen.getByRole('button', { name: /Save Changes/i }));

    // Proposal dialog opens
    expect(await screen.findByText(/Proposed Parameter Adjustment/i)).toBeInTheDocument();
  });

  it('switches between Decisions and Saved versions tabs and restores version', async () => {
    const user = userEvent.setup();

    // Create a historical snapshot in the store before mutating
    const store = useEventsStore.getState();
    const currentPlan = store.events[demoEventId]!.plan;
    const snap = createSnapshot(currentPlan, 'Initial baseline', engineContext);

    // Update store with snapshot and bump current plan
    useEventsStore.setState({
      events: {
        ...store.events,
        [demoEventId]: {
          ...store.events[demoEventId]!,
          history: [snap],
          plan: { ...currentPlan, version: 2 },
        },
      },
    });

    render(<TestOverviewWrapper eventId={demoEventId} />);

    // Default tab is Decisions
    expect(screen.getByRole('tab', { name: /Decisions/i })).toHaveAttribute('aria-selected', 'true');

    // Switch to Saved versions tab
    await user.click(screen.getByRole('tab', { name: /Saved versions/i }));
    expect(screen.getByText('Before: Initial baseline')).toBeInTheDocument();

    // Click "Compare with current"
    await user.click(screen.getByRole('button', { name: /Compare with current/i }));
    expect(await screen.findByText(/Compare Version 1 with Current/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Close$/i }));

    // Click "Restore this version"
    await user.click(screen.getByRole('button', { name: /Restore this version/i }));
    expect(screen.getByText(/Restore Version 1\?/i)).toBeInTheDocument();

    // Confirm restore
    await user.click(screen.getByRole('button', { name: /Restore Version 1$/i }));

    // Store state: plan version incremented to 3, restored notice shown
    const updatedPlan = useEventsStore.getState().events[demoEventId]!.plan;
    expect(updatedPlan.version).toBe(3);
    const lastDecision = updatedPlan.ledger[updatedPlan.ledger.length - 1];
    expect(lastDecision?.summary).toBe('Restored version 1');
  });
});
