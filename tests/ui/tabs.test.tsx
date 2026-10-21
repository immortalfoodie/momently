import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { LinkTabs, TabList, TabPanel, Tabs, TabTrigger } from '@/components/ui/Tabs';
import { expectNoAxeViolations } from '../helpers/a11y';

describe('UI Primitive: Tabs & LinkTabs', () => {
  it('navigates with roving tabindex using Arrow, Home, and End keys', async () => {
    const user = userEvent.setup();

    const { container } = render(
      <Tabs defaultValue="one">
        <TabList aria-label="Studio Sections">
          <TabTrigger value="one">Overview</TabTrigger>
          <TabTrigger value="two">Budget</TabTrigger>
          <TabTrigger value="three">Timeline</TabTrigger>
        </TabList>
        <TabPanel value="one">Overview Content</TabPanel>
        <TabPanel value="two">Budget Content</TabPanel>
        <TabPanel value="three">Timeline Content</TabPanel>
      </Tabs>,
    );

    const tabOne = screen.getByRole('tab', { name: 'Overview' });
    const tabTwo = screen.getByRole('tab', { name: 'Budget' });
    const tabThree = screen.getByRole('tab', { name: 'Timeline' });

    // Initial state: first tab active and selected
    expect(tabOne).toHaveAttribute('aria-selected', 'true');
    expect(tabOne).toHaveAttribute('tabindex', '0');
    expect(tabTwo).toHaveAttribute('aria-selected', 'false');
    expect(tabTwo).toHaveAttribute('tabindex', '-1');

    // Only panel one is exposed
    expect(screen.getByText('Overview Content')).toBeInTheDocument();
    expect(screen.queryByText('Budget Content')).not.toBeInTheDocument();

    // Focus first tab and press ArrowRight -> moves to second tab
    tabOne.focus();
    await user.keyboard('{ArrowRight}');
    expect(tabTwo).toHaveFocus();
    expect(tabTwo).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Budget Content')).toBeInTheDocument();
    expect(screen.queryByText('Overview Content')).not.toBeInTheDocument();

    // Press End -> moves to last tab
    await user.keyboard('{End}');
    expect(tabThree).toHaveFocus();
    expect(tabThree).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Timeline Content')).toBeInTheDocument();

    // Press Home -> returns to first tab
    await user.keyboard('{Home}');
    expect(tabOne).toHaveFocus();
    expect(tabOne).toHaveAttribute('aria-selected', 'true');

    await expectNoAxeViolations(container);
  });

  it('renders LinkTabs with aria-current="page" on active item', async () => {
    const items = [
      { href: '/events/demo', label: 'Overview', isActive: true },
      { href: '/events/demo/budget', label: 'Budget', isActive: false },
    ];

    const { container } = render(
      <LinkTabs items={items} aria-label="Event sub-navigation" />,
    );

    const activeLink = screen.getByRole('link', { name: 'Overview' });
    expect(activeLink).toHaveAttribute('aria-current', 'page');

    const inactiveLink = screen.getByRole('link', { name: 'Budget' });
    expect(inactiveLink).not.toHaveAttribute('aria-current');

    await expectNoAxeViolations(container);
  });
});
