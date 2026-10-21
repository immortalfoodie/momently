import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProgressMeter } from '@/components/ui/ProgressMeter';
import { expectNoAxeViolations } from '../helpers/a11y';

describe('UI Primitive: ProgressMeter', () => {
  it('exposes correct aria attributes and displays visible text label', async () => {
    const { container } = render(
      <ProgressMeter value={75000} max={150000} min={0} />,
    );

    const meter = screen.getByRole('meter');
    expect(meter).toHaveAttribute('aria-valuenow', '75000');
    expect(meter).toHaveAttribute('aria-valuemin', '0');
    expect(meter).toHaveAttribute('aria-valuemax', '150000');
    expect(meter).toHaveAttribute('aria-valuetext', '50% of budget used');

    expect(screen.getByText(/50%/)).toBeInTheDocument();
    expect(screen.getByText('On track')).toBeInTheDocument();

    await expectNoAxeViolations(container);
  });

  it('displays warning text and icon when budget exceeds 90%', async () => {
    const { container } = render(
      <ProgressMeter value={140000} max={150000} />,
    );

    expect(screen.getByText('Near budget cap')).toBeInTheDocument();
    // Icon is present and aria-hidden
    const alertIcon = container.querySelector('svg[aria-hidden="true"]');
    expect(alertIcon).toBeInTheDocument();

    await expectNoAxeViolations(container);
  });

  it('displays danger text and icon when budget is over 100%', async () => {
    const { container } = render(
      <ProgressMeter value={160000} max={150000} />,
    );

    expect(screen.getByText('Over budget')).toBeInTheDocument();
    const alertIcon = container.querySelector('svg[aria-hidden="true"]');
    expect(alertIcon).toBeInTheDocument();

    await expectNoAxeViolations(container);
  });
});
