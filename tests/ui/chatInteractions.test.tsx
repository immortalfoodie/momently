import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { Composer } from '@/components/chat/Composer';
import { LiveRegionProvider } from '@/components/ui/LiveRegion';
import { buildDemoPlan } from '@/engine/demo';
import * as apiClient from '@/lib/apiClient';
import { createIdFactory } from '@/lib/id';
import { useEventsStore } from '@/store/eventsStore';
import { expectNoAxeViolations } from '../helpers/a11y';

let mockPathname = '/events/evt_demo/concepts';
const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: mockPush }),
  useParams: () => ({ id: 'evt_demo' }),
}));

const ctx = {
  ids: createIdFactory('chat_ui_interactions'),
  clock: () => new Date('2026-10-22T10:00:00.000Z'),
};

describe('UI: Chat Interactions, Errors, Drafts & Intake Mode', () => {
  let eventId: string;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockPush.mockReset();
    useEventsStore.setState({
      events: {},
      order: [],
      hydrated: true,
      notice: null,
      outcomes: {},
      chatDraft: '',
    });

    const demo = buildDemoPlan(ctx);
    eventId = useEventsStore.getState().createEvent(demo.plan, {
      assumptions: demo.assumptions,
    });
    mockPathname = `/events/${eventId}/concepts`;
    vi.spyOn(apiClient, 'fetchHealth').mockResolvedValue({
      ok: true,
      value: { mode: 'demo' },
    });
  });

  it('shows wait time on rate_limited error, retry message on network failure, and retryLast re-sends', async () => {
    const sendSpy = vi
      .spyOn(apiClient, 'sendMessage')
      .mockResolvedValueOnce({
        ok: false,
        error: { code: 'rate_limited', message: 'Rate limited', retryAfterSeconds: 25 },
      })
      .mockResolvedValueOnce({
        ok: false,
        error: { code: 'network', message: 'Network down' },
      })
      .mockResolvedValueOnce({
        ok: true,
        value: {
          outcome: { kind: 'reply', text: 'Recovered successfully!' },
          mode: 'demo',
          degraded: false,
          notes: [],
        },
      });

    render(
      <LiveRegionProvider>
        <ChatPanel />
      </LiveRegionProvider>,
    );

    const textarea = screen.getByLabelText('Ask me anything');
    fireEvent.change(textarea, { target: { value: 'What am I forgetting?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

    await waitFor(() => {
      expect(screen.getByText(/wait 25 seconds/i)).toBeInTheDocument();
    });

    // Click Try again -> triggers network error
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(
        screen.getByText("I couldn't reach the server. Your plan is safe; please try again"),
      ).toBeInTheDocument();
    });

    // Click Try again -> succeeds
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(screen.getByText('Recovered successfully!')).toBeInTheDocument();
    });
    expect(sendSpy).toHaveBeenCalledTimes(3);
  });

  it('enforces the double-send guard, Enter vs Shift+Enter, counter, focus return, and confirm clear', async () => {
    let resolvePending: (val: Awaited<ReturnType<typeof apiClient.sendMessage>>) => void =
      () => {};
    const sendSpy = vi.spyOn(apiClient, 'sendMessage').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePending = resolve;
        }),
    );

    render(
      <LiveRegionProvider>
        <ChatPanel />
      </LiveRegionProvider>,
    );

    const textarea = screen.getByLabelText('Ask me anything') as HTMLTextAreaElement;
    expect(screen.getByText('0 / 500')).toBeInTheDocument();

    // Shift+Enter does not submit
    fireEvent.change(textarea, { target: { value: 'Line 1' } });
    expect(screen.getByText('6 / 500')).toBeInTheDocument();
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    expect(sendSpy).not.toHaveBeenCalled();

    // Enter without Shift submits and returns focus to textarea
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(textarea).toHaveFocus();

    // Double-send guard while pending
    fireEvent.change(textarea, { target: { value: 'Duplicate send' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    expect(sendSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolvePending({
        ok: true,
        value: {
          outcome: { kind: 'reply', text: 'Done thinking.' },
          mode: 'demo',
          degraded: false,
          notes: [],
        },
      });
    });

    await waitFor(() => {
      const log = screen.getByRole('log');
      expect(within(log).getByText('Done thinking.')).toBeInTheDocument();
    });
    expect(textarea).toHaveFocus();

    // Clear conversation with confirm dialog
    fireEvent.click(screen.getByRole('button', { name: 'Clear conversation' }));
    expect(screen.getByRole('dialog', { name: 'Clear conversation?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm clear' }));

    await waitFor(() => {
      const log = screen.getByRole('log');
      expect(within(log).queryByText('Done thinking.')).not.toBeInTheDocument();
    });
    expect(useEventsStore.getState().events[eventId]?.messages).toHaveLength(0);
  });

  it('consumes store.chatDraft by filling and focusing composer without sending, and clears draft', async () => {
    const sendSpy = vi.spyOn(apiClient, 'sendMessage');

    render(
      <LiveRegionProvider>
        <ChatPanel />
      </LiveRegionProvider>,
    );

    act(() => {
      useEventsStore.getState().setChatDraft('Combine option 1 and option 2');
    });

    const textarea = screen.getByLabelText('Ask me anything') as HTMLTextAreaElement;
    await waitFor(() => {
      expect(textarea.value).toBe('Combine option 1 and option 2');
    });
    expect(textarea).toHaveFocus();
    expect(useEventsStore.getState().chatDraft).toBe('');
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('operates in intake mode outside /events/[id]: clicking an intake chip creates an event and navigates', async () => {
    mockPathname = '/';
    const demo = buildDemoPlan(ctx);
    const intakePlan = { ...demo.plan, id: 'evt_intake_created' };

    const intakeSpy = vi.spyOn(apiClient, 'submitIntake').mockResolvedValueOnce({
      ok: true,
      value: {
        plan: intakePlan,
        fit: demo.fit,
        assumptions: [],
        missingInfo: [],
        mode: 'demo',
        degraded: false,
        notes: [],
      },
    });

    render(
      <LiveRegionProvider>
        <ChatPanel />
      </LiveRegionProvider>,
    );

    const chip = screen.getByRole('button', { name: 'Plan a wedding under ₹5 lakh' });
    fireEvent.click(chip);

    await waitFor(() => {
      expect(intakeSpy).toHaveBeenCalledWith('Plan a wedding under ₹5 lakh');
    });
    expect(useEventsStore.getState().events['evt_intake_created']).toBeDefined();
    expect(mockPush).toHaveBeenCalledWith('/events/evt_intake_created/concepts');
  });

  it('passes axe accessibility audit on standalone Composer', async () => {
    const { container } = render(
      <LiveRegionProvider>
        <Composer />
      </LiveRegionProvider>,
    );
    await expectNoAxeViolations(container);
  });
});
