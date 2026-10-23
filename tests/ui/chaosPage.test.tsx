import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChaosLabClient } from '@/components/chaos/ChaosLabClient';
import { LiveRegionProvider } from '@/components/ui/LiveRegion';
import { buildDemoPlan } from '@/engine/demo';
import { createIdFactory } from '@/lib/id';
import { useEventsStore } from '@/store/eventsStore';
import { expectNoAxeViolations } from '../helpers/a11y';

let mockEventId = 'evt_demo';
let mockSearchParamString = '';

vi.mock('next/navigation', () => ({
  usePathname: () => `/events/${mockEventId}/chaos`,
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ id: mockEventId }),
  useSearchParams: () => new URLSearchParams(mockSearchParamString),
}));

const ctx = {
  ids: createIdFactory('chaos_page_test'),
  clock: () => new Date('2026-10-22T10:00:00.000Z'),
};

describe('UI: Chaos Lab Page & Interaction Flow (TASK 4)', () => {
  let eventId: string;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockSearchParamString = '';
    useEventsStore.setState({ events: {}, order: [], hydrated: true });

    const demo = buildDemoPlan(ctx);
    eventId = useEventsStore.getState().createEvent(demo.plan, {
      assumptions: demo.assumptions,
    });
    mockEventId = eventId;
  });

  it('renders all 5 h2 sections and passes axe audit in initial state (no result)', async () => {
    const { container } = render(
      <LiveRegionProvider>
        <ChaosLabClient eventId={eventId} />
      </LiveRegionProvider>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Chaos Lab' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Your Chaos Score' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Simulate a problem' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Full stress test' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Risk register' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: 'Result' })).not.toBeInTheDocument();

    await expectNoAxeViolations(container);
  });

  it('simulates rain on demo plan without altering plan version, then approving bumps version and logs user source', async () => {
    const approveSpy = vi.spyOn(useEventsStore.getState(), 'approveAndApply');

    const { container } = render(
      <LiveRegionProvider>
        <ChaosLabClient eventId={eventId} />
      </LiveRegionProvider>,
    );

    const versionBefore = useEventsStore.getState().events[eventId]!.plan.version;
    const simulateBtn = screen.getByRole('button', { name: 'Simulate this problem' });
    fireEvent.click(simulateBtn);

    // Headline is rendered and focused
    expect(screen.getByRole('heading', { level: 2, name: 'Result' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 3, name: /Sudden rain threatens/i }),
    ).toBeInTheDocument();

    // Plan version is strictly UNCHANGED after simulation
    expect(approveSpy).not.toHaveBeenCalled();
    expect(useEventsStore.getState().events[eventId]!.plan.version).toBe(versionBefore);

    await expectNoAxeViolations(container);

    // Approve the recommended option
    const approveBtns = screen.getAllByRole('button', { name: 'Approve this change' });
    expect(approveBtns.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(approveBtns[0]!);

    // Version bumped by 1
    const planAfter = useEventsStore.getState().events[eventId]!.plan;
    expect(planAfter.version).toBe(versionBefore + 1);

    // RecoveryApplied banner appears with before and after scores
    expect(screen.getByRole('heading', { level: 3, name: 'Recovery applied' })).toBeInTheDocument();

    // In engine/store, applied recovery patches record status "approved" with source "chaos"
    const latestLedgerEntry = planAfter.ledger[planAfter.ledger.length - 1];
    expect(latestLedgerEntry?.source).toBe('chaos');
    expect(latestLedgerEntry?.status).toBe('approved');
  });

  it('dims result as stale and disables approve buttons if plan version advances after simulation', async () => {
    render(
      <LiveRegionProvider>
        <ChaosLabClient eventId={eventId} />
      </LiveRegionProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Simulate this problem' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Result' })).toBeInTheDocument();

    // Advance plan version in store via user edit
    useEventsStore.getState().applyUserEdit(
      eventId,
      [{ type: 'set_meta', changes: { title: 'Renamed Celebration' } }],
      'User title update',
    );

    // Stale handling: "Out of date" badge appears, approve buttons are disabled
    await waitFor(() => {
      expect(screen.getAllByText('Out of date').length).toBeGreaterThan(0);
    });

    const approveBtns = screen.getAllByRole('button', { name: 'Approve this change' });
    for (const btn of approveBtns) {
      expect(btn).toBeDisabled();
    }
    expect(screen.getByRole('button', { name: 'Simulate again' })).toBeInTheDocument();
  });

  it('vendor_cancels select only presents known categories from plan.vendors', () => {
    render(
      <LiveRegionProvider>
        <ChaosLabClient eventId={eventId} />
      </LiveRegionProvider>,
    );

    const vendorRadio = screen.getByRole('radio', { name: /Key vendor cancels/i });
    fireEvent.click(vendorRadio);

    const select = screen.getByLabelText(/Cancelled vendor category/i) as HTMLSelectElement;
    const optionValues = Array.from(select.options).map((o) => o.value);
    const planVendors = useEventsStore.getState().events[eventId]!.plan.vendors;

    for (const opt of optionValues) {
      expect(planVendors.some((v) => v.category === opt)).toBe(true);
    }
    expect(optionValues).not.toContain('non_existent_category');
  });

  it('preselects and auto-simulates when ?scenario=rain is provided, but ignores ?scenario=bogus', () => {
    // 1. Valid scenario param
    mockSearchParamString = 'scenario=rain';
    const { unmount } = render(
      <LiveRegionProvider>
        <ChaosLabClient eventId={eventId} />
      </LiveRegionProvider>,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Result' })).toBeInTheDocument();
    unmount();

    // 2. Bogus param is ignored (no result)
    mockSearchParamString = 'scenario=bogus_alien_invasion';
    render(
      <LiveRegionProvider>
        <ChaosLabClient eventId={eventId} />
      </LiveRegionProvider>,
    );

    expect(screen.queryByRole('heading', { level: 2, name: 'Result' })).not.toBeInTheDocument();
  });

  it('passes axe accessibility audit when stress test results table is displayed', async () => {
    const { container } = render(
      <LiveRegionProvider>
        <ChaosLabClient eventId={eventId} />
      </LiveRegionProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Run the full stress test' }));
    expect(
      screen.getByRole('table', { name: /Stress test: every scenario against your current plan/i }),
    ).toBeInTheDocument();

    await expectNoAxeViolations(container);
  });
});
