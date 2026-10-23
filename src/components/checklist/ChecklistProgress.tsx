'use client';

import type { EventPlan } from '@/domain/types';
import { taskProgress } from '@/engine/taskProgress';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { ProgressMeter } from '@/components/ui/ProgressMeter';
import { engineContext } from '@/store/engineContext';

export interface ChecklistProgressProps {
  plan: EventPlan;
  today?: Date;
  className?: string;
}

export function ChecklistProgress({
  plan,
  today = engineContext.clock(),
  className = '',
}: ChecklistProgressProps) {
  const metrics = taskProgress(plan, today);
  const label = `${metrics.done} of ${metrics.total} tasks done (${metrics.percent}%)`;

  return (
    <Card className={`p-4 bg-white border border-[#E6DCD2] space-y-3 ${className}`}>
      <ProgressMeter
        value={metrics.done}
        max={Math.max(1, metrics.total)}
        label={label}
        aria-label="Task completion progress"
      />

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {metrics.overdue > 0 && (
          <Badge tone="danger" className="text-xs">
            {metrics.overdue} overdue
          </Badge>
        )}
        {metrics.dueSoon > 0 && (
          <Badge tone="warning" className="text-xs">
            {metrics.dueSoon} due within 7 days
          </Badge>
        )}
        {metrics.byPriority.high > 0 && (
          <Badge tone="brand" className="text-xs">
            {metrics.byPriority.high} high priority open
          </Badge>
        )}
      </div>
    </Card>
  );
}
