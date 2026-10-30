import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BudgetClient } from '@/components/budget/BudgetClient';
import { EventContextProvider } from '@/components/events';
import { LiveRegionProvider } from '@/components/ui/LiveRegion';
import { buildDemoPlan } from '@/engine/demo';
import { engineContext } from '@/store/engineContext';
import { useEventsStore } from '@/store/eventsStore';
import { useEvent, useEventDerived } from '@/store/selectors';
import { expectNoAxeViolations } from '../helpers/a11y';

vi.mock('next/navigation', () => ({ useParams: () => ({}) }));

function Wrapper({ eventId }: { eventId: string }) {
  const event = useEvent(eventId);
  const derived = useEventDerived(eventId);
  if (!event || !derived) return null;
  return (
    <LiveRegionProvider>
      <EventContextProvider value={{ event, plan: event.plan, derived }}>
        <BudgetClient eventId={eventId} />
      </EventContextProvider>
    </LiveRegionProvider>
  );
}

function stubFetch(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('UI: Explain my budget', () => {
  let eventId: string;

  beforeEach(() => {
    useEventsStore.setState({ events: {}, order: [], hydrated: true });
    eventId = useEventsStore.getState().createEvent(buildDemoPlan(engineContext).plan);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends engine facts to the narrator and shows the explanation', async () => {
    const fetchMock = stubFetch({ text: 'Your plan is on track.', highlights: ['Total budget: ₹1,40,000'], degraded: false });
    const { container } = render(<Wrapper eventId={eventId} />);

    fireEvent.click(screen.getByRole('button', { name: 'Explain my budget' }));

    const region = await screen.findByRole('region', { name: 'Budget in plain words' });
    expect(region).toHaveTextContent('Your plan is on track.');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/narrate');
    const sent = JSON.parse(init.body as string);
    expect(sent.purpose).toBe('budget_explainer');
    expect(typeof sent.facts.totalCost).toBe('number');
    await expectNoAxeViolations(container);
  });

  it('keeps numbers intact and shows a gentle error when narration fails', async () => {
    stubFetch({ error: { code: 'ai_unavailable', message: 'down' } }, 503);
    render(<Wrapper eventId={eventId} />);
    fireEvent.click(screen.getByRole('button', { name: 'Explain my budget' }));
    await waitFor(() => expect(screen.getByText(/numbers above are unaffected/)).toBeInTheDocument());
  });
});
