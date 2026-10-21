import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CoverArt } from '@/components/ui/CoverArt';
import { PaletteSwatches } from '@/components/ui/PaletteSwatches';
import { expectNoAxeViolations } from '../helpers/a11y';

describe('UI Primitive: CoverArt & PaletteSwatches', () => {
  it('generates identical SVG markup for identical seeds and aria-hidden="true"', async () => {
    const { container: c1 } = render(
      <CoverArt seed="anniversary-mumbai-2026" />,
    );
    const { container: c2 } = render(
      <CoverArt seed="anniversary-mumbai-2026" />,
    );

    const svg1 = c1.querySelector('svg');
    const svg2 = c2.querySelector('svg');

    expect(svg1).toHaveAttribute('aria-hidden', 'true');
    expect(svg2).toHaveAttribute('aria-hidden', 'true');
    expect(svg1?.innerHTML).toBe(svg2?.innerHTML);

    await expectNoAxeViolations(c1);
  });

  it('generates different SVG markup for different seeds', () => {
    const { container: c1 } = render(
      <CoverArt seed="concept-golden-bollywood" />,
    );
    const { container: c2 } = render(
      <CoverArt seed="concept-modern-minimal" />,
    );

    const svg1 = c1.querySelector('svg');
    const svg2 = c2.querySelector('svg');

    expect(svg1?.innerHTML).not.toBe(svg2?.innerHTML);
  });

  it('PaletteSwatches exposes hex code values as text to assistive technology', async () => {
    const palette = ['#6B2D5C', '#D4A24C', '#F4EDE6'];
    const { container } = render(<PaletteSwatches palette={palette} />);

    for (const hex of palette) {
      expect(screen.getByText(hex)).toBeInTheDocument();
    }

    await expectNoAxeViolations(container);
  });
});
