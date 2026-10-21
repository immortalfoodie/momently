import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from '@/components/shell/AppShell';
import { SkipLink } from '@/components/ui/SkipLink';
import { expectNoAxeViolations } from '../helpers/a11y';

// Mock next/navigation
const mockUsePathname = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
  useParams: () => ({ id: 'demo' }),
}));

describe('App Shell Landmarks & Navigation', () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue('/');
  });

  it('exposes all four required semantic landmarks (banner, navigation, main, complementary)', async () => {
    const { container } = render(
      <div>
        <SkipLink />
        <AppShell>
          <h1>Test Workspace</h1>
          <p>Body</p>
        </AppShell>
      </div>,
    );

    // 1. banner (<header>)
    expect(screen.getByRole('banner')).toBeInTheDocument();

    // 2. navigation named Main (<nav aria-label="Main">)
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();

    // 3. main (<main id="main-content">)
    const main = screen.getByRole('main');
    expect(main).toBeInTheDocument();
    expect(main).toHaveAttribute('id', 'main-content');

    // 4. complementary named Assistant (<aside aria-label="Assistant">)
    expect(screen.getByRole('complementary', { name: 'Assistant' })).toBeInTheDocument();

    await expectNoAxeViolations(container);
  });

  it('provides SkipLink as the first focusable link targeting main-content', () => {
    render(
      <div>
        <SkipLink />
        <AppShell>
          <h1>Workspace</h1>
        </AppShell>
      </div>,
    );

    const links = screen.getAllByRole('link');
    const firstLink = links[0];
    expect(firstLink).toHaveAttribute('href', '#main-content');
    expect(firstLink).toHaveTextContent(/skip to main content/i);
  });

  it('conditionally renders "This event" navigation group only on event routes', () => {
    // 1. On Home route ('/'): No "This event" group
    mockUsePathname.mockReturnValue('/');
    const { rerender } = render(
      <AppShell>
        <h1>Home</h1>
      </AppShell>,
    );
    expect(screen.queryByTestId('event-nav-group')).not.toBeInTheDocument();

    // 2. On Event route ('/events/demo/budget'): "This event" group appears
    mockUsePathname.mockReturnValue('/events/demo/budget');
    rerender(
      <AppShell>
        <h1>Budget</h1>
      </AppShell>,
    );
    expect(screen.getAllByTestId('event-nav-group').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Budget' })[0]).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});
