import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildDemoPlan } from '@/engine/demo';
import { PlanHealthStrip } from '@/components/plan/PlanHealthStrip';
import { LiveRegionProvider } from '@/components/ui/LiveRegion';
import * as LiveRegionModule from '@/components/ui/LiveRegion';
import { engineContext } from '@/store/engineContext';
import { useEventsStore } from '@/store/eventsStore';
import { expectNoAxeViolations } from '../helpers/a11y';

describe('PlanHealthStrip Component', () => {
  let demoEventId: string;

  beforeEach(() => {
    useEventsStore.setState({ events: {}, order: [], hydrated: true });
    const demo = buildDemoPlan(engineContext);
    demoEventId = useEventsStore.getState().createEvent(demo.plan, { assumptions: demo.assumptions });
  });

  it('renders all four vital metrics from the demo plan and passes axe audit', async () => {
    const { container } = render(
      <LiveRegionProvider>
        <PlanHealthStrip eventId={demoEventId} />
      </LiveRegionProvider>,
    );

    // Region landmark
    const region = screen.getByRole('region', { name: 'Plan health' });
    expect(region).toBeInTheDocument();

    // 1. Budget progress meter
    expect(screen.getByRole('meter', { name: 'Budget cap utilization' })).toBeInTheDocument();

    // 2. Chaos Score linking to /events/[id]/chaos
    const chaosLink = screen.getByRole('link', { name: /Chaos Score:/ });
    expect(chaosLink).toBeInTheDocument();
    expect(chaosLink).toHaveAttribute('href', `/events/${demoEventId}/chaos`);

    // 3. Conflict count linking to #conflicts
    const conflictLink = screen.getByRole('link', { name: /conflicts|blocking|warning/i });
    expect(conflictLink).toBeInTheDocument();
    expect(conflictLink).toHaveAttribute('href', `/events/${demoEventId}#conflicts`);

    // 4. Version N linking to #history
    const versionLink = screen.getByRole('link', { name: /Version 1/ });
    expect(versionLink).toBeInTheDocument();
    expect(versionLink).toHaveAttribute('href', `/events/${demoEventId}#history`);

    await expectNoAxeViolations(container);
  });

  it('fires announcements ONLY when budget over-cap status or chaos band changes', async () => {
    const announceSpy = vi.fn();
    vi.spyOn(LiveRegionModule, 'useAnnouncer').mockReturnValue({ announce: announceSpy });

    const { rerender } = render(
      <LiveRegionProvider>
        <PlanHealthStrip eventId={demoEventId} />
      </LiveRegionProvider>,
    );

    // Initial render must not trigger announcements
    expect(announceSpy).not.toHaveBeenCalled();

    // Re-rendering with identical plan must not trigger announcements
    rerender(
      <LiveRegionProvider>
        <PlanHealthStrip eventId={demoEventId} />
      </LiveRegionProvider>,
    );
    expect(announceSpy).not.toHaveBeenCalled();

    // Mutate plan to exceed budget cap (transition isOverCap from false to true)
    act(() => {
      const event = useEventsStore.getState().events[demoEventId];
      if (event) {
        useEventsStore.setState({
          events: {
            ...useEventsStore.getState().events,
            [demoEventId]: {
              ...event,
              plan: {
                ...event.plan,
                version: event.plan.version + 1,
                constraints: [
                  {
                    id: 'c_cap',
                    kind: 'budget_cap',
                    severity: 'soft',
                    numericValue: 50000,
                    description: 'Soft cap below total',
                  },
                ],
              },
            },
          },
        });
      }
    });

    rerender(
      <LiveRegionProvider>
        <PlanHealthStrip eventId={demoEventId} />
      </LiveRegionProvider>,
    );

    // Over-cap announcement should now have fired exactly once
    expect(announceSpy).toHaveBeenCalledWith(
      expect.stringContaining('Plan health update: Budget is now over cap'),
    );

    vi.restoreAllMocks();
  });
});
