'use client';

import type { EventPlan, Task } from '@/domain/types';
import { TaskRow } from './TaskRow';

export interface TaskGroupProps {
  name: string;
  tasks: Task[];
  plan: EventPlan;
  eventId: string;
  onEdit: (task: Task) => void;
  onRemove: (task: Task) => void;
  className?: string;
}

export function TaskGroup({
  name,
  tasks,
  plan,
  eventId,
  onEdit,
  onRemove,
  className = '',
}: TaskGroupProps) {
  const headingId = `group-${name.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}`;

  return (
    <section aria-labelledby={headingId} className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between border-b border-[#E6DCD2] pb-1.5">
        <h3 id={headingId} className="font-serif font-bold text-base text-[#2B1B2E]">
          {name}{' '}
          <span className="text-xs font-sans font-normal text-[#5B4A5E]">
            ({tasks.length})
          </span>
        </h3>
      </div>

      <ul className="space-y-2.5" aria-label={`Tasks for ${name}`}>
        {tasks.map((task) => (
          <li key={task.id}>
            <TaskRow
              task={task}
              plan={plan}
              eventId={eventId}
              onEdit={onEdit}
              onRemove={onRemove}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
