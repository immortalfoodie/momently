import Link from 'next/link';
import type { EventPlan, Task } from '@/domain/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';

export interface NextStepsProps {
  plan: EventPlan;
  eventId: string;
  className?: string;
}

export function computeTaskDueDate(task: Task, dateIso?: string) {
  if (!dateIso) {
    return {
      text: `${task.dueDaysBefore} days before the event`,
      isOverdue: false,
    };
  }

  const eventTime = new Date(dateIso).getTime();
  const dueTime = eventTime - task.dueDaysBefore * 86400000;
  const dueDate = new Date(dueTime);
  const nowStart = new Date();
  nowStart.setHours(0, 0, 0, 0);

  const isOverdue = dueTime < nowStart.getTime();
  const text = dueDate.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return { text, isOverdue };
}

/**
 * NextSteps displays upcoming milestone tasks prioritized by operational urgency.
 * WHY: Answers "What should I do next?" and highlights overdue items against the milestone calendar.
 */
export function NextSteps({ plan, eventId, className = '' }: NextStepsProps) {
  const openTasks = plan.tasks
    .filter((t) => t.status !== 'done')
    .sort((a, b) => b.dueDaysBefore - a.dueDaysBefore)
    .slice(0, 5);

  return (
    <Card className={`p-5 bg-white border border-[#E6DCD2] space-y-4 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#E6DCD2]">
        <div>
          <h3 className="font-serif font-bold text-lg text-[#2B1B2E]">Next Steps</h3>
          <p className="text-xs text-[#5B4A5E] mt-0.5">Top 5 immediate planning milestones requiring host action.</p>
        </div>
        <Link href={`/events/${eventId}/checklist`}>
          <Button variant="secondary" size="sm">
            Open Full Checklist
          </Button>
        </Link>
      </div>

      {openTasks.length === 0 ? (
        <p className="text-sm text-[#1F6F54] font-medium flex items-center gap-1.5 py-2">
          <Icon name="check" size={16} aria-hidden="true" />
          All checklist tasks are completed! You are fully on track.
        </p>
      ) : (
        <ul className="divide-y divide-[#F4EDE6]" aria-label="Upcoming action items">
          {openTasks.map((task) => {
            const { text, isOverdue } = computeTaskDueDate(task, plan.meta.dateIso);

            return (
              <li
                key={task.id}
                className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-[#2B1B2E]">{task.title}</span>
                    <Badge tone="neutral" className="capitalize text-[10px]">
                      {task.category}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#5B4A5E]">
                    <span>Due: {text}</span>
                    {isOverdue && (
                      <Badge tone="danger" className="inline-flex items-center gap-1">
                        <Icon name="alert" size={10} aria-hidden="true" />
                        <span>Overdue</span>
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="shrink-0">
                  <Link href={`/events/${eventId}/checklist`}>
                    <Button size="sm" variant="ghost">
                      Checklist
                    </Button>
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
