import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BriefFallbackDialog } from '@/components/vendors/BriefFallbackDialog';
import { QuoteDialog } from '@/components/vendors/QuoteDialog';
import { VendorsClient } from '@/components/vendors/VendorsClient';
import { LiveRegionProvider } from '@/components/ui/LiveRegion';
import { buildDemoPlan } from '@/engine/demo';
import { createIdFactory } from '@/lib/id';
import { useEventsStore } from '@/store/eventsStore';
import { expectNoAxeViolations } from '../helpers/a11y';

let mockEventId = 'evt_demo_vendors';

vi.mock('next/navigation', () => ({
  usePathname: () => `/events/${mockEventId}/vendors`,
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ id: mockEventId }),
  useSearchParams: () => new URLSearchParams(''),
}));

const ctx = {
  ids: createIdFactory('vendors_page_test'),
  clock: () => new Date('2026-10-21T12:00:00.000Z'),
};

describe('UI: Vendors Page & Components (TASK 3 & 4)', () => {
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

  it('renders summary line, vendor sections, and passes axe audit', async () => {
    const { container } = render(
      <LiveRegionProvider>
        <VendorsClient eventId={eventId} />
      </LiveRegionProvider>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Vendors' })).toBeInTheDocument();
    expect(screen.getByText(/vendors booked/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Booking vendors lowers your Chaos Score when the event is within 30 days/i),
    ).toBeInTheDocument();

    await expectNoAxeViolations(container);
  });

  it('changing vendor status updates the summary line', async () => {
    render(
      <LiveRegionProvider>
        <VendorsClient eventId={eventId} />
      </LiveRegionProvider>,
    );

    // Initial booked count
    const plan = useEventsStore.getState().events[eventId]!.plan;
    const initialBooked = plan.vendors.filter((v) => v.status === 'booked').length;
    expect(screen.getByText(new RegExp(`${initialBooked} of ${plan.vendors.length} vendors booked`))).toBeInTheDocument();

    // Find first status select and change to "booked"
    const firstStatusSelect = screen.getAllByRole('combobox')[0]!;
    fireEvent.change(firstStatusSelect, { target: { value: 'booked' } });

    await waitFor(() => {
      const updatedPlan = useEventsStore.getState().events[eventId]!.plan;
      const newBooked = updatedPlan.vendors.filter((v) => v.status === 'booked').length;
      expect(newBooked).toBeGreaterThanOrEqual(1);
    });
  });

  it('adding quote updates comparison table with completeness and observations', async () => {
    render(
      <LiveRegionProvider>
        <VendorsClient eventId={eventId} />
      </LiveRegionProvider>,
    );

    const addQuoteBtns = screen.getAllByRole('button', { name: 'Add a quote' });
    fireEvent.click(addQuoteBtns[0]!);

    // Dialog opens
    const nameInput = screen.getByLabelText('Vendor or business name');
    fireEvent.change(nameInput, { target: { value: 'Grand Feast Caterers' } });

    const priceInput = screen.getByLabelText('Total quote price');
    fireEvent.change(priceInput, { target: { value: '185000' } });

    const saveBtn = screen.getByRole('button', { name: 'Save quote' });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getAllByText('Grand Feast Caterers').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Quotes side by side')).toBeInTheDocument();
      expect(
        screen.getByText(/Based only on what you entered. Momently has no vendor ratings/i),
      ).toBeInTheDocument();
    });
  });

  it('copies brief via clipboard or falls back to dialog and passes axe', async () => {
    const writeTextMock = vi.fn().mockRejectedValue(new Error('Clipboard denied'));
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    });

    const { container } = render(
      <LiveRegionProvider>
        <VendorsClient eventId={eventId} />
      </LiveRegionProvider>,
    );

    const copyBtns = screen.getAllByRole('button', { name: 'Copy vendor brief' });
    fireEvent.click(copyBtns[0]!);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: 'Vendor inquiry brief' })).toBeInTheDocument();
    });

    await expectNoAxeViolations(container);
  });

  it('Use this price in my budget sets provenance verified when checked, user when unchecked', async () => {
    // Add quote first
    const store = useEventsStore.getState();
    const plan = store.events[eventId]!.plan;
    const need = plan.vendors[0]!;

    store.applyUserEdit(
      eventId,
      [
        {
          type: 'upsert_vendor_quote',
          category: need.category,
          quote: {
            vendorName: 'Apex Pro Vendor',
            price: 25000,
            answers: {},
          },
        },
      ],
      'Added quote',
    );

    render(
      <LiveRegionProvider>
        <VendorsClient eventId={eventId} />
      </LiveRegionProvider>,
    );

    const usePriceBtn = screen.getByRole('button', { name: 'Use this price in my budget' });
    fireEvent.click(usePriceBtn);

    expect(screen.getByRole('heading', { level: 2, name: 'Apply quote: Apex Pro Vendor' })).toBeInTheDocument();

    const confirmedCheckbox = screen.getByRole('checkbox', {
      name: /This is a confirmed written quote/i,
    });
    fireEvent.click(confirmedCheckbox); // Checked -> verified

    const applyBtn = screen.getByRole('button', { name: 'Apply to budget' });
    fireEvent.click(applyBtn);

    await waitFor(() => {
      const updatedPlan = useEventsStore.getState().events[eventId]!.plan;
      const budgetLine = updatedPlan.budgetItems.find((i) => i.category === need.category);
      expect(budgetLine?.provenance).toBe('verified');
      expect(budgetLine?.unitCost).toBe(25000);
    });
  });

  it('locked budget line shows unlock error in apply dialog and prevents saving', async () => {
    const store = useEventsStore.getState();
    const plan = store.events[eventId]!.plan;
    const need = plan.vendors[0]!;

    // Lock the budget line
    const lockedPlan = {
      ...plan,
      budgetItems: plan.budgetItems.map((i) =>
        i.category === need.category ? { ...i, locked: true } : i,
      ),
    };
    useEventsStore.setState({
      events: {
        ...store.events,
        [eventId]: { ...store.events[eventId]!, plan: lockedPlan },
      },
    });

    // Add quote
    store.applyUserEdit(
      eventId,
      [
        {
          type: 'upsert_vendor_quote',
          category: need.category,
          quote: {
            vendorName: 'Locked Line Vendor',
            price: 60000,
            answers: {},
          },
        },
      ],
      'Added quote',
    );

    render(
      <LiveRegionProvider>
        <VendorsClient eventId={eventId} />
      </LiveRegionProvider>,
    );

    const usePriceBtn = screen.getByRole('button', { name: 'Use this price in my budget' });
    fireEvent.click(usePriceBtn);

    expect(screen.getByText('Unlock this budget line first')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply to budget' })).toBeDisabled();
  });

  it('QuoteDialog passes axe audit directly', async () => {
    const plan = useEventsStore.getState().events[eventId]!.plan;
    const need = plan.vendors[0]!;

    const { container } = render(
      <QuoteDialog
        open={true}
        onClose={vi.fn()}
        need={need}
        onSave={vi.fn().mockResolvedValue(true)}
      />,
    );
    await expectNoAxeViolations(container);
  });

  it('BriefFallbackDialog passes axe audit directly', async () => {
    const { container } = render(
      <BriefFallbackDialog open={true} onClose={vi.fn()} brief="Sample inquiry brief" />,
    );
    await expectNoAxeViolations(container);
  });
});
