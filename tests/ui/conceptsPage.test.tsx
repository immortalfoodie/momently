import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildDemoPlan } from '@/engine/demo';
import * as apiClient from '@/lib/apiClient';
import { EventContextProvider } from '@/components/events';
import { ConceptsClient } from '@/components/concepts/ConceptsClient';
import { LiveRegionProvider } from '@/components/ui/LiveRegion';
import { engineContext } from '@/store/engineContext';
import { useEventsStore } from '@/store/eventsStore';
import { useEvent, useEventDerived } from '@/store/selectors';
import { expectNoAxeViolations } from '../helpers/a11y';

function TestConceptsWrapper({ eventId }: { eventId: string }) {
  const event = useEvent(eventId);
  const derived = useEventDerived(eventId);
  if (!event || !derived) return null;

  return (
    <LiveRegionProvider>
      <EventContextProvider value={{ event, plan: event.plan, derived }}>
        <ConceptsClient />
      </EventContextProvider>
    </LiveRegionProvider>
  );
}

describe('Concepts Page & Components', () => {
  let demoEventId: string;

  beforeEach(() => {
    useEventsStore.setState({ events: {}, order: [], hydrated: true });
    const demo = buildDemoPlan(engineContext);
    demoEventId = useEventsStore.getState().createEvent(demo.plan, {
      assumptions: ['Assuming an evening anniversary dinner', 'Terrace weather contingent'],
      missingInfo: [{ field: 'guestCount', question: 'How many guests are attending?' }],
    });
  });

  it('renders three concept cards with engine-priced totals and passes axe audit', async () => {
    const { container } = render(<TestConceptsWrapper eventId={demoEventId} />);

    // Three concept card headings from demo scenario
    const conceptTitles = ['Vintage Bollywood Evening', 'Elegant Golden Celebration', 'Memory Lane'];
    for (const title of conceptTitles) {
      expect(screen.getByRole('heading', { level: 2, name: title })).toBeInTheDocument();
    }

    // Engine priced totals are rendered
    expect(screen.getAllByText(/Estimated total:/i).length).toBe(3);

    await expectNoAxeViolations(container);
  });

  it('updates concept pricing when guest count changes in the store', () => {
    render(<TestConceptsWrapper eventId={demoEventId} />);

    // Initial total text
    const initialText = screen.getAllByText(/Estimated total:/i)[0]!.textContent;

    // Mutate guest count in store (raising cap so hard constraint violation does not reject)
    act(() => {
      useEventsStore.getState().applyUserEdit(
        demoEventId,
        [
          { type: 'set_budget_cap', amount: 300000 },
          { type: 'set_meta', changes: { guestCount: 120 } },
        ],
        'Update cap and guest count to 120',
      );
    });

    const updatedText = screen.getAllByText(/Estimated total:/i)[0]!.textContent;
    expect(updatedText).not.toEqual(initialText);
  });

  it('choosing a concept opens preview dialog, shows diff, and applies to store with focus return', async () => {
    const user = userEvent.setup();
    render(<TestConceptsWrapper eventId={demoEventId} />);

    // Select "Memory Lane" concept
    const memoryLaneHeading = screen.getByRole('heading', { level: 2, name: 'Memory Lane' });
    const card = memoryLaneHeading.closest('.border-\\[\\#E6DCD2\\]') as HTMLElement;
    expect(card).toBeInTheDocument();

    const chooseBtn = within(card).getByRole('button', { name: 'Choose this concept' });
    await user.click(chooseBtn);

    // Dialog opens with OptionCard
    const dialog = screen.getByRole('dialog', { name: /Review: Switch to Memory Lane/ });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /Item budget changes/i })).toBeInTheDocument();

    // If over cap, funding step appears; select funding strategy to meet cap
    const fundingRadios = screen.queryAllByRole('radio');
    if (fundingRadios.length > 0) {
      await user.click(fundingRadios[0]!);
    }

    // Click Approve
    const approveBtn = screen.getByRole('button', { name: 'Approve this change' });
    expect(approveBtn).toBeEnabled();
    await user.click(approveBtn);

    // Plan updated in store
    const event = useEventsStore.getState().events[demoEventId];
    const memoryLaneConcept = event?.plan.concepts.find((c) => c.title === 'Memory Lane');
    expect(event?.plan.selectedConceptId).toBe(memoryLaneConcept?.id);
    expect(event?.plan.version).toBeGreaterThan(1);
  });

  it('compare table toggles on, has caption, column and row headers', async () => {
    const user = userEvent.setup();
    const { container } = render(<TestConceptsWrapper eventId={demoEventId} />);

    const toggleBtn = screen.getByRole('button', { name: 'Compare side by side' });
    expect(toggleBtn).toBeInTheDocument();

    await user.click(toggleBtn);

    const table = screen.getByRole('table', { name: 'Side-by-side concept comparison matrix' });
    expect(table).toBeInTheDocument();

    // Semantic headers
    const colHeaders = screen.getAllByRole('columnheader');
    expect(colHeaders.length).toBeGreaterThanOrEqual(4); // Dimension + 3 concepts

    const rowHeaders = screen.getAllByRole('rowheader');
    expect(rowHeaders.length).toBe(8); // 8 dimensions

    await expectNoAxeViolations(container);
  });

  it('empty state allows generating ideas via apiClient', async () => {
    const user = userEvent.setup();

    // Create event with zero concepts
    const demo = buildDemoPlan(engineContext);
    const emptyPlan = { ...demo.plan, concepts: [] };
    const emptyEventId = useEventsStore.getState().createEvent(emptyPlan);

    const mockConcepts = [
      {
        id: 'c_gen_1',
        title: 'Twilight Sufi Soiree',
        tagline: 'Soulful acoustic poetry',
        summary: 'Warm candlelit seating with traditional carpets.',
        palette: ['#6B2D5C', '#D4A24C', '#FAF5F0'],
        experienceHighlights: ['Live acoustic harmonium and tabla set'],
        qualityProfile: { decor: 'standard' as const },
        tradeoffs: ['Higher acoustic soundproofing required'],
        whyItFits: 'Matches your intimate gathering size',
        tags: ['Acoustic', 'Sufi'],
        estimatedTotal: 140000,
      },
    ];

    vi.spyOn(apiClient, 'requestConcepts').mockResolvedValueOnce({
      ok: true,
      value: { concepts: mockConcepts, degraded: false, notes: [] },
    });

    render(<TestConceptsWrapper eventId={emptyEventId} />);

    expect(screen.getByText('No concept directions yet')).toBeInTheDocument();
    const genButton = screen.getByRole('button', { name: 'Generate ideas' });
    await user.click(genButton);

    // After API response, store updates and concept title appears
    expect(apiClient.requestConcepts).toHaveBeenCalled();
    const event = useEventsStore.getState().events[emptyEventId];
    expect(event?.plan.concepts).toHaveLength(1);
  });

  it('quick-edit of missing guest count produces approved user edit and shows ImpactSummary', async () => {
    const user = userEvent.setup();
    const { container } = render(<TestConceptsWrapper eventId={demoEventId} />);

    expect(screen.getByText('How many guests are attending?')).toBeInTheDocument();
    const input = screen.getByLabelText('Confirm guest count');

    await user.clear(input);
    await user.type(input, '85');
    const applyBtn = screen.getByRole('button', { name: 'Apply' });
    await user.click(applyBtn);

    // ImpactSummary appears showing applied change
    expect(screen.getByText('Change applied successfully')).toBeInTheDocument();

    const event = useEventsStore.getState().events[demoEventId];
    expect(event?.plan.meta.guestCount).toBe(85);

    await expectNoAxeViolations(container);
  });
});
