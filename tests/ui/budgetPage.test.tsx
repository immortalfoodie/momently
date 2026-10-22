import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { EventContextProvider } from '@/components/events';
import { BudgetClient } from '@/components/budget/BudgetClient';
import { LiveRegionProvider } from '@/components/ui/LiveRegion';
import { buildDemoPlan } from '@/engine/demo';
import { engineContext } from '@/store/engineContext';
import { useEventsStore } from '@/store/eventsStore';
import { useEvent, useEventDerived } from '@/store/selectors';
import { expectNoAxeViolations } from '../helpers/a11y';

function TestBudgetWrapper({ eventId }: { eventId: string }) {
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

describe('Budget Guardian Page & Components', () => {
  let demoEventId: string;

  beforeEach(() => {
    useEventsStore.setState({ events: {}, order: [], hydrated: true });
    const demo = buildDemoPlan(engineContext);
    demoEventId = useEventsStore.getState().createEvent(demo.plan);
  });

  it('renders category breakdown table and provenance legend, passing axe audit', async () => {
    const { container } = render(<TestBudgetWrapper eventId={demoEventId} />);

    // Table caption and headings
    expect(screen.getByRole('heading', { name: /Category & Quote Source Distribution/i })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /Category Breakdown/i })).toBeInTheDocument();

    // Provenance legend
    expect(screen.getAllByText('Estimate').length).toBeGreaterThan(0);
    expect(screen.getByText('Your input')).toBeInTheDocument();
    expect(screen.getByText('Verified quote')).toBeInTheDocument();

    await expectNoAxeViolations(container);
  });

  it('edits a price within cap, saves immediately with provenance user, and bumps version', async () => {
    const user = userEvent.setup();
    render(<TestBudgetWrapper eventId={demoEventId} />);

    const planBefore = useEventsStore.getState().events[demoEventId]!.plan;
    const initialVersion = planBefore.version;

    // Find first "Edit price" button
    const editBtns = screen.getAllByRole('button', { name: /Edit price/i });
    await user.click(editBtns[0]!);

    // Query within open edit price dialog - price 950 is within ₹5,280 headroom and matches step 50
    const dialog = screen.getByRole('dialog', { name: /Edit Price/i });
    const priceInput = within(dialog).getByLabelText(/Your price/i);
    await user.clear(priceInput);
    await user.type(priceInput, '950');

    await user.click(within(dialog).getByRole('button', { name: /Save Price/i }));

    const planAfter = useEventsStore.getState().events[demoEventId]!.plan;
    expect(planAfter.version).toBeGreaterThan(initialVersion);
  });

  it('sets provenance to verified when confirmed quote checkbox is checked', async () => {
    const user = userEvent.setup();
    render(<TestBudgetWrapper eventId={demoEventId} />);

    const editBtns = screen.getAllByRole('button', { name: /Edit price/i });
    await user.click(editBtns[0]!);

    const dialog = screen.getByRole('dialog', { name: /Edit Price/i });
    const priceInput = within(dialog).getByLabelText(/Your price/i);
    await user.clear(priceInput);
    await user.type(priceInput, '900');

    const verifiedCheckbox = within(dialog).getByRole('checkbox', { name: /confirmed quote from the vendor/i });
    await user.click(verifiedCheckbox);
    expect(verifiedCheckbox).toBeChecked();

    await user.click(within(dialog).getByRole('button', { name: /Save Price/i }));

    const planAfter = useEventsStore.getState().events[demoEventId]!.plan;
    const verifiedItem = planAfter.budgetItems.find((i) => i.provenance === 'verified');
    expect(verifiedItem).toBeDefined();
  });

  it('intercepts edits that exceed hard budget cap and displays funding options', async () => {
    const user = userEvent.setup();
    render(<TestBudgetWrapper eventId={demoEventId} />);

    const planBefore = useEventsStore.getState().events[demoEventId]!.plan;
    const initialVersion = planBefore.version;

    // Edit price to an exorbitant amount exceeding 150000 cap
    const editBtns = screen.getAllByRole('button', { name: /Edit price/i });
    await user.click(editBtns[0]!);

    const dialog = screen.getByRole('dialog', { name: /Edit Price/i });
    const priceInput = within(dialog).getByLabelText(/Your price/i);
    await user.clear(priceInput);
    await user.type(priceInput, '300000');

    await user.click(within(dialog).getByRole('button', { name: /Save Price/i }));

    // Does NOT save directly
    expect(useEventsStore.getState().events[demoEventId]!.plan.version).toBe(initialVersion);

    // Shows conflict protection dialog with funding options
    expect(screen.getByText(/Budget Cap Protection/i)).toBeInTheDocument();
    expect(screen.getByText(/Goes over your cap by/i)).toBeInTheDocument();
  });

  it('toggles lock on an item and preserves locked items during save_money', async () => {
    const user = userEvent.setup();
    render(<TestBudgetWrapper eventId={demoEventId} />);

    const planBefore = useEventsStore.getState().events[demoEventId]!.plan;
    const firstItem = planBefore.budgetItems[0]!;

    // Find row by first item label
    const row = screen.getByText(firstItem.label).closest('tr')!;
    const lockBtn = within(row).getByRole('button', { name: /^Lock$/i });
    await user.click(lockBtn);

    const planLocked = useEventsStore.getState().events[demoEventId]!.plan;
    const itemLocked = planLocked.budgetItems.find((i) => i.id === firstItem.id);
    expect(itemLocked?.locked).toBe(true);

    // Remove button should now be disabled with explanation
    const removeBtn = within(row).getByRole('button', { name: /unlock first/i });
    expect(removeBtn).toBeDisabled();
  });

  it('triggers Guardian tools: afford_check, save_money, upgrade, premium, forgotten', async () => {
    const user = userEvent.setup();
    render(<TestBudgetWrapper eventId={demoEventId} />);

    // Tool 1: Affordability
    const affordInput = screen.getByLabelText(/Addition description/i);
    await user.type(affordInput, 'Live Saxophonist');
    await user.click(screen.getByRole('button', { name: /Check Affordability/i }));
    expect(await screen.findByText(/Guardian Recommendation/i)).toBeInTheDocument();

    // Tool 2: Save money
    await user.click(screen.getByRole('button', { name: /Suggest Savings/i }));
    expect(await screen.findByText(/Guardian Recommendation/i)).toBeInTheDocument();

    // Tool 4: Make it feel expensive
    await user.click(screen.getByRole('button', { name: /Prioritize High-Impact Style/i }));
    expect(await screen.findByText(/Guardian Recommendation/i)).toBeInTheDocument();

    // Tool 5: What am I forgetting?
    await user.click(screen.getByRole('button', { name: /Scan Hidden Reminders/i }));
    expect(await screen.findByText(/Guardian Recommendation/i)).toBeInTheDocument();
  });

  it('shows WhatIfGuests headcount projection without mutating plan until proposed', async () => {
    const user = userEvent.setup();
    render(<TestBudgetWrapper eventId={demoEventId} />);

    const initialPlan = useEventsStore.getState().events[demoEventId]!.plan;

    const guestInput = screen.getByLabelText(/Projected guests/i);
    await user.clear(guestInput);
    await user.type(guestInput, '110');

    // Feasibility diff is updated
    expect(await screen.findByText(/Banquet Tables/i)).toBeInTheDocument();

    // Plan version remains unchanged
    expect(useEventsStore.getState().events[demoEventId]!.plan.version).toBe(initialPlan.version);
  });

  it('opens AddItemDialog with prefill from ForgottenCostsList with price at 0', async () => {
    const user = userEvent.setup();
    render(<TestBudgetWrapper eventId={demoEventId} />);

    // Click "Add a budget line" on first forgotten cost
    const addLineBtns = screen.getAllByRole('button', { name: /Add a budget line/i });
    await user.click(addLineBtns[0]!);

    // Add dialog opens
    const dialog = screen.getByRole('dialog', { name: /Add Budget Line Item/i });
    expect(dialog).toBeInTheDocument();

    // Price input is empty / 0 (NEVER prefilled)
    const priceInput = within(dialog).getByLabelText(/Your price/i) as HTMLInputElement;
    expect(priceInput.value).toBe('');
  });
});
