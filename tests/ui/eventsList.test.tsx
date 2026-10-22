import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EventsPage from '@/app/events/page';
import { LiveRegionProvider } from '@/components/ui/LiveRegion';
import { buildDemoPlan } from '@/engine/demo';
import { useEventsStore } from '@/store';
import { expectNoAxeViolations } from '../helpers/a11y';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/events',
  useParams: () => ({}),
}));

describe('Events List Page (/events)', () => {
  beforeEach(() => {
    mockPush.mockReset();
    useEventsStore.setState({
      events: {},
      order: [],
      hydrated: false,
      notice: null,
      outcomes: {},
      chatDraft: '',
    });
  });

  it('renders skeleton when not hydrated, then empty state when hydrated with no events', async () => {
    const { container, rerender } = render(
      <LiveRegionProvider>
        <EventsPage />
      </LiveRegionProvider>,
    );

    expect(screen.getByTestId('events-skeleton')).toBeInTheDocument();

    useEventsStore.setState({ hydrated: true });
    rerender(
      <LiveRegionProvider>
        <EventsPage />
      </LiveRegionProvider>,
    );

    expect(screen.getByText('No celebrations found')).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('displays events sorted according to store.order (recency)', () => {
    const ctx = { ids: () => 'test-id', clock: () => new Date('2026-10-20') };
    const demo = buildDemoPlan(ctx);

    const planA = {
      ...demo.plan,
      id: 'event-a',
      meta: { ...demo.plan.meta, title: 'Alpha Celebration' },
    };
    const planB = {
      ...demo.plan,
      id: 'event-b',
      meta: { ...demo.plan.meta, title: 'Beta Celebration' },
    };

    useEventsStore.getState().createEvent(planA, { assumptions: [], missingInfo: [] });
    useEventsStore.getState().createEvent(planB, { assumptions: [], missingInfo: [] });
    useEventsStore.setState({ hydrated: true });

    render(
      <LiveRegionProvider>
        <EventsPage />
      </LiveRegionProvider>,
    );

    // Because createEvent prepends to order, Beta is first, Alpha is second
    const headings = screen.getAllByRole('heading', { level: 2 });
    const eventHeadings = headings.map((h) => h.textContent);
    expect(eventHeadings).toEqual(['Beta Celebration', 'Alpha Celebration']);
  });

  it('opens delete confirmation dialog, cancels without deletion, and returns focus', async () => {
    useEventsStore.getState().createDemoEvent();
    useEventsStore.setState({ hydrated: true });

    const { container } = render(
      <LiveRegionProvider>
        <EventsPage />
      </LiveRegionProvider>,
    );

    const deleteBtn = screen.getByRole('button', { name: /Delete event.*25th Anniversary/i });
    deleteBtn.focus();
    expect(document.activeElement).toBe(deleteBtn);

    fireEvent.click(deleteBtn);

    expect(screen.getByRole('dialog', { name: 'Delete celebration plan?' })).toBeInTheDocument();
    await expectNoAxeViolations(container);

    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelBtn);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // Focus returns to the delete button
    expect(document.activeElement).toBe(deleteBtn);
    expect(useEventsStore.getState().order).toHaveLength(1);
  });

  it('deletes event upon confirmation and announces via live region', async () => {
    useEventsStore.getState().createDemoEvent();
    useEventsStore.setState({ hydrated: true });

    render(
      <LiveRegionProvider>
        <EventsPage />
      </LiveRegionProvider>,
    );

    const deleteBtn = screen.getByRole('button', { name: /Delete event.*25th Anniversary/i });
    fireEvent.click(deleteBtn);

    const confirmBtn = screen.getByRole('button', { name: 'Delete plan' });
    fireEvent.click(confirmBtn);

    expect(useEventsStore.getState().order).toHaveLength(0);
    expect(screen.getByText('No celebrations found')).toBeInTheDocument();

    // Verify live region announcement
    await waitFor(() => {
      const statusEl = screen.getByRole('status');
      expect(statusEl).toHaveTextContent(/Event deleted:.*25th Anniversary/i);
    });
  });
});
