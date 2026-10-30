import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Header } from '@/components/shell/Header';
import * as apiClient from '@/lib/apiClient';
import { expectNoAxeViolations } from '../helpers/a11y';

vi.mock('@/lib/apiClient', () => ({
  fetchHealth: vi.fn(),
}));

describe('Header & Health Badge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render "Demo mode" badge when fetchHealth reports demo mode', async () => {
    vi.mocked(apiClient.fetchHealth).mockResolvedValue({
      ok: true,
      value: { mode: 'demo' },
    });

    const { container } = render(<Header />);

    await waitFor(() => {
      expect(screen.queryByText('Demo mode')).not.toBeInTheDocument();
    });

    expect(screen.queryByText('Demo mode')).not.toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('renders "Live AI" badge when fetchHealth reports live mode', async () => {
    vi.mocked(apiClient.fetchHealth).mockResolvedValue({
      ok: true,
      value: { mode: 'live' },
    });

    const { container } = render(<Header />);

    await waitFor(() => {
      expect(screen.getByText('Live AI')).toBeInTheDocument();
    });

    expect(screen.queryByText('Demo mode')).not.toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('renders "Offline" badge when fetchHealth fails or network is down', async () => {
    vi.mocked(apiClient.fetchHealth).mockResolvedValue({
      ok: false,
      error: {
        code: 'network',
        message: 'Failed to fetch',
      },
    });

    const { container } = render(<Header />);

    await waitFor(() => {
      expect(screen.getByText('Offline')).toBeInTheDocument();
    });

    await expectNoAxeViolations(container);
  });

  it('calls onToggleMobileNav when mobile menu button is pressed', () => {
    vi.mocked(apiClient.fetchHealth).mockResolvedValue({
      ok: true,
      value: { mode: 'demo' },
    });

    const onToggle = vi.fn();
    render(<Header onToggleMobileNav={onToggle} />);

    const menuButton = screen.getByRole('button', { name: 'Open navigation menu' });
    menuButton.click();
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
