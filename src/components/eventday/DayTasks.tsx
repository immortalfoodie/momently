'use client';

import type { EventPlan, Task } from '@/domain/types';
import { selectDayTasks } from '@/engine/eventDay';
import { isTaskOverdue, taskDueDate } from '@/engine/taskDates';
import { useAnnouncer } from '@/components/ui/LiveRegion';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { engineContext } from '@/store/engineContext';
import { useEventsStore } from '@/store/eventsStore';

export interface DayTasksProps {
  plan: EventPlan;
  eventId: string;
  className?: string;
}

function priorityTone(priority: Task['priority']): BadgeTone {
  if (priority === 'high') return 'danger';
  if (priority === 'medium') return 'warning';
  return 'neutral';
}

function computeDueLabel(plan: EventPlan, task: Task): string {
  const overdue = isTaskOverdue(plan, task, engineContext.clock());
  if (overdue) return 'Overdue';
  const due = taskDueDate(plan, task);
  if (due.kind === 'date') {
    return 'Due today';
  }
  return task.dueDaysBefore === 0 ? 'Event day' : `${task.dueDaysBefore}d before`;
}

export function DayTasks({ plan, eventId, className = '' }: DayTasksProps) {
  const { announce } = useAnnouncer();
  const setTaskStatus = useEventsStore((s) => s.setTaskStatus);
  const tasks = selectDayTasks(plan, engineContext.clock());

  const handleMarkDone = (task: Task) => {
    setTaskStatus(eventId, task.id, 'done');
    const remainingCount = tasks.length - 1;
    announce(`Marked "${task.title}" as done. ${remainingCount} tasks left.`);
  };

  const handleStatusChange = (task: Task, newStatus: 'todo' | 'doing') => {
    setTaskStatus(eventId, task.id, newStatus);
  };

  if (tasks.length === 0) {
    return (
      <Card className={`p-6 bg-white border border-[#E6DCD2] text-center space-y-1 ${className}`}>
        <p className="text-base font-semibold text-[#2B1B2E]">Nothing left on today&apos;s list</p>
        <p className="text-xs text-[#5B4A5E]">All event day tasks and urgent milestones are done.</p>
      </Card>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <ul className="space-y-2.5">
        {tasks.map((task) => {
          const dueLabel = computeDueLabel(plan, task);
          const isOverdue = dueLabel === 'Overdue';

          return (
            <li
              key={task.id}
              className="p-3.5 sm:p-4 rounded-[16px] bg-white border border-[#E6DCD2] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
            >
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-base text-[#2B1B2E] break-words">
                    {task.title}
                  </span>
                  <Badge tone={priorityTone(task.priority)}>
                    {task.priority}
                  </Badge>
                  <Badge tone={isOverdue ? 'danger' : 'neutral'}>
                    {dueLabel}
                  </Badge>
                </div>
                {task.notes && (
                  <p className="text-xs text-[#5B4A5E] truncate">{task.notes}</p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="w-32">
                  <Select
                    value={task.status === 'doing' ? 'doing' : 'todo'}
                    onChange={(e) =>
                      handleStatusChange(task, e.target.value as 'todo' | 'doing')
                    }
                    aria-label={`Status for ${task.title}`}
                    className="min-h-[44px] text-xs"
                  >
                    <option value="todo">To do</option>
                    <option value="doing">In progress</option>
                  </Select>
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleMarkDone(task)}
                  aria-label={`Mark "${task.title}" as done`}
                  className="min-h-[44px] px-3.5"
                >
                  Mark done
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
