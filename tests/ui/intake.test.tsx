import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NewEventPage from '@/app/new/page';
import { LiveRegionProvider } from '@/components/ui/LiveRegion';
import { buildDemoPlan } from '@/engine/demo';
import * as apiClient from '@/lib/apiClient';
import { useEventsStore } from '@/store';
import { expectNoAxeViolations } from '../helpers/a11y';

const mockPush = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => '/new',
  useParams: () => ({}),
}));

vi.mock('@/lib/apiClient', () => ({
  submitIntake: vi.fn(),
}));

describe('New Event Intake Flow (/new)', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockSearchParams = new URLSearchParams();
    vi.mocked(apiClient.submitIntake).mockReset();
    useEventsStore.setState({
      events: {},
      order: [],
      hydrated: true,
      notice: null,
      outcomes: {},
      chatDraft: '',
    });
  });

  it('renders form with sample chips and character counter, passing axe audit', async () => {
    const { container } = render(
      <LiveRegionProvider>
        <NewEventPage />
      </LiveRegionProvider>,
    );

    expect(screen.getByLabelText(/describe your celebration/i)).toBeInTheDocument();
    expect(screen.getByText(/0 \/ 1500/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: "Parents' 25th Anniversary" })).toBeInTheDocument();

    await expectNoAxeViolations(container);
  });

  it('fills textarea when a sample chip is clicked and updates character counter', () => {
    render(
      <LiveRegionProvider>
        <NewEventPage />
      </LiveRegionProvider>,
    );

    const chip = screen.getByRole('button', { name: '10th Birthday Party' });
    fireEvent.click(chip);

    const textarea = screen.getByLabelText(/describe your celebration/i) as HTMLTextAreaElement;
    expect(textarea.value).toContain('10th birthday party');
    expect(screen.getByText(new RegExp(`${textarea.value.length} \\/ 1500`))).toBeInTheDocument();
  });

  it('pre-selects chip when ?type=<type> search param is present', () => {
    mockSearchParams = new URLSearchParams('type=birthday');

    render(
      <LiveRegionProvider>
        <NewEventPage />
      </LiveRegionProvider>,
    );

    const textarea = screen.getByLabelText(/describe your celebration/i) as HTMLTextAreaElement;
    expect(textarea.value).toContain('10th birthday party');
  });

  it('successfully submits intake, creates event in store, and navigates', async () => {
    const ctx = { ids: () => 'evt-1', clock: () => new Date('2026-10-22') };
    const demo = buildDemoPlan(ctx);

    vi.mocked(apiClient.submitIntake).mockResolvedValue({
      ok: true,
      value: {
        plan: demo.plan,
        fit: demo.fit,
        assumptions: ['Standard guest buffer applied'],
        missingInfo: [],
        mode: 'demo',
        degraded: false,
        notes: [],
      },
    });

    render(
      <LiveRegionProvider>
        <NewEventPage />
      </LiveRegionProvider>,
    );

    const chip = screen.getByRole('button', { name: "Parents' 25th Anniversary" });
    fireEvent.click(chip);

    const submitBtn = screen.getByRole('button', { name: /synthesize plan/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(`/events/${demo.plan.id}/concepts`);
    });

    expect(useEventsStore.getState().order).toContain(demo.plan.id);
  });

  it('displays rate-limited error with retryAfterSeconds and handles network error', async () => {
    vi.mocked(apiClient.submitIntake).mockResolvedValueOnce({
      ok: false,
      error: { code: 'rate_limited', message: 'Too many requests', retryAfterSeconds: 45 },
    });

    render(
      <LiveRegionProvider>
        <NewEventPage />
      </LiveRegionProvider>,
    );

    const chip = screen.getByRole('button', { name: "Parents' 25th Anniversary" });
    fireEvent.click(chip);

    const submitBtn = screen.getByRole('button', { name: /synthesize plan/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/wait 45 seconds before trying again/i)).toBeInTheDocument();
    });

    // Now test network failure on retry
    vi.mocked(apiClient.submitIntake).mockResolvedValueOnce({
      ok: false,
      error: { code: 'network', message: 'Failed to connect' },
    });

    const retryBtn = screen.getByRole('button', { name: 'Retry' });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText(/Network connection failure/i)).toBeInTheDocument();
    });
  });

  it('ignores double submissions while in flight', async () => {
    let resolveIntake: (val: unknown) => void = () => {};
    const intakePromise = new Promise((resolve) => {
      resolveIntake = resolve;
    });

    vi.mocked(apiClient.submitIntake).mockReturnValue(
      intakePromise as unknown as ReturnType<typeof apiClient.submitIntake>,
    );

    render(
      <LiveRegionProvider>
        <NewEventPage />
      </LiveRegionProvider>,
    );

    const chip = screen.getByRole('button', { name: "Parents' 25th Anniversary" });
    fireEvent.click(chip);

    const form = screen.getByRole('button', { name: /synthesize plan/i }).closest('form')!;
    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(apiClient.submitIntake).toHaveBeenCalledTimes(1);

    const ctx = { ids: () => 'evt-1', clock: () => new Date('2026-10-22') };
    const demo = buildDemoPlan(ctx);
    resolveIntake({
      ok: true,
      value: {
        plan: demo.plan,
        fit: demo.fit,
        assumptions: [],
        missingInfo: [],
        mode: 'demo',
        degraded: false,
        notes: [],
      },
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledTimes(1);
    });
  });
});
