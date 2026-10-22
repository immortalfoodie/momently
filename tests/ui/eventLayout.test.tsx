import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EventLayout from '@/app/events/[id]/layout';
import { useCurrentEvent } from '@/components/events';
import { useEventsStore } from '@/store';
import { expectNoAxeViolations } from '../helpers/a11y';

let mockParamId = 'unknown-id';
let mockPathname = '/events/unknown-id';

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: mockParamId }),
  usePathname: () => mockPathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

function ChildConsumer() {
  const { plan } = useCurrentEvent();
  return <div>Loaded Event: {plan.meta.title}</div>;
}

describe('Event Layout Shell (/events/[id])', () => {
  beforeEach(() => {
    mockParamId = 'unknown-id';
    mockPathname = '/events/unknown-id';
    useEventsStore.setState({
      events: {},
      order: [],
      hydrated: false,
      notice: null,
      outcomes: {},
      chatDraft: '',
    });
  });

  it('renders loading skeleton while store is not hydrated', async () => {
    const { container } = render(
      <EventLayout>
        <div>Content</div>
      </EventLayout>,
    );

    expect(screen.getByTestId('event-loading-skeleton')).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('renders friendly unknown ID state explaining browser storage and linking home', async () => {
    useEventsStore.setState({ hydrated: true });

    const { container } = render(
      <EventLayout>
        <div>Content</div>
      </EventLayout>,
    );

    expect(
      screen.getByText("We can't find this event in this browser"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/plans are stored locally in your browser for privacy/i),
    ).toBeInTheDocument();

    const homeLink = screen.getByRole('link', { name: /return to studio home/i });
    expect(homeLink).toHaveAttribute('href', '/');

    await expectNoAxeViolations(container);
  });

  it('provides useCurrentEvent context and renders subnav tabs when event exists', async () => {
    const demoId = useEventsStore.getState().createDemoEvent();
    useEventsStore.setState({ hydrated: true });
    mockParamId = demoId;
    mockPathname = `/events/${demoId}`;

    const { container } = render(
      <EventLayout>
        <ChildConsumer />
      </EventLayout>,
    );

    expect(screen.getByText(/Loaded Event:.*25th Anniversary/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Budget' })).toBeInTheDocument();

    await expectNoAxeViolations(container);
  });
});
