import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TourBar } from '@/components/demo/TourBar';
import { LiveRegionProvider } from '@/components/ui/LiveRegion';
import { DEMO_TOUR } from '@/data/demoTour';
import { buildDemoPlan } from '@/engine/demo';
import * as apiClient from '@/lib/apiClient';
import { createIdFactory } from '@/lib/id';
import { useEventsStore } from '@/store/eventsStore';
import { useTourStore } from '@/store/tourStore';
import { expectNoAxeViolations } from '../helpers/a11y';

const mockPush = vi.fn();
let mockPathname = '/';

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: mockPush }),
  useParams: () => ({}),
}));

const ctx = {
  ids: createIdFactory('tour_bar_test'),
  clock: () => new Date('2026-10-22T10:00:00.000Z'),
};

describe('UI: Guided Demo TourBar', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockPush.mockReset();
    mockPathname = '/';

    useEventsStore.setState({
      events: {},
      order: [],
      hydrated: true,
      notice: null,
      outcomes: {},
      chatDraft: '',
    });
    useTourStore.getState().exit();
  });

  it('walks through all 6 steps with fakes, shows manual approval hint, supports Back and Exit, and never calls approveAndApply', async () => {
    const demo = buildDemoPlan(ctx);
    const approveSpy = vi.spyOn(useEventsStore.getState(), 'approveAndApply');

    vi.spyOn(apiClient, 'submitIntake').mockResolvedValueOnce({
      ok: true,
      value: {
        plan: demo.plan,
        fit: demo.fit,
        assumptions: demo.assumptions,
        missingInfo: [],
        mode: 'demo',
        degraded: false,
        notes: [],
      },
    });

    const sendSpy = vi.spyOn(apiClient, 'sendMessage').mockResolvedValue({
      ok: true,
      value: {
        outcome: {
          kind: 'proposal',
          message: 'Proposal ready for review.',
          options: [],
          notes: [],
        },
        mode: 'demo',
        degraded: false,
        notes: [],
      },
    });

    useTourStore.getState().start();

    const { container } = render(
      <LiveRegionProvider>
        <TourBar />
      </LiveRegionProvider>,
    );

    expect(screen.getByRole('region', { name: 'Demo guide' })).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 6')).toBeInTheDocument();
    await expectNoAxeViolations(container);

    // Run Step 1 (intake)
    fireEvent.click(screen.getByRole('button', { name: 'Run this step' }));
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(`/events/${demo.plan.id}/concepts`);
    });
    expect(useTourStore.getState().eventId).toBe(demo.plan.id);

    // Walk through Steps 2..5 (chat steps)
    for (let stepNum = 2; stepNum <= 5; stepNum++) {
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      expect(screen.getByText(`Step ${stepNum} of 6`)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Run this step' }));
      await waitFor(() => {
        expect(
          screen.getByText(
            'Now review the proposal and approve it yourself. Momently never applies a change on its own.',
          ),
        ).toBeInTheDocument();
      });
    }

    expect(sendSpy).toHaveBeenCalledTimes(4);

    // Step 6 (navigate to checklist)
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Step 6 of 6')).toBeInTheDocument();
    expect(screen.getByText(DEMO_TOUR[5]!.title)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Run this step' }));
    expect(mockPush).toHaveBeenCalledWith(`/events/${demo.plan.id}/checklist`);

    // Back button works
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('Step 5 of 6')).toBeInTheDocument();

    // Never auto-approved anything
    expect(approveSpy).not.toHaveBeenCalled();

    // Exit clears the state and unmounts the region
    fireEvent.click(screen.getByRole('button', { name: 'Exit demo' }));
    expect(useTourStore.getState().active).toBe(false);
    expect(screen.queryByRole('region', { name: 'Demo guide' })).not.toBeInTheDocument();
  });

  it('falls back to createDemoEvent on Step 1 when submitIntake fails', async () => {
    vi.spyOn(apiClient, 'submitIntake').mockResolvedValueOnce({
      ok: false,
      error: { code: 'network', message: 'Offline' },
    });
    const createDemoSpy = vi.spyOn(useEventsStore.getState(), 'createDemoEvent');

    useTourStore.getState().start();

    render(
      <LiveRegionProvider>
        <TourBar />
      </LiveRegionProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Run this step' }));

    await waitFor(() => {
      expect(createDemoSpy).toHaveBeenCalledTimes(1);
    });

    const createdId = useTourStore.getState().eventId;
    expect(createdId).toBeTruthy();
    expect(mockPush).toHaveBeenCalledWith(`/events/${createdId}/concepts`);
  });

  it('shows a clear warning if a chat step is triggered before Step 1 has created an event', () => {
    useTourStore.getState().start();
    useTourStore.getState().next(); // Move to Step 2 without running Step 1

    render(
      <LiveRegionProvider>
        <TourBar />
      </LiveRegionProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Run this step' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/Step 1 must run first/i);
  });
});
