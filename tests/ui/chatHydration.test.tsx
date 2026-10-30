import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { LiveRegionProvider } from '@/components/ui/LiveRegion';
import { buildDemoPlan } from '@/engine/demo';
import * as apiClient from '@/lib/apiClient';
import { createIdFactory } from '@/lib/id';
import { useEventsStore } from '@/store/eventsStore';

let mockPathname = '/';

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({}),
}));

describe('UI: chat hydration safety', () => {
  beforeEach(() => {
    vi.spyOn(apiClient, 'fetchHealth').mockResolvedValue({ ok: true, value: { mode: 'demo' } });
    useEventsStore.setState({ events: {}, order: [], hydrated: true, outcomes: {}, chatDraft: '' });
    const demo = buildDemoPlan({ ids: createIdFactory('chat_hydration'), clock: () => new Date('2026-10-22T10:00:00Z') });
    const id = useEventsStore.getState().createEvent(demo.plan, { assumptions: demo.assumptions });
    mockPathname = `/events/${id}/budget`;
  });

  it('matches the prerendered intake shell until storage hydrates, then switches to event mode', () => {
    useEventsStore.setState({ hydrated: false });
    render(
      <LiveRegionProvider>
        <ChatPanel />
      </LiveRegionProvider>,
    );
    expect(screen.getByText(/Tell me your idea/)).toBeInTheDocument();

    act(() => {
      useEventsStore.setState({ hydrated: true });
    });
    expect(screen.queryByText(/Tell me your idea/)).not.toBeInTheDocument();
    expect(screen.getByText(/nothing changes until you approve it/)).toBeInTheDocument();
  });
});
