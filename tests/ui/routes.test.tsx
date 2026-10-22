import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ id: 'demo' }),
}));
import Home from '@/app/page';
import NewEventPage from '@/app/new/page';
import EventsPage from '@/app/events/page';
import EventOverviewPage from '@/app/events/[id]/page';
import ConceptsPage from '@/app/events/[id]/concepts/page';
import BudgetPage from '@/app/events/[id]/budget/page';
import TimelinePage from '@/app/events/[id]/timeline/page';
import ChecklistPage from '@/app/events/[id]/checklist/page';
import GuestsPage from '@/app/events/[id]/guests/page';
import VendorsPage from '@/app/events/[id]/vendors/page';
import ChaosLabPage from '@/app/events/[id]/chaos/page';
import DayOfPage from '@/app/events/[id]/day-of/page';
import NotFound from '@/app/not-found';
import Loading from '@/app/loading';
import ErrorBoundary from '@/app/error';
import { expectNoAxeViolations } from '../helpers/a11y';

describe('Route Skeletons Heading & Accessibility Audit', () => {
  const routes = [
    { name: 'Home', Component: Home },
    { name: 'New Event', Component: NewEventPage },
    { name: 'Events List', Component: EventsPage },
    { name: 'Event Overview', Component: EventOverviewPage },
    { name: 'Concepts', Component: ConceptsPage },
    { name: 'Budget', Component: BudgetPage },
    { name: 'Timeline', Component: TimelinePage },
    { name: 'Checklist', Component: ChecklistPage },
    { name: 'Guests', Component: GuestsPage },
    { name: 'Vendors', Component: VendorsPage },
    { name: 'Chaos Lab', Component: ChaosLabPage },
    { name: 'Event Day', Component: DayOfPage },
    { name: 'Not Found', Component: NotFound },
    { name: 'Loading Skeleton', Component: Loading },
  ];

  routes.forEach(({ name, Component }) => {
    it(`renders ${name} route with exactly one h1 and passes axe audit`, async () => {
      const { container } = render(<Component />);
      const headings = screen.getAllByRole('heading', { level: 1 });
      expect(headings).toHaveLength(1);
      await expectNoAxeViolations(container);
    });
  });

  it('renders ErrorBoundary with exactly one h1 and passes axe audit', async () => {
    const { container } = render(
      <ErrorBoundary error={new Error('Test error')} reset={() => {}} />,
    );
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    await expectNoAxeViolations(container);
  });
});
