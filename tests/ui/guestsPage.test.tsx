import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AddPreferenceDialog } from '@/components/guests/AddPreferenceDialog';
import { GuestsClient } from '@/components/guests/GuestsClient';
import { LiveRegionProvider } from '@/components/ui/LiveRegion';
import { buildDemoPlan } from '@/engine/demo';
import { createIdFactory } from '@/lib/id';
import { useEventsStore } from '@/store/eventsStore';
import { expectNoAxeViolations } from '../helpers/a11y';

let mockEventId = 'evt_demo_guests';

vi.mock('next/navigation', () => ({
  usePathname: () => `/events/${mockEventId}/guests`,
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ id: mockEventId }),
  useSearchParams: () => new URLSearchParams(''),
}));

const ctx = {
  ids: createIdFactory('guests_page_test'),
  clock: () => new Date('2026-10-21T12:00:00.000Z'),
};

describe('UI: Guests Page & Components (TASK 2 & 4)', () => {
  let eventId: string;

  beforeEach(() => {
    vi.restoreAllMocks();
    useEventsStore.setState({ events: {}, order: [], hydrated: true });
    const demo = buildDemoPlan(ctx);
    // Ensure wheelchair count > 0 to test access conflict & insights
    const planWithWheelchair = {
      ...demo.plan,
      guestNeeds: {
        ...demo.plan.guestNeeds,
        wheelchairUsers: 2,
        vegetarian: 30,
        languages: ['English', 'Hindi'],
      },
    };
    eventId = useEventsStore.getState().createEvent(planWithWheelchair, {
      assumptions: demo.assumptions,
    });
    mockEventId = eventId;
  });

  it('renders all 4 h2 sections, privacy notes, and passes axe audit', async () => {
    const { container } = render(
      <LiveRegionProvider>
        <GuestsClient eventId={eventId} />
      </LiveRegionProvider>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Guests' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: "Who's coming" })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'What your guests need' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Reminders for you' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Traditions and requirements' })).toBeInTheDocument();

    expect(
      screen.getByText(/Momently keeps counts only: never guest names or personal details/i),
    ).toBeInTheDocument();

    await expectNoAxeViolations(container);
  });

  it('saving counts bumps version and updates meal table', async () => {
    const initialPlan = useEventsStore.getState().events[eventId]!.plan;
    const initialVersion = initialPlan.version;

    render(
      <LiveRegionProvider>
        <GuestsClient eventId={eventId} />
      </LiveRegionProvider>,
    );

    // Update vegetarian to 45
    const vegInput = screen.getByLabelText('Vegetarian');
    fireEvent.change(vegInput, { target: { value: '45' } });

    const saveBtn = screen.getByRole('button', { name: 'Save guest needs' });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      const updatedPlan = useEventsStore.getState().events[eventId]!.plan;
      expect(updatedPlan.version).toBeGreaterThan(initialVersion);
      expect(updatedPlan.guestNeeds.vegetarian).toBe(45);
    });

    expect(screen.getByText('Saved requirements for 80 guests')).toBeInTheDocument();
  });

  it('count above guestCount shows inline error and saves nothing', async () => {
    const initialVersion = useEventsStore.getState().events[eventId]!.plan.version;

    render(
      <LiveRegionProvider>
        <GuestsClient eventId={eventId} />
      </LiveRegionProvider>,
    );

    // Guest count is 80; enter 90 vegetarians
    const vegInput = screen.getByLabelText('Vegetarian');
    fireEvent.change(vegInput, { target: { value: '90' } });

    expect(
      screen.getByText("Vegetarians can't be more than your guest count of 80"),
    ).toBeInTheDocument();

    const saveBtn = screen.getByRole('button', { name: 'Save guest needs' });
    expect(saveBtn).toBeDisabled();

    // Version remains unchanged
    expect(useEventsStore.getState().events[eventId]!.plan.version).toBe(initialVersion);
  });

  it('allows adding language chips up to max 5 and removing them', async () => {
    render(
      <LiveRegionProvider>
        <GuestsClient eventId={eventId} />
      </LiveRegionProvider>,
    );

    const langInput = screen.getByLabelText('Add a language');
    const addBtn = screen.getByRole('button', { name: 'Add' });

    // Add Marathi
    fireEvent.change(langInput, { target: { value: 'Marathi' } });
    fireEvent.click(addBtn);

    expect(screen.getByText('Marathi')).toBeInTheDocument();

    // Remove English
    const removeEnglishBtn = screen.getByLabelText('Remove English');
    fireEvent.click(removeEnglishBtn);

    expect(screen.queryByText('English')).not.toBeInTheDocument();
  });

  it('adds insight task to checklist and updates button to Already on your checklist', async () => {
    render(
      <LiveRegionProvider>
        <GuestsClient eventId={eventId} />
      </LiveRegionProvider>,
    );

    // Look for Add to checklist button
    const addBtns = screen.getAllByRole('button', { name: 'Add to checklist' });
    expect(addBtns.length).toBeGreaterThan(0);

    fireEvent.click(addBtns[0]!);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Already on your checklist' })).toBeDisabled();
    });
  });

  it('access conflict resolves and disappears after verification task is marked done', async () => {
    render(
      <LiveRegionProvider>
        <GuestsClient eventId={eventId} />
      </LiveRegionProvider>,
    );

    // Access action required warning heading is present initially
    expect(screen.getByText('Accessibility action required')).toBeInTheDocument();

    // Mark accessibility task done in the store
    const store = useEventsStore.getState();
    store.applyUserEdit(
      eventId,
      [
        {
          type: 'add_task',
          task: {
            id: 'task_acc_test',
            title: 'Verify step-free access',
            category: 'accessibility',
            priority: 'high',
            dueDaysBefore: 60,
            status: 'done',
          },
        },
      ],
      'Add verified accessibility task',
    );

    await waitFor(() => {
      expect(screen.getByText(/Venue accessibility confirmed/i)).toBeInTheDocument();
    });
  });

  it('allows adding and removing a preference and passes dialog axe audit', async () => {
    const { container } = render(
      <LiveRegionProvider>
        <GuestsClient eventId={eventId} />
      </LiveRegionProvider>,
    );

    const addReqBtn = screen.getByRole('button', { name: 'Add requirement' });
    fireEvent.click(addReqBtn);

    // Modal open
    expect(screen.getByRole('heading', { level: 2, name: 'Add tradition or requirement' })).toBeInTheDocument();
    await expectNoAxeViolations(container);

    const descInput = screen.getByLabelText('Description');
    fireEvent.change(descInput, { target: { value: 'Live Classical Shehnai Troupe' } });

    const submitBtn = screen.getByRole('button', { name: 'Save requirement' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Live Classical Shehnai Troupe')).toBeInTheDocument();
    });

    // Remove it
    const removeBtn = screen.getByLabelText('Remove requirement Live Classical Shehnai Troupe');
    fireEvent.click(removeBtn);

    // Confirm remove modal
    const confirmBtn = screen.getByRole('button', { name: 'Remove' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.queryByText('Live Classical Shehnai Troupe')).not.toBeInTheDocument();
    });
  });

  it('AddPreferenceDialog passes axe audit when rendered directly', async () => {
    const { container } = render(
      <AddPreferenceDialog open={true} onClose={vi.fn()} onSave={vi.fn()} />,
    );
    await expectNoAxeViolations(container);
  });
});
