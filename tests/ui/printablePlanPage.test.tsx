import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrintablePlanClient } from '@/components/kit/PrintablePlan';
import { LiveRegionProvider } from '@/components/ui/LiveRegion';
import { buildDemoPlan } from '@/engine/demo';
import { ESTIMATE_DISCLAIMER } from '@/lib/export/planDocument';
import { createIdFactory } from '@/lib/id';
import { useEventsStore } from '@/store/eventsStore';
import { expectNoAxeViolations } from '../helpers/a11y';

let mockEventId = 'evt_demo_print';

vi.mock('next/navigation', () => ({
  usePathname: () => `/events/${mockEventId}/kit/plan`,
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ id: mockEventId }),
  useSearchParams: () => new URLSearchParams(''),
}));

const ctx = {
  ids: createIdFactory('printable_plan_test'),
  clock: () => new Date('2026-10-21T12:00:00.000Z'),
};

describe('UI: Printable Plan Page & Component (TASK 3 & 5)', () => {
  let eventId: string;
  const secretContactName = 'PRIVATE_CONTACT_SECRET_NAME_777';

  beforeEach(() => {
    vi.restoreAllMocks();
    useEventsStore.setState({ events: {}, order: [], hydrated: true });
    const demo = buildDemoPlan(ctx);
    const planWithConcept = {
      ...demo.plan,
      selectedConceptId: demo.plan.concepts[0]?.id ?? null,
    };
    eventId = useEventsStore.getState().createEvent(planWithConcept, {
      assumptions: demo.assumptions,
    });
    useEventsStore.getState().addContact(eventId, {
      id: 'c_secret',
      name: secretContactName,
      phone: '+91 98765 00000',
    });
    mockEventId = eventId;
  });

  it('renders every section, provenance as text, the estimate disclaimer, Prepared with Momently footer, omits contacts, and passes axe audit', async () => {
    const { container } = render(
      <LiveRegionProvider>
        <PrintablePlanClient eventId={eventId} />
      </LiveRegionProvider>,
    );

    expect(
      screen.getByRole('heading', { level: 2, name: 'Selected concept' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Budget by category' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Run of show' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Checklist by timeframe' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Vendor status' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Guest counts' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Top risks' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Assumptions and disclaimers' }),
    ).toBeInTheDocument();

    expect(screen.getByText(ESTIMATE_DISCLAIMER)).toBeInTheDocument();
    expect(screen.getByText('Prepared with Momently')).toBeInTheDocument();
    expect(screen.getAllByText('Estimate').length).toBeGreaterThan(0);

    // Contacts must NEVER appear in the printable plan
    expect(container.textContent).not.toContain(secretContactName);

    await expectNoAxeViolations(container);
  });
});
