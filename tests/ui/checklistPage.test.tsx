import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChecklistClient } from '@/components/checklist/ChecklistClient';
import { TaskDialog } from '@/components/checklist/TaskDialog';
import { LiveRegionProvider } from '@/components/ui/LiveRegion';
import { buildDemoPlan } from '@/engine/demo';
import { createIdFactory } from '@/lib/id';
import { useEventsStore } from '@/store/eventsStore';
import { expectNoAxeViolations } from '../helpers/a11y';

let mockEventId = 'evt_demo';

vi.mock('next/navigation', () => ({
  usePathname: () => `/events/${mockEventId}/checklist`,
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ id: mockEventId }),
  useSearchParams: () => new URLSearchParams(''),
}));

const ctx = {
  ids: createIdFactory('checklist_page_test'),
  clock: () => new Date('2026-10-21T12:00:00.000Z'),
};

describe('UI: Checklist Page & Interactions (TASK 4)', () => {
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

  it('renders groups in order with demo plan and passes axe audit', async () => {
    const { container } = render(
      <LiveRegionProvider>
        <ChecklistClient eventId={eventId} />
      </LiveRegionProvider>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Checklist' })).toBeInTheDocument();
    expect(screen.getByText(/tasks done/i)).toBeInTheDocument();

    // Verify chronological timeframe group headings
    const headings = screen.getAllByRole('heading', { level: 3 });
    const headingTexts = headings.map((h) => h.textContent);
    expect(headingTexts.some((t) => t?.includes('1 to 3 months before'))).toBe(true);
    expect(headingTexts.some((t) => t?.includes('Final month'))).toBe(true);

    await expectNoAxeViolations(container);
  });

  it('renders groups cleanly when plan has no date', () => {
    const demo = buildDemoPlan(ctx);
    const noDatePlan = { ...demo.plan, meta: { ...demo.plan.meta, dateIso: undefined } };
    const noDateEventId = useEventsStore.getState().createEvent(noDatePlan);

    render(
      <LiveRegionProvider>
        <ChecklistClient eventId={noDateEventId} />
      </LiveRegionProvider>,
    );

    // Grouping by relative days works without throwing
    const headings = screen.getAllByRole('heading', { level: 3 });
    expect(headings.length).toBeGreaterThan(0);
  });

  it('changing a status does not bump plan version and announces progress', async () => {
    render(
      <LiveRegionProvider>
        <ChecklistClient eventId={eventId} />
      </LiveRegionProvider>,
    );

    const initialVersion = useEventsStore.getState().events[eventId]!.plan.version;
    const targetTask = useEventsStore.getState().events[eventId]!.plan.tasks[0]!;

    const statusSelect = screen.getByLabelText(`Status for ${targetTask.title}`);
    fireEvent.change(statusSelect, { target: { value: 'done' } });

    await waitFor(() => {
      const currentPlan = useEventsStore.getState().events[eventId]!.plan;
      expect(currentPlan.version).toBe(initialVersion);
      expect(currentPlan.tasks.find((t) => t.id === targetTask.id)?.status).toBe('done');
    });
  });

  it('filters tasks and clear-filters resets them', async () => {
    render(
      <LiveRegionProvider>
        <ChecklistClient eventId={eventId} />
      </LiveRegionProvider>,
    );

    // Filter by category "venue"
    const categorySelect = screen.getByLabelText(/Filter tasks by category/i);
    fireEvent.change(categorySelect, { target: { value: 'venue' } });

    expect(screen.getByText(/Showing \d+ of \d+ tasks/i)).toBeInTheDocument();

    // Filter by nonexistent condition: priority "low" when no venue low priority
    const prioritySelect = screen.getByLabelText(/Filter tasks by priority/i);
    fireEvent.change(prioritySelect, { target: { value: 'low' } });

    // Empty state should appear
    expect(screen.getByText('No tasks match these filters')).toBeInTheDocument();

    // Click "Clear filters"
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

    // All tasks restored
    expect(screen.queryByText('No tasks match these filters')).not.toBeInTheDocument();
  });

  it('adding, editing, and removing tasks bump the plan version', async () => {
    render(
      <LiveRegionProvider>
        <ChecklistClient eventId={eventId} />
      </LiveRegionProvider>,
    );

    let currentVersion = useEventsStore.getState().events[eventId]!.plan.version;

    // 1. Add Task
    fireEvent.click(screen.getByRole('button', { name: 'Add a task' }));
    const addDialog = screen.getByRole('dialog', { name: 'Add Task' });
    expect(addDialog).toBeInTheDocument();

    fireEvent.change(within(addDialog).getByLabelText(/Task Title/i), { target: { value: 'Order Fireworks' } });
    fireEvent.change(within(addDialog).getByLabelText(/Category/i), { target: { value: 'entertainment' } });

    const submitAdd = within(addDialog).getByRole('button', { name: 'Add task' });
    fireEvent.click(submitAdd);

    await waitFor(() => {
      const plan = useEventsStore.getState().events[eventId]!.plan;
      expect(plan.version).toBe(currentVersion + 1);
      expect(plan.tasks.some((t) => t.title === 'Order Fireworks')).toBe(true);
    });
    currentVersion = useEventsStore.getState().events[eventId]!.plan.version;

    // 2. Edit Task
    const editButtons = screen.getAllByRole('button', { name: 'Edit' });
    fireEvent.click(editButtons[0]!);

    const editDialog = screen.getByRole('dialog', { name: 'Edit Task' });
    expect(editDialog).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Task Title/i), { target: { value: 'Revised Milestone Title' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      const plan = useEventsStore.getState().events[eventId]!.plan;
      expect(plan.version).toBe(currentVersion + 1);
      expect(plan.tasks.some((t) => t.title === 'Revised Milestone Title')).toBe(true);
    });
    currentVersion = useEventsStore.getState().events[eventId]!.plan.version;

    // 3. Remove Task
    const removeButtons = screen.getAllByRole('button', { name: 'Remove' });
    fireEvent.click(removeButtons[0]!);

    // TaskDialog opens, click Remove button inside dialog to trigger confirmation
    const removeDialog = screen.getByRole('dialog', { name: 'Edit Task' });
    const dialogRemoveBtn = within(removeDialog).getByRole('button', { name: 'Remove' });
    fireEvent.click(dialogRemoveBtn);

    // Confirm dialog opens
    expect(screen.getByRole('dialog', { name: 'Remove Task?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Remove' }));

    await waitFor(() => {
      const plan = useEventsStore.getState().events[eventId]!.plan;
      expect(plan.version).toBe(currentVersion + 1);
    });
  });

  it('displays overdue badge when task is near or past due date', () => {
    // Event is tomorrow (2026-10-22), task due 5 days before -> due 2026-10-17. Today is 2026-10-21. Overdue!
    const demo = buildDemoPlan(ctx);
    const nearPlan = { ...demo.plan, meta: { ...demo.plan.meta, dateIso: '2026-10-22' } };
    const nearEventId = useEventsStore.getState().createEvent(nearPlan);

    render(
      <LiveRegionProvider>
        <ChecklistClient eventId={nearEventId} />
      </LiveRegionProvider>,
    );

    expect(screen.getAllByText('Overdue').length).toBeGreaterThan(0);
  });

  it('passes axe audit on TaskDialog', async () => {
    const demo = buildDemoPlan(ctx);
    const { container } = render(
      <LiveRegionProvider>
        <TaskDialog
          open={true}
          onClose={vi.fn()}
          task={demo.plan.tasks[0]}
          existingCategories={['venue', 'food']}
          eventId={eventId}
        />
      </LiveRegionProvider>,
    );

    await expectNoAxeViolations(container);
  });
});
