import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button, LinkButton } from '@/components/ui/Button';
import { expectNoAxeViolations } from '../helpers/a11y';

describe('UI Primitive: Button & LinkButton', () => {
  it('renders primary, secondary, ghost, and danger variants', async () => {
    const { container, rerender } = render(<Button variant="primary">Primary</Button>);
    expect(screen.getByRole('button', { name: 'Primary' })).toBeInTheDocument();
    await expectNoAxeViolations(container);

    rerender(<Button variant="secondary">Secondary</Button>);
    expect(screen.getByRole('button', { name: 'Secondary' })).toBeInTheDocument();

    rerender(<Button variant="ghost">Ghost</Button>);
    expect(screen.getByRole('button', { name: 'Ghost' })).toBeInTheDocument();

    rerender(<Button variant="danger">Danger</Button>);
    expect(screen.getByRole('button', { name: 'Danger' })).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('sets aria-busy and disables interaction when loading', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    const { container } = render(
      <Button loading onClick={handleClick}>
        Save Changes
      </Button>,
    );

    const button = screen.getByRole('button', { name: /save changes/i });
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toBeDisabled();

    await user.click(button);
    expect(handleClick).not.toHaveBeenCalled();
    await expectNoAxeViolations(container);
  });

  it('activates on keyboard Enter and Space keys', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<Button onClick={handleClick}>Keyboard</Button>);
    const button = screen.getByRole('button', { name: 'Keyboard' });

    button.focus();
    expect(button).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(handleClick).toHaveBeenCalledTimes(1);

    await user.keyboard(' ');
    expect(handleClick).toHaveBeenCalledTimes(2);
  });

  it('renders LinkButton with semantic anchor element', async () => {
    const { container } = render(
      <LinkButton href="/events/demo" variant="primary">
        View Demo
      </LinkButton>,
    );

    const link = screen.getByRole('link', { name: 'View Demo' });
    expect(link).toHaveAttribute('href', '/events/demo');
    await expectNoAxeViolations(container);
  });
});
