'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import type { EventPlan, Task } from '@/domain/types';
import { groupTasksByTimeframe } from '@/engine/taskDates';
import { useOptionalCurrentEvent } from '@/components/events/EventContext';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { engineContext } from '@/store/engineContext';
import { useEventsStore } from '@/store/eventsStore';
import { ChecklistFilters, type ChecklistFilterState } from './ChecklistFilters';
import { ChecklistProgress } from './ChecklistProgress';
import { TaskDialog } from './TaskDialog';
import { TaskGroup } from './TaskGroup';

export interface ChecklistClientProps {
  eventId?: string;
}

const INITIAL_FILTERS: ChecklistFilterState = {
  category: 'all',
  status: 'all',
  priority: 'all',
  hideCompleted: false,
};

function matchesFilters(t: Task, filters: ChecklistFilterState): boolean {
  if (filters.hideCompleted && t.status === 'done') return false;
  if (filters.category !== 'all' && t.category !== filters.category) return false;
  if (filters.status !== 'all' && t.status !== filters.status) return false;
  if (filters.priority !== 'all' && t.priority !== filters.priority) return false;
  return true;
}

function ChecklistLoadingSkeleton() {
  return (
    <div className="py-2 space-y-6">
      <PageHeader title="Checklist" description="Actionable planning milestones organized by operational urgency." />
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-[16px]" />
        <Skeleton className="h-28 w-full rounded-[16px]" />
        <Skeleton className="h-64 w-full rounded-[16px]" />
      </div>
    </div>
  );
}

interface ChecklistTaskViewProps {
  totalTasks: number;
  filteredCount: number;
  groups: ReturnType<typeof groupTasksByTimeframe>;
  plan: EventPlan;
  eventId: string;
  onAddTask: () => void;
  onClearFilters: () => void;
  onEdit: (task: Task) => void;
  onRemove: (task: Task) => void;
}

function ChecklistTaskView({
  totalTasks,
  filteredCount,
  groups,
  plan,
  eventId,
  onAddTask,
  onClearFilters,
  onEdit,
  onRemove,
}: ChecklistTaskViewProps) {
  if (totalTasks === 0) {
    return (
      <EmptyState
        icon={<Icon name="checklist" size={28} aria-hidden="true" />}
        title="No tasks in checklist"
        description="Your planning checklist has no milestones yet. Add a task to start tracking action items."
        action={<Button variant="primary" onClick={onAddTask}>Add a task</Button>}
      />
    );
  }
  if (filteredCount === 0) {
    return (
      <EmptyState
        icon={<Icon name="info" size={28} aria-hidden="true" />}
        title="No tasks match these filters"
        description="None of your tasks match the selected category, status, or priority filters."
        action={<Button variant="secondary" onClick={onClearFilters}>Clear filters</Button>}
      />
    );
  }
  return (
    <div className="space-y-8">
      <h2 className="sr-only">Planning Milestones</h2>
      {groups.map((group) => (
        <TaskGroup
          key={group.name}
          name={group.name}
          tasks={group.tasks}
          plan={plan}
          eventId={eventId}
          onEdit={onEdit}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}

function useEventPlan(propEventId?: string) {
  const params = useParams();
  const eventId = propEventId ?? (typeof params?.id === 'string' ? params.id : '');
  const hydrated = useEventsStore((s) => s.hydrated);
  const currentEvent = useOptionalCurrentEvent();
  const event = useEventsStore((s) => (eventId ? s.events[eventId] : undefined));
  const plan = event?.plan ?? currentEvent?.plan;
  return { eventId, hydrated, plan };
}

function useChecklistTasks(plan: EventPlan | undefined, filters: ChecklistFilterState) {
  const categories = useMemo(() => {
    if (!plan) return [];
    return Array.from(new Set(plan.tasks.map((t) => t.category))).sort();
  }, [plan]);

  const filteredTasks = useMemo(() => {
    if (!plan) return [];
    return plan.tasks.filter((t) => matchesFilters(t, filters));
  }, [plan, filters]);

  const groups = useMemo(() => {
    if (!plan) return [];
    return groupTasksByTimeframe(plan, filteredTasks, engineContext.clock());
  }, [plan, filteredTasks]);

  return { categories, filteredTasks, groups };
}

export function ChecklistClient({ eventId: propEventId }: ChecklistClientProps) {
  const { eventId, hydrated, plan } = useEventPlan(propEventId);
  const [filters, setFilters] = useState<ChecklistFilterState>(INITIAL_FILTERS);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const { categories, filteredTasks, groups } = useChecklistTasks(plan, filters);

  if (!hydrated || !plan) {
    return <ChecklistLoadingSkeleton />;
  }

  return (
    <div className="py-2 space-y-6">
      <PageHeader
        title="Checklist"
        description="Prioritized milestone checklist categorized by operational urgency."
        actions={
          <Button
            variant="primary"
            onClick={() => {
              setSelectedTask(null);
              setDialogOpen(true);
            }}
          >
            Add a task
          </Button>
        }
      />

      <ChecklistProgress plan={plan} />

      <ChecklistFilters
        categories={categories}
        totalTasks={plan.tasks.length}
        filteredTasks={filteredTasks.length}
        filters={filters}
        onChange={setFilters}
      />

      <ChecklistTaskView
        totalTasks={plan.tasks.length}
        filteredCount={filteredTasks.length}
        groups={groups}
        plan={plan}
        eventId={eventId}
        onAddTask={() => {
          setSelectedTask(null);
          setDialogOpen(true);
        }}
        onClearFilters={() => setFilters(INITIAL_FILTERS)}
        onEdit={(task) => {
          setSelectedTask(task);
          setDialogOpen(true);
        }}
        onRemove={(task) => {
          setSelectedTask(task);
          setDialogOpen(true);
        }}
      />

      {dialogOpen && (
        <TaskDialog
          key={selectedTask?.id ?? 'new'}
          open={dialogOpen}
          onClose={() => {
            setDialogOpen(false);
            setSelectedTask(null);
          }}
          task={selectedTask}
          existingCategories={categories}
          eventId={eventId}
        />
      )}
    </div>
  );
}
