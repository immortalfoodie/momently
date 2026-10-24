import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KitClient } from '@/components/kit/KitClient';
import { LiveRegionProvider } from '@/components/ui/LiveRegion';
import { buildDemoPlan } from '@/engine/demo';
import * as downloadModule from '@/lib/export/download';
import { createIdFactory } from '@/lib/id';
import { useEventsStore } from '@/store/eventsStore';
import { expectNoAxeViolations } from '../helpers/a11y';

let mockEventId = 'evt_demo_kit';

vi.mock('next/navigation', () => ({
  usePathname: () => `/events/${mockEventId}/kit`,
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ id: mockEventId }),
  useSearchParams: () => new URLSearchParams(''),
}));

const ctx = {
  ids: createIdFactory('kit_page_test'),
  clock: () => new Date('2026-10-21T12:00:00.000Z'),
};

describe('UI: Event Kit Page & Components (TASK 3 & 5)', () => {
  let eventId: string;

  beforeEach(() => {
    vi.restoreAllMocks();
    useEventsStore.setState({ events: {}, order: [], hydrated: true });
    const demo = buildDemoPlan(ctx);
    eventId = useEventsStore.getState().createEvent(demo.plan, {
      assumptions: demo.assumptions,
    });
    mockEventId = eventId;
  });

  it('renders Event kit sections, captioned quantities table, privacy note, and passes axe audit', async () => {
    const { container } = render(
      <LiveRegionProvider>
        <KitClient eventId={eventId} />
      </LiveRegionProvider>,
    );

    expect(screen.getByRole('heading', { level: 1, name: /Event kit/i })).toBeInTheDocument();
    expect(
      screen.getByText(/Quantities to share with your caterer and decorator/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Momently never sends these anywhere. They stay on your device unless you share them./i,
      ),
    ).toBeInTheDocument();

    await expectNoAxeViolations(container);
  });

  it('triggers budget CSV, checklist CSV, and ICS downloads with expected filenames, mime types, and content sniffs', async () => {
    const downloadSpy = vi
      .spyOn(downloadModule, 'downloadText')
      .mockImplementation((filename) => ({ ok: true, value: { filename } }));

    render(
      <LiveRegionProvider>
        <KitClient eventId={eventId} />
      </LiveRegionProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Download budget CSV' }));
    expect(downloadSpy).toHaveBeenCalledWith(
      expect.stringMatching(/-budget\.csv$/),
      'text/csv;charset=utf-8',
      expect.stringContaining('Unit price (INR)'),
      { bom: true },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Download checklist CSV' }));
    expect(downloadSpy).toHaveBeenCalledWith(
      expect.stringMatching(/-checklist\.csv$/),
      'text/csv;charset=utf-8',
      expect.stringContaining('Days before event'),
      { bom: true },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Download calendar (.ics)' }));
    expect(downloadSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\.ics$/),
      'text/calendar;charset=utf-8',
      expect.stringContaining('BEGIN:VCALENDAR'),
    );
  });

  it('disables the ICS button with a visible reason when the plan has no date', () => {
    const store = useEventsStore.getState();
    const current = store.events[eventId]!;
    useEventsStore.setState({
      events: {
        ...store.events,
        [eventId]: {
          ...current,
          plan: {
            ...current.plan,
            meta: { ...current.plan.meta, dateIso: undefined },
          },
        },
      },
    });

    render(
      <LiveRegionProvider>
        <KitClient eventId={eventId} />
      </LiveRegionProvider>,
    );

    expect(screen.getByText('Set an event date first')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Download calendar (.ics)' }),
    ).toBeDisabled();
  });

  it('copies invitation text and vendor briefs, or opens fallback dialog when clipboard rejects and passes axe', async () => {
    const writeTextMock = vi.fn().mockRejectedValue(new Error('Clipboard blocked'));
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    });

    const { container } = render(
      <LiveRegionProvider>
        <KitClient eventId={eventId} />
      </LiveRegionProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Copy text' }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    await expectNoAxeViolations(container);
  });
});
