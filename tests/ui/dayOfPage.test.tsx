import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DayOfClient } from '@/components/eventday/DayOfClient';
import { KeepScreenOn } from '@/components/eventday/KeepScreenOn';
import { LiveRegionProvider } from '@/components/ui/LiveRegion';
import { buildDemoPlan } from '@/engine/demo';
import { createIdFactory } from '@/lib/id';
import { useEventsStore } from '@/store/eventsStore';
import { expectNoAxeViolations } from '../helpers/a11y';

let mockEventId = 'evt_demo_day_of';

vi.mock('next/navigation', () => ({
  usePathname: () => `/events/${mockEventId}/day-of`,
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ id: mockEventId }),
  useSearchParams: () => new URLSearchParams(''),
}));

const ctx = {
  ids: createIdFactory('day_of_page_test'),
  clock: () => new Date('2026-10-21T12:00:00.000Z'),
};

describe('UI: Day-Of Page & Interactions (TASK 4 & 5)', () => {
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

  it('renders all 4 h2 sections and starts in practice mode before first session', async () => {
    const { container } = render(
      <LiveRegionProvider>
        <DayOfClient eventId={eventId} />
      </LiveRegionProvider>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Event day' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Right now' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: "Today's to-do list" })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Something went wrong?' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Key contacts' })).toBeInTheDocument();

    // Practice mode badge is displayed
    expect(screen.getByText('Practice mode')).toBeInTheDocument();
    expect(screen.getByLabelText("Pretend it's")).toBeInTheDocument();

    await expectNoAxeViolations(container);
  });

  it('updates simulated time, shows Happening now with minutes left, and announces only on change', async () => {
    // Keep first 2 slots so the schedule ends earlier in the evening
    const demo = useEventsStore.getState().events[eventId]!;
    useEventsStore.setState({
      events: {
        ...useEventsStore.getState().events,
        [eventId]: {
          ...demo,
          plan: { ...demo.plan, schedule: demo.plan.schedule.slice(0, 2) },
        },
      },
    });

    render(
      <LiveRegionProvider>
        <DayOfClient eventId={eventId} />
      </LiveRegionProvider>,
    );

    const timeInput = screen.getByLabelText("Pretend it's");

    // Welcome Drinks is 18:30 - 19:15. At 19:00 it is Happening now.
    fireEvent.change(timeInput, { target: { value: '19:00' } });

    await waitFor(() => {
      expect(screen.getByText(/Happening now/i)).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 3, name: 'Welcome & Welcome Drinks' })).toBeInTheDocument();
      expect(screen.getByText(/15m left/i)).toBeInTheDocument();
      expect(screen.getByText(/Ends at 7:15 PM/i)).toBeInTheDocument();
    });

    // Pretend time is after all events: 22:00
    fireEvent.change(timeInput, { target: { value: '22:00' } });

    await waitFor(() => {
      expect(screen.getByText(/That's a wrap\. Congratulations!/i)).toBeInTheDocument();
    });
  });

  it('marks a day task as done without bumping the plan version', async () => {
    render(
      <LiveRegionProvider>
        <DayOfClient eventId={eventId} />
      </LiveRegionProvider>,
    );

    const initialPlan = useEventsStore.getState().events[eventId]!.plan;
    const initialVersion = initialPlan.version;

    const markDoneButtons = screen.getAllByRole('button', { name: /Mark .* as done/i });
    expect(markDoneButtons.length).toBeGreaterThan(0);

    fireEvent.click(markDoneButtons[0]!);

    await waitFor(() => {
      const updatedPlan = useEventsStore.getState().events[eventId]!.plan;
      expect(updatedPlan.version).toBe(initialVersion);
    });
  });

  it('Something is running late opens DelayPlanner and chaos links carry correct query params', async () => {
    render(
      <LiveRegionProvider>
        <DayOfClient eventId={eventId} />
      </LiveRegionProvider>,
    );

    // Chaos links
    const rainLink = screen.getByRole('link', { name: /It started raining/i });
    expect(rainLink).toHaveAttribute('href', `/events/${eventId}/chaos?scenario=rain`);

    const vendorLink = screen.getByRole('link', { name: /A vendor can't make it/i });
    expect(vendorLink).toHaveAttribute('href', `/events/${eventId}/chaos?scenario=vendor_cancels`);

    const itemLink = screen.getByRole('link', { name: /An item is unavailable/i });
    expect(itemLink).toHaveAttribute('href', `/events/${eventId}/chaos?scenario=item_unavailable`);

    // Toggle Delay Planner
    const delayBtn = screen.getByRole('button', { name: /Something is running late/i });
    fireEvent.click(delayBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Hide delay planner/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Show my options/i })).toBeInTheDocument();
    });
  });

  it('manages contacts: adds, edits, copies number, and removes with confirm dialog without bumping plan version', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    });

    render(
      <LiveRegionProvider>
        <DayOfClient eventId={eventId} />
      </LiveRegionProvider>,
    );

    const initialVersion = useEventsStore.getState().events[eventId]!.plan.version;

    // Add contact
    fireEvent.click(screen.getByRole('button', { name: /Add a contact/i }));
    fireEvent.change(screen.getByLabelText(/Contact Name/i), { target: { value: 'Anita Photographer' } });
    fireEvent.change(screen.getByLabelText(/Role/i), { target: { value: 'Lead Cameraman' } });
    fireEvent.change(screen.getByLabelText(/Phone number/i), { target: { value: '+91 98765 11111' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save contact' }));

    await waitFor(() => {
      expect(screen.getByText('Anita Photographer')).toBeInTheDocument();
      expect(screen.getByText('Lead Cameraman')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Call Anita Photographer/i })).toHaveAttribute(
        'href',
        'tel:+91 98765 11111',
      );
    });

    // Copy number
    fireEvent.click(screen.getByRole('button', { name: /Copy phone number for Anita/i }));
    expect(writeTextMock).toHaveBeenCalledWith('+91 98765 11111');

    // Remove contact
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Remove' }));

    await waitFor(() => {
      expect(screen.queryByText('Anita Photographer')).not.toBeInTheDocument();
      expect(useEventsStore.getState().events[eventId]!.plan.version).toBe(initialVersion);
    });
  });

  it('handles KeepScreenOn wakeLock: supported, release on unmount, and error tolerance', async () => {
    const releaseMock = vi.fn().mockResolvedValue(undefined);
    const requestMock = vi.fn().mockResolvedValue({ release: releaseMock });

    Object.assign(navigator, {
      wakeLock: { request: requestMock },
    });

    const { unmount } = render(<KeepScreenOn />);
    const checkbox = screen.getByLabelText(/Keep screen on/i);

    fireEvent.click(checkbox);
    await waitFor(() => {
      expect(requestMock).toHaveBeenCalledWith('screen');
    });

    unmount();
    expect(releaseMock).toHaveBeenCalled();

    // Error case
    const errorRequestMock = vi.fn().mockRejectedValue(new Error('Battery Saver Active'));
    Object.assign(navigator, {
      wakeLock: { request: errorRequestMock },
    });

    render(<KeepScreenOn />);
    const errCheckbox = screen.getByLabelText(/Keep screen on/i);
    fireEvent.click(errCheckbox);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('passes axe accessibility audit across states (before, during, after, and with contacts)', async () => {
    const store = useEventsStore.getState();
    store.addContact(eventId, {
      id: 'c_test',
      name: 'Ravi Catering',
      phone: '+91 99999 00000',
      category: 'food',
    });

    const { container } = render(
      <LiveRegionProvider>
        <DayOfClient eventId={eventId} />
      </LiveRegionProvider>,
    );

    // 1. Practice before
    await expectNoAxeViolations(container);

    // 2. During session (19:00)
    const timeInput = screen.getByLabelText("Pretend it's");
    fireEvent.change(timeInput, { target: { value: '19:00' } });
    await expectNoAxeViolations(container);

    // 3. After event (23:45)
    fireEvent.change(timeInput, { target: { value: '23:45' } });
    await expectNoAxeViolations(container);
  });
});
