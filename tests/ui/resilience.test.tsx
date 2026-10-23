import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/events/demo-1/budget',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ id: 'demo-1' }),
}));

vi.mock('@/lib/apiClient', () => ({
  fetchHealth: vi.fn(async () => ({
    ok: false as const,
    error: { code: 'network' as const, message: 'Network unreachable', retryable: true },
  })),
  sendMessage: vi.fn(async () => ({
    ok: false as const,
    error: { code: 'network' as const, message: 'Network unreachable', retryable: true },
  })),
  requestConcepts: vi.fn(async () => ({
    ok: false as const,
    error: { code: 'network' as const, message: 'Network unreachable', retryable: true },
  })),
  requestNarration: vi.fn(async () => ({
    ok: false as const,
    error: { code: 'network' as const, message: 'Network unreachable', retryable: true },
  })),
  submitIntake: vi.fn(async () => ({
    ok: false as const,
    error: { code: 'network' as const, message: 'Network unreachable', retryable: true },
  })),
}));

import WorkspaceErrorBoundary from '@/app/events/[id]/error';
import { BudgetClient } from '@/components/budget/BudgetClient';
import { ChecklistClient } from '@/components/checklist/ChecklistClient';
import { AppShell } from '@/components/shell/AppShell';
import { Header } from '@/components/shell/Header';
import { TimelineClient } from '@/components/timeline/TimelineClient';
import { LiveRegionProvider } from '@/components/ui/LiveRegion';
import { buildDemoPlan } from '@/engine/demo';
import { createIdFactory } from '@/lib/id';
import { useEventsStore } from '@/store/eventsStore';
import { clearInMemoryStore } from '@/store/safeStorage';
import { expectNoAxeViolations } from '../helpers/a11y';

describe('UI Resilience: Error Boundary, Storage Fallback Notice, and Full Offline Mode', () => {
  beforeEach(() => {
    clearInMemoryStore();
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
    const { plan } = buildDemoPlan({
      ids: createIdFactory('resilience_seed'),
      clock: () => new Date('2026-10-21T12:00:00.000Z'),
    });
    const demoPlan = { ...plan, id: 'demo-1' };
    useEventsStore.setState({
      events: {
        'demo-1': {
          plan: demoPlan,
          history: [],
          messages: [],
          assumptions: [],
          missingInfo: [],
          contacts: [],
        },
      },
      order: ['demo-1'],
      hydrated: true,
      notice: null,
      outcomes: {},
      chatDraft: '',
    });
  });

  it('renders WorkspaceErrorBoundary without stack or technical text, invokes reset, and passes axe', async () => {
    const reset = vi.fn();
    const internalError = new Error('TypeError: Cannot read properties of undefined at bundle.js:9921');
    internalError.stack = 'Error: stack trace line 1\n    at internalModule (src/secret.ts:44:12)';

    const { container } = render(
      <WorkspaceErrorBoundary error={internalError} reset={reset} />,
    );

    expect(
      screen.getByRole('heading', { level: 1, name: /We hit a snag loading this view/i }),
    ).toBeInTheDocument();
    expect(container.textContent).not.toContain('TypeError');
    expect(container.textContent).not.toContain('bundle.js');
    expect(container.textContent).not.toContain('secret.ts');

    fireEvent.click(screen.getByRole('button', { name: /Try again/i }));
    expect(reset).toHaveBeenCalledTimes(1);

    await expectNoAxeViolations(container);
  });

  it('shows a one-time dismissible Notice in AppShell when localStorage throws', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('SecurityError');
    });

    render(
      <LiveRegionProvider>
        <AppShell>
          <h1>Workspace Content</h1>
        </AppShell>
      </LiveRegionProvider>,
    );

    const noticeText =
      'Your browser is blocking storage, so changes will be lost when you close this tab. Export your data from Settings to keep a copy.';
    expect(await screen.findByText(noticeText)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Dismiss storage notice/i }));
    expect(screen.queryByText(noticeText)).not.toBeInTheDocument();

    setItemSpy.mockRestore();
  });

  it('displays Offline badge in Header and allows budget, checklist, and timeline edits when all apiClient calls fail', async () => {
    render(
      <LiveRegionProvider>
        <Header />
        <BudgetClient eventId="demo-1" />
        <ChecklistClient eventId="demo-1" />
        <TimelineClient eventId="demo-1" />
      </LiveRegionProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Offline')).toBeInTheDocument();
    });

    const initialPlan = useEventsStore.getState().events['demo-1']!.plan;
    const initialVersion = initialPlan.version;

    // 1. Budget edit: toggle lock on first non-contingency item
    const lockButtons = screen.getAllByRole('button', { name: /Lock|Unlock/i });
    expect(lockButtons.length).toBeGreaterThan(0);
    fireEvent.click(lockButtons[0]!);

    const afterBudgetPlan = useEventsStore.getState().events['demo-1']!.plan;
    expect(afterBudgetPlan.version).toBe(initialVersion + 1);

    // 2. Checklist edit: mark first task status as 'done'
    const firstTask = afterBudgetPlan.tasks[0]!;
    const statusSelect = screen.getByLabelText(`Status for ${firstTask.title}`);
    fireEvent.change(statusSelect, { target: { value: 'done' } });

    const afterTaskPlan = useEventsStore.getState().events['demo-1']!.plan;
    expect(afterTaskPlan.tasks[0]!.status).toBe('done');

    // 3. Timeline edit: add a new slot via store user edit (same write path as SlotDialog)
    let editOk = false;
    act(() => {
      const editRes = useEventsStore.getState().applyUserEdit(
        'demo-1',
        [
          {
            type: 'add_slot',
            slot: {
              id: 'slot_offline_1',
              title: 'Offline Welcome Toast',
              startMinute: 1020,
              durationMinutes: 30,
              priority: 'important',
              flexible: true,
            },
          },
        ],
        'Added slot offline',
      );
      editOk = editRes.ok;
    });
    expect(editOk).toBe(true);
    expect(
      useEventsStore.getState().events['demo-1']!.plan.schedule.some(
        (s) => s.id === 'slot_offline_1',
      ),
    ).toBe(true);
  });
});
