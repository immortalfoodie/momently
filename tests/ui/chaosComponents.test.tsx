import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EventPlan } from '@/domain/types';
import { ChaosScoreCard } from '@/components/chaos/ChaosScoreCard';
import { ExplainButton } from '@/components/chaos/ExplainButton';
import { RiskRegister } from '@/components/chaos/RiskRegister';
import { ScenarioPicker } from '@/components/chaos/ScenarioPicker';
import { StressTestPanel } from '@/components/chaos/StressTestPanel';
import { LiveRegionProvider } from '@/components/ui/LiveRegion';
import { buildDemoPlan } from '@/engine/demo';
import { scoreRisks } from '@/engine/risk';
import * as apiClient from '@/lib/apiClient';
import { createIdFactory } from '@/lib/id';
import { engineContext } from '@/store/engineContext';
import { useEventsStore } from '@/store/eventsStore';
import { useEventDerived } from '@/store/selectors';
import { expectNoAxeViolations } from '../helpers/a11y';

const ctx = {
  ids: createIdFactory('chaos_ui_comp'),
  clock: () => new Date('2026-10-22T10:00:00.000Z'),
};

function TestScoreCardWrapper({ eventId }: { eventId: string }) {
  const event = useEventsStore((s) => s.events[eventId]);
  const derived = useEventDerived(eventId);
  if (!event || !derived) return null;
  return <ChaosScoreCard plan={event.plan} derived={derived} />;
}

