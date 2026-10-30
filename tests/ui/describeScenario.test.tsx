import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChaosLabClient } from '@/components/chaos/ChaosLabClient';
import { scenarioChipLabel } from '@/components/chaos/DescribeScenario';
import { LiveRegionProvider } from '@/components/ui/LiveRegion';
import { buildDemoPlan } from '@/engine/demo';
import { createIdFactory } from '@/lib/id';
import { useEventsStore } from '@/store/eventsStore';
import { expectNoAxeViolations } from '../helpers/a11y';

let mockEventId = 'evt_demo';
let mockSearch = '';

vi.mock('next/navigation', () => ({
  usePathname: () => `/events/${mockEventId}/chaos`,
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ id: mockEventId }),
  useSearchParams: () => new URLSearchParams(mockSearch),
}));

function mockFetchOnce(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderPage() {
  return render(
    <LiveRegionProvider>
      <ChaosLabClient eventId={mockEventId} />
    </LiveRegionProvider>,
  );
}

describe('UI: Chaos Lab free-text disaster', () => {
  beforeEach(() => {
    mockSearch = '';
    useEventsStore.setState({ events: {}, order: [], hydrated: true });
    const demo = buildDemoPlan({
      ids: createIdFactory('describe_ui'),
      clock: () => new Date('2026-10-22T10:00:00.000Z'),
    });
    mockEventId = useEventsStore.getState().createEvent(demo.plan, { assumptions: demo.assumptions });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('labels scenarios with their parameters', () => {
    expect(scenarioChipLabel({ type: 'late_start', delayMinutes: 120 })).toContain('120 min');
    expect(scenarioChipLabel({ type: 'guest_surge', extraGuests: 30 })).toContain('+30');
    expect(scenarioChipLabel({ type: 'rain' })).toMatch(/rain/i);
  });

  it('pre-fills a story from the tour link without sending it', () => {
    const fetchMock = mockFetchOnce({});
    mockSearch = `describe=${encodeURIComponent('Heavy rain and the photographer just cancelled')}`;
    renderPage();
    expect(screen.getByLabelText('What could go wrong?')).toHaveValue('Heavy rain and the photographer just cancelled');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('asks for a description before calling the server', () => {
    const fetchMock = mockFetchOnce({});
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Simulate my scenario' }));
    expect(screen.getByText('Describe what might go wrong first.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends only the vocabulary, runs the first scenario and lets the host switch', async () => {
    const plan = useEventsStore.getState().events[mockEventId]!.plan;
    const fetchMock = mockFetchOnce({
      scenarios: [{ type: 'late_start', delayMinutes: 120 }, { type: 'guest_surge', extraGuests: 30 }],
      understood: 'Guests are stuck in traffic and 30 more are coming.',
      unsupported: null,
      mode: 'demo',
      degraded: false,
    });

    const { container } = renderPage();
    fireEvent.change(screen.getByLabelText('What could go wrong?'), {
      target: { value: 'Traffic jam, 2 hours late, 30 more guests' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Simulate my scenario' }));

    await waitFor(() => expect(screen.getByTestId('describe-outcome')).toBeInTheDocument());
    const sent = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(sent.plan).toBeUndefined();
    expect(sent.guestCount).toBe(plan.meta.guestCount);

    expect(screen.getByRole('heading', { level: 2, name: 'Result' })).toBeInTheDocument();
    const first = screen.getByRole('button', { name: /1\. Timeline running late/ });
    const second = screen.getByRole('button', { name: /2\. Guest count surge/ });
    expect(first).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(second);
    expect(second).toHaveAttribute('aria-pressed', 'true');
    expect(useEventsStore.getState().events[mockEventId]!.plan.version).toBe(plan.version);

    await expectNoAxeViolations(container);
  });

  it('shows skipped scenarios and honest unsupported notes', async () => {
    mockFetchOnce({
      scenarios: [{ type: 'vendor_cancels', category: 'fireworks' }],
      understood: 'The fireworks team cancelled and someone is unwell.',
      unsupported: 'Illness is outside what Chaos Lab can simulate.',
      mode: 'live',
      degraded: true,
    });
    renderPage();
    fireEvent.change(screen.getByLabelText('What could go wrong?'), { target: { value: 'fireworks cancelled' } });
    fireEvent.click(screen.getByRole('button', { name: 'Simulate my scenario' }));

    await waitFor(() => expect(screen.getByText(/Skipped .*fireworks/)).toBeInTheDocument());
    expect(screen.getByText('Illness is outside what Chaos Lab can simulate.')).toBeInTheDocument();
    expect(screen.getByText(/offline reader handled this/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: 'Result' })).not.toBeInTheDocument();
  });

  it('surfaces server errors without crashing', async () => {
    mockFetchOnce({ error: { code: 'ai_unavailable', message: 'Pick a problem from the list instead.' } }, 503);
    renderPage();
    fireEvent.change(screen.getByLabelText('What could go wrong?'), { target: { value: 'rain' } });
    fireEvent.click(screen.getByRole('button', { name: 'Simulate my scenario' }));
    await waitFor(() => expect(screen.getByText('Pick a problem from the list instead.')).toBeInTheDocument());
  });
});
