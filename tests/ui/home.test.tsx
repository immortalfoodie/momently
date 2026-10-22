import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HomePage from '@/app/page';
import { useEventsStore } from '@/store';
import { expectNoAxeViolations } from '../helpers/a11y';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/',
  useParams: () => ({}),
}));

describe('Home Page', () => {
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

  it('renders hydration skeleton while store is not hydrated', async () => {
    const { container } = render(<HomePage />);

    expect(screen.getByTestId('events-skeleton')).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('renders empty state when hydrated with no events', async () => {
    useEventsStore.setState({ hydrated: true });
    const { container } = render(<HomePage />);

    expect(screen.getByText(/no celebrations planned yet/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Load the demo event' }).length).toBeGreaterThanOrEqual(1);
    await expectNoAxeViolations(container);
  });

  it('creates demo event and navigates when "Load the demo event" button is clicked', () => {
    useEventsStore.setState({ hydrated: true });
    render(<HomePage />);

    const demoButtons = screen.getAllByRole('button', { name: 'Load the demo event' });
    const firstButton = demoButtons[0];
    expect(firstButton).toBeDefined();
    if (firstButton) fireEvent.click(firstButton);

    const state = useEventsStore.getState();
    expect(state.order).toHaveLength(1);
    const demoId = state.order[0];
    expect(mockPush).toHaveBeenCalledWith(`/events/${demoId}/concepts`);
  });

  it('renders event cards with stage badges and exactly one link per card when events exist', async () => {
    useEventsStore.getState().createDemoEvent();
    useEventsStore.setState({ hydrated: true });

    const { container } = render(<HomePage />);

    expect(screen.getByRole('heading', { level: 2, name: /my celebrations/i })).toBeInTheDocument();
    const demoEventTitle = screen.getByText(/25th Anniversary/i);
    expect(demoEventTitle).toBeInTheDocument();

    // Stage badge for demo event (initially in 'draft' stage until a concept is selected)
    expect(screen.getByText('Draft')).toBeInTheDocument();

    // Stretched link: card heading is the only link inside the card article
    const article = demoEventTitle.closest('article');
    expect(article).not.toBeNull();
    const linksInsideArticle = article?.querySelectorAll('a');
    expect(linksInsideArticle?.length).toBe(1);

    await expectNoAxeViolations(container);
  });
});