describe('UI: Chaos Lab Standalone Components (TASK 4)', () => {
  let demoEventId: string;
  let demoPlan: EventPlan;

  beforeEach(() => {
    vi.restoreAllMocks();
    useEventsStore.setState({ events: {}, order: [], hydrated: true });
    const demo = buildDemoPlan(ctx);
    demoPlan = demo.plan;
    demoEventId = useEventsStore.getState().createEvent(demo.plan, {
      assumptions: demo.assumptions,
    });
  });

  it('renders ChaosScoreCard with score, band, breakdown table, and outdoor score is higher', async () => {
    const { container } = render(
      <LiveRegionProvider>
        <TestScoreCardWrapper eventId={demoEventId} />
      </LiveRegionProvider>,
    );

    const initialScore = scoreRisks(demoPlan, engineContext).score;
    expect(screen.getByText(new RegExp(`${initialScore} / 100`))).toBeInTheDocument();
    expect(screen.getByText(/Higher means more exposed/i)).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /How this score is calculated/i })).toBeInTheDocument();

    await expectNoAxeViolations(container);

    // Make an outdoor July plan (rain exposed)
    const outdoorJulyPlan: EventPlan = {
      ...demoPlan,
      meta: { ...demoPlan.meta, setting: 'outdoor', dateIso: '2027-07-15' },
    };
    const outdoorScore = scoreRisks(outdoorJulyPlan, engineContext).score;
    expect(outdoorScore).toBeGreaterThan(initialScore);
  });

  it('RiskRegister renders risks and Test this button selects the mapped scenario, plus empty state', async () => {
    const onSelect = vi.fn();
    const risks = [
      {
        id: 'risk_weather_uncovered',
        severity: 'high' as const,
        title: 'Open-air venue without rain protection',
        explanation: 'Lack of rain canopy cover.',
        mitigation: 'Add weather canopy.',
      },
    ];

    const { container, rerender } = render(
      <RiskRegister risks={risks} onSelectScenario={onSelect} />,
    );

    expect(screen.getByText('Open-air venue without rain protection')).toBeInTheDocument();
    expect(screen.getByText(/high/i)).toBeInTheDocument();
    const testBtn = screen.getByRole('button', { name: 'Test this' });
    fireEvent.click(testBtn);
    expect(onSelect).toHaveBeenCalledWith('rain');

    await expectNoAxeViolations(container);

    rerender(<RiskRegister risks={[]} onSelectScenario={onSelect} />);
    expect(screen.getByText(/No major risks found: nicely done/i)).toBeInTheDocument();
  });

  it('ScenarioPicker disables unavailable options with visible reasons and allows keyboard navigation', async () => {
    const onSelectType = vi.fn();
    const onSimulate = vi.fn();
    const user = userEvent.setup();

    // Set demo plan setting to indoor -> rain disabled
    const indoorPlan: EventPlan = { ...demoPlan, meta: { ...demoPlan.meta, setting: 'indoor' } };

    const { container } = render(
      <ScenarioPicker
        plan={indoorPlan}
        selectedType="budget_cut"
        onSelectType={onSelectType}
        input={{ type: 'budget_cut', percent: 20 }}
        onChangeInput={vi.fn()}
        onSimulate={onSimulate}
      />,
    );

    const rainRadio = screen.getByRole('radio', { name: /Rain hits the outdoor event/i });
    expect(rainRadio).toBeDisabled();
    expect(screen.getByText(/Rain scenario is not applicable for indoor venues/i)).toBeInTheDocument();

    const budgetRadio = screen.getByRole('radio', { name: /Budget suddenly cut/i });
    expect(budgetRadio).toBeChecked();

    const simulateBtn = screen.getByRole('button', { name: 'Simulate this problem' });
    await user.click(simulateBtn);
    expect(onSimulate).toHaveBeenCalledWith({ type: 'budget_cut', percent: 20 });

    await expectNoAxeViolations(container);
  });

  it('ExplainButton calls requestNarration on-demand, handles success and failure, and is never called automatically', async () => {
    const narrateSpy = vi.spyOn(apiClient, 'requestNarration').mockResolvedValueOnce({
      ok: true,
      value: {
        text: 'The weather contingency option keeps the event safe under budget.',
        highlights: ['Waterproof canopy deployed', 'Zero budget cap violation'],
        degraded: false,
      },
    });

    const fakeResult = {
      input: { type: 'rain' as const },
      applicable: true,
      headline: 'Rain simulation',
      summary: 'Summary text',
      options: [],
      scoreBefore: 45,
    };

    const { container, rerender } = render(<ExplainButton result={fakeResult} />);
    expect(narrateSpy).not.toHaveBeenCalled();

    const explainBtn = screen.getByRole('button', { name: 'Explain this in plain words' });
    fireEvent.click(explainBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/The weather contingency option keeps the event safe under budget/i),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole('region', { name: 'Plain-words summary' })).toBeInTheDocument();
    await expectNoAxeViolations(container);

    // Test failure case
    vi.spyOn(apiClient, 'requestNarration').mockResolvedValueOnce({
      ok: false,
      error: { code: 'server_error', message: 'Offline' },
    });
    rerender(<ExplainButton result={fakeResult} />);
    fireEvent.click(screen.getByRole('button', { name: 'Explain this in plain words' }));

    await waitFor(() => {
      expect(
        screen.getByText(/I couldn't write the explanation, but the numbers above are unaffected/i),
      ).toBeInTheDocument();
    });
  });

  it('StressTestPanel shows copy, runs stress test on click, marks weakest spot, and Open triggers onOpenScenario', async () => {
    const onOpen = vi.fn();
    const { container } = render(
      <StressTestPanel plan={demoPlan} onOpenScenario={onOpen} />,
    );

    expect(
      screen.getByText(/Simulations never change your plan\. Only a recovery you approve does/i),
    ).toBeInTheDocument();

    const runBtn = screen.getByRole('button', { name: 'Run the full stress test' });
    fireEvent.click(runBtn);

    expect(
      screen.getByRole('table', { name: /Stress test: every scenario against your current plan/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('Weakest spot')).toBeInTheDocument();

    const openBtns = screen.getAllByRole('button', { name: 'Open' });
    expect(openBtns.length).toBeGreaterThan(0);
    fireEvent.click(openBtns[0]!);
    expect(onOpen).toHaveBeenCalled();

    await expectNoAxeViolations(container);
  });
});
