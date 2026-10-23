'use client';

import type { EventPlan, Task } from '@/domain/types';
import { isTaskOverdue, taskDueDate } from '@/engine/taskDates';
import { taskProgress } from '@/engine/taskProgress';
import { useAnnouncer } from '@/components/ui/LiveRegion';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { engineContext } from '@/store/engineContext';
import { useEventsStore } from '@/store/eventsStore';

export interface TaskRowProps {
  task: Task;
  plan: EventPlan;
  eventId: string;
  onEdit: (task: Task) => void;
  onRemove: (task: Task) => void;
  className?: string;
}

function priorityTone(priority: Task['priority']): BadgeTone {
  if (priority === 'high') return 'danger';
  if (priority === 'medium') return 'warning';
  return 'neutral';
}

function formatDueText(plan: EventPlan, task: Task): { text: string; overdue: boolean } {
  const overdue = isTaskOverdue(plan, task, engineContext.clock());
  const due = taskDueDate(plan, task);

  if (due.kind === 'date') {
    const parts = due.iso.split('-').map(Number);
    const y = parts[0] ?? 2026;
    const m = parts[1] ?? 1;
    const d = parts[2] ?? 1;
    const dateObj = new Date(Date.UTC(y, m - 1, d));
    const formatted = dateObj.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
    return { text: `Due ${formatted}`, overdue };
  }

  return { text: `${task.dueDaysBefore} days before the event`, overdue };
}

export function TaskRow({
  task,
  plan,
  eventId,
  onEdit,
  onRemove,
  className = '',
}: TaskRowProps) {
  const { announce } = useAnnouncer();
  const setTaskStatus = useEventsStore((s) => s.setTaskStatus);

  const { text: dueText, overdue } = formatDueText(plan, task);
  const isDone = task.status === 'done';

  const handleStatusChange = (newStatus: Task['status']) => {
    const res = setTaskStatus(eventId, task.id, newStatus);
    if (res.ok) {
      const nextPlan = res.value;
      const progress = taskProgress(nextPlan, engineContext.clock());
      announce(`Marked ${task.title} as ${newStatus}. ${progress.done} of ${progress.total} complete.`);
    }
  };

  return (
    <Card className={`p-4 bg-white border border-[#E6DCD2] hover:border-[#6B2D5C]/30 transition-colors ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          {/* Status selector */}
          <div className="shrink-0 pt-0.5 sm:pt-0">
            <select
              aria-label={`Status for ${task.title}`}
              value={task.status}
              onChange={(e) => handleStatusChange(e.target.value as Task['status'])}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-[8px] border border-[#E6DCD2] bg-white text-[#2B1B2E] cursor-pointer hover:border-[#6B2D5C] focus:outline-none"
            >
              <option value="todo">To do</option>
              <option value="doing">In progress</option>
              <option value="done">Done</option>
            </select>
          </div>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              {isDone ? (
                <>
                  <span className="line-through text-[#5B4A5E] font-medium text-sm">{task.title}</span>
                  <Badge tone="success" className="text-[10px]">
                    Done
                  </Badge>
                </>
              ) : (
                <span className="font-semibold text-sm text-[#2B1B2E]">{task.title}</span>
              )}
              <Badge tone={priorityTone(task.priority)} className="capitalize text-[10px]">
                {task.priority}
              </Badge>
              <Badge tone="neutral" className="capitalize text-[10px]">
                {task.category}
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-[#5B4A5E]">
              <span>{dueText}</span>
              {overdue && (
                <Badge tone="danger" className="text-[10px]">
                  Overdue
                </Badge>
              )}
              {task.notes && <span className="italic pl-1 text-[#8C7A8D]">{task.notes}</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          <Button variant="ghost" size="sm" onClick={() => onEdit(task)}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onRemove(task)}>
            Remove
          </Button>
        </div>
      </div>
    </Card>
  );
}
