import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge } from '@/components/ui/Badge';
import { DecisionStatusPill } from '@/components/ui/DecisionStatusPill';
import { Money } from '@/components/ui/Money';
import { ProvenanceBadge } from '@/components/ui/ProvenanceBadge';
import { expectNoAxeViolations } from '../helpers/a11y';

describe('UI Primitives: Status Badges, Pills & Money', () => {
  it('renders all ProvenanceBadge states with descriptive text and distinct icons', async () => {
    const { container, rerender } = render(<ProvenanceBadge provenance="user" />);
    expect(screen.getByText('Your input')).toBeInTheDocument();
    expect(screen.getByLabelText('Cost source: Your input')).toBeInTheDocument();
    await expectNoAxeViolations(container);

    rerender(<ProvenanceBadge provenance="estimate" />);
    expect(screen.getByText('Estimate')).toBeInTheDocument();
    expect(screen.getByLabelText('Cost source: Estimate')).toBeInTheDocument();

    rerender(<ProvenanceBadge provenance="verified" />);
    expect(screen.getByText('Verified quote')).toBeInTheDocument();
    expect(screen.getByLabelText('Cost source: Verified quote')).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('renders all DecisionStatusPill states with text and icons', async () => {
    const states = ['locked', 'proposed', 'awaiting approval', 'approved', 'rejected'] as const;

    for (const status of states) {
      const { container } = render(<DecisionStatusPill status={status} />);
      const text = status === 'awaiting approval' ? 'Awaiting approval' : status.charAt(0).toUpperCase() + status.slice(1);
      expect(screen.getByText(text)).toBeInTheDocument();
      await expectNoAxeViolations(container);
    }
  });

  it('renders Money with formatted currency and tabular numbers', async () => {
    const { container, rerender } = render(<Money amount={150000} />);
    expect(screen.getByText('₹1,50,000')).toHaveClass('tabular-nums');
    await expectNoAxeViolations(container);

    rerender(<Money amount={150000} compact />);
    expect(screen.getByText('₹1.5 lakh')).toHaveClass('tabular-nums');
  });

  it('renders Badge tones with text content', async () => {
    const { container } = render(
      <div>
        <Badge tone="success">Confirmed</Badge>
        <Badge tone="warning">Pending Review</Badge>
        <Badge tone="danger">Hard Cap Exceeded</Badge>
      </div>,
    );

    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    expect(screen.getByText('Pending Review')).toBeInTheDocument();
    expect(screen.getByText('Hard Cap Exceeded')).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });
});
