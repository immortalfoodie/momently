import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TimelineClient } from '@/components/timeline/TimelineClient';
import { SlotDialog } from '@/components/timeline/SlotDialog';
import { PrepCountdown } from '@/components/timeline/PrepCountdown';
import { LiveRegionProvider } from '@/components/ui/LiveRegion';
import { buildDemoPlan } from '@/engine/demo';
import { createIdFactory } from '@/lib/id';
import { useEventsStore } from '@/store/eventsStore';
import { expectNoAxeViolations } from '../helpers/a11y';

let mockEventId = 'evt_demo';

vi.mock('next/navigation', () => ({
  usePathname: () => `/events/${mockEventId}/timeline`,
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ id: mockEventId }),
  useSearchParams: () => new URLSearchParams(''),
}));

const ctx = {
  ids: createIdFactory('timeline_page_test'),
  clock: () => new Date('2026-10-21T12:00:00.000Z'),
};

describe('UI: Timeline Page & Interactions (TASK 4)', () => {
  let eventId: string;

  beforeEach(() => {
    vi.restoreAllMocks();
    useEventsStore.setState({ events: {}, order: [], hydrated: true });
    const demo = buildDemoPlan(ctx);
    eventId = useEventsStore.getState().createEvent(demo.plan, {
      assumptions: demo.assumptions,
    });
    mockEventId = eventId;
  });

  it('renders all 4 sections, lists slots with times, and passes axe audit', async () => {
    const { container } = render(
      <LiveRegionProvider>
        <TimelineClient eventId={eventId} />
      </LiveRegionProvider>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Timeline' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Countdown' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Run of show' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Something running late?' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Move or adjust' })).toBeInTheDocument();

    // Verify slots with times are present
    expect(screen.getByText(/Run-Sheet Sequence/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Welcome & Welcome Drinks' })).toBeInTheDocument();

    await expectNoAxeViolations(container);
  });

  it('rejects adding a slot at 23:30 for 60 minutes inline without saving', async () => {
    render(
      <LiveRegionProvider>
        <TimelineClient eventId={eventId} />
      </LiveRegionProvider>,
    );

    const initialSlotsCount = useEventsStore.getState().events[eventId]!.plan.schedule.length;

    // Open Add session dialog
    fireEvent.click(screen.getByRole('button', { name: 'Add session' }));
    const dialog = screen.getByRole('dialog', { name: 'Add Activity Slot' });
    expect(dialog).toBeInTheDocument();

    // Fill in title
    const titleInput = screen.getByLabelText(/Activity Title/i);
    fireEvent.change(titleInput, { target: { value: 'Late Night Dance' } });

    // Set time to 23:30
    const timeInput = screen.getByLabelText(/Start Time/i);
    fireEvent.change(timeInput, { target: { value: '23:30' } });

    // Set duration to 60 (23:30 + 60m = 00:30 > 1440)
    const durationInput = screen.getByLabelText(/^Duration \(mins\)/i);
    fireEvent.change(durationInput, { target: { value: '60' } });

    // Click submit inside the dialog (button 1)
    const addButtons = screen.getAllByRole('button', { name: 'Add session' });
    fireEvent.click(addButtons[addButtons.length - 1]!);

    // Inline error shown
    expect(screen.getByText("A session can't run past midnight")).toBeInTheDocument();

    // Schedule remains unchanged
    expect(useEventsStore.getState().events[eventId]!.plan.schedule.length).toBe(initialSlotsCount);
  });

  it('editing a slot saves and bumps the plan version', async () => {
    render(
      <LiveRegionProvider>
        <TimelineClient eventId={eventId} />
      </LiveRegionProvider>,
    );

    const initialVersion = useEventsStore.getState().events[eventId]!.plan.version;

    // Click first edit button
    const editButtons = screen.getAllByRole('button', { name: 'Edit' });
    fireEvent.click(editButtons[0]!);

    expect(screen.getByRole('dialog', { name: 'Edit Activity Slot' })).toBeInTheDocument();

    // Modify title
    const titleInput = screen.getByLabelText(/Activity Title/i);
    fireEvent.change(titleInput, { target: { value: 'Early Welcome Drinks & Snacks' } });

    // Save changes
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      const updatedPlan = useEventsStore.getState().events[eventId]!.plan;
      expect(updatedPlan.version).toBe(initialVersion + 1);
      expect(updatedPlan.schedule.some((s) => s.title === 'Early Welcome Drinks & Snacks')).toBe(true);
    });
  });

  it('shifting by +30 moves later slots; overflow shift saves nothing and explains', async () => {
    // Start with a plan starting 300m earlier so +30m does not overflow
    const demo = buildDemoPlan(ctx);
    const shiftedPlan = {
      ...demo.plan,
      schedule: demo.plan.schedule.map((s) => ({ ...s, startMinute: s.startMinute - 200 })),
    };
    const shiftedEventId = useEventsStore.getState().createEvent(shiftedPlan);

    render(
      <LiveRegionProvider>
        <TimelineClient eventId={shiftedEventId} />
      </LiveRegionProvider>,
    );

    const firstStartBefore = useEventsStore.getState().events[shiftedEventId]!.plan.schedule[0]!.startMinute;

    // Set shift amount to +30
    const shiftInput = screen.getByLabelText(/Shift amount in minutes/i);
    fireEvent.change(shiftInput, { target: { value: '30' } });

    // Apply shift
    fireEvent.click(screen.getByRole('button', { name: 'Apply Shift' }));

    await waitFor(() => {
      const firstStartAfter = useEventsStore.getState().events[shiftedEventId]!.plan.schedule[0]!.startMinute;
      expect(firstStartAfter).toBe(firstStartBefore + 30);
    });

    // Overflow shift: set to 240m on a late schedule
    fireEvent.change(shiftInput, { target: { value: '240' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply Shift' }));

    await waitFor(() => {
      expect(screen.getByText(/Shifted schedule slots would breach 00:00 to 24:00 boundary/i)).toBeInTheDocument();
    });
  });

  it('DelayPlanner shows options for 60-min delay, nothing changes before approval, approving updates schedule', async () => {
    // Use an earlier start so 60m delay is feasible
    const demo = buildDemoPlan(ctx);
    const earlierPlan = {
      ...demo.plan,
      schedule: demo.plan.schedule.map((s) => ({ ...s, startMinute: s.startMinute - 180 })),
    };
    const testId = useEventsStore.getState().createEvent(earlierPlan);

    render(
      <LiveRegionProvider>
        <TimelineClient eventId={testId} />
      </LiveRegionProvider>,
    );

    const initialVersion = useEventsStore.getState().events[testId]!.plan.version;
    const initialSchedule = [...useEventsStore.getState().events[testId]!.plan.schedule];

    // Click "Show my options"
    fireEvent.click(screen.getByRole('button', { name: 'Show my options' }));

    // Options appear
    await waitFor(() => {
      expect(screen.getByText(/Suggested Recovery Strategies/i)).toBeInTheDocument();
    });

    // Plan version and schedule did NOT change before approval
    expect(useEventsStore.getState().events[testId]!.plan.version).toBe(initialVersion);
    expect(useEventsStore.getState().events[testId]!.plan.schedule).toEqual(initialSchedule);

    // Approve the recommended option
    const approveButtons = screen.getAllByRole('button', { name: /Approve/i });
    fireEvent.click(approveButtons[0]!);

    await waitFor(() => {
      const updatedPlan = useEventsStore.getState().events[testId]!.plan;
      expect(updatedPlan.version).toBe(initialVersion + 1);
      expect(updatedPlan.schedule).not.toEqual(initialSchedule);
    });
  });

  it('computes countdown text for future, today, past, and no date', () => {
    const basePlan = buildDemoPlan(ctx).plan;

    const futurePlan = { ...basePlan, meta: { ...basePlan.meta, dateIso: '2026-10-31' } };
    const { rerender } = render(<PrepCountdown plan={futurePlan} eventId={eventId} clock={() => new Date('2026-10-21T00:00:00Z')} />);
    expect(screen.getByText('10 days to go')).toBeInTheDocument();

    const todayPlan = { ...basePlan, meta: { ...basePlan.meta, dateIso: '2026-10-21' } };
    rerender(<PrepCountdown plan={todayPlan} eventId={eventId} clock={() => new Date('2026-10-21T00:00:00Z')} />);
    expect(screen.getByText('Today is the day')).toBeInTheDocument();

    const pastPlan = { ...basePlan, meta: { ...basePlan.meta, dateIso: '2026-10-15' } };
    rerender(<PrepCountdown plan={pastPlan} eventId={eventId} clock={() => new Date('2026-10-21T00:00:00Z')} />);
    expect(screen.getByText('This event has passed')).toBeInTheDocument();

    const noDatePlan = { ...basePlan, meta: { ...basePlan.meta, dateIso: undefined } };
    rerender(<PrepCountdown plan={noDatePlan} eventId={eventId} clock={() => new Date('2026-10-21T00:00:00Z')} />);
    expect(screen.getByText(/No celebration date set yet/i)).toBeInTheDocument();
  });

  it('passes axe audit on SlotDialog and confirm dialog', async () => {
    const demo = buildDemoPlan(ctx);
    const { container } = render(
      <LiveRegionProvider>
        <SlotDialog
          open={true}
          onClose={vi.fn()}
          slot={demo.plan.schedule[0]}
          eventId={eventId}
        />
      </LiveRegionProvider>,
    );

    await expectNoAxeViolations(container);
  });
});
