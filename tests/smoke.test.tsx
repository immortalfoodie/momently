import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Home from '@/app/page';

describe('Home page smoke test', () => {
  it('renders the Momently heading', () => {
    render(<Home />);
    const heading = screen.getByRole('heading', { level: 1, name: /momently/i });
    expect(heading).toBeInTheDocument();
  });
});
