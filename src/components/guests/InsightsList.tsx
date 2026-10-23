'use client';

import type { EventPlan } from '@/domain/types';
import { useUserEdit } from '@/components/budget/useUserEdit';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { useAnnouncer } from '@/components/ui/LiveRegion';
import { guestInsights, insightTaskOps } from '@/engine/guestInsights';
import { engineContext } from '@/store/engineContext';

export interface InsightsListProps {
  plan: EventPlan;
  eventId: string;
  className?: string;
}

export function InsightsList({ plan, eventId, className = '' }: InsightsListProps) {
  const { announce } = useAnnouncer();
  const { applyEdit } = useUserEdit(eventId);
  const insights = guestInsights(plan);

  const isTaskAlreadyPresent = (title?: string) => {
    if (!title) return false;
    const lower = title.toLowerCase();
    return plan.tasks.some((t) => t.title.toLowerCase() === lower);
  };

  const handleAddTask = async (insight: (typeof insights)[0]) => {
    const op = insightTaskOps(plan, insight, engineContext);
    if (!op) return;

    const ok = await applyEdit([op], `Added checklist task: ${insight.task?.title}`);
    if (ok) {
      announce(`Task "${insight.task?.title}" added to your checklist.`);
    }
  };

  if (insights.length === 0) {
    return (
      <EmptyState
        icon={<Icon name="sparkle" size={28} aria-hidden="true" />}
        title="No reminders yet"
        description="No special needs recorded yet. Add some above to get tailored reminders."
        className={className}
      />
    );
  }

  return (
    <div className={`space-y-3.5 ${className}`} role="region" aria-label="Guest hospitality reminders">
      {insights.map((insight) => {
        const alreadyAdded = isTaskAlreadyPresent(insight.task?.title);
        const tone = insight.severity === 'important' ? 'warning' : 'neutral';

        return (
          <Card
            key={insight.id}
            className="p-4 sm:p-5 bg-white border border-[#E6DCD2] flex flex-col sm:flex-row sm:items-start justify-between gap-4"
          >
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Badge tone={tone}>{insight.severity}</Badge>
                <h3 className="text-base font-semibold text-[#2B1B2E]">{insight.title}</h3>
              </div>
              <p className="text-sm text-[#5B4A5E] leading-relaxed">{insight.detail}</p>
            </div>

            {insight.task && (
              <div className="shrink-0 self-start sm:self-center">
                {alreadyAdded ? (
                  <Button variant="secondary" size="sm" disabled className="min-h-[44px]">
                    Already on your checklist
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleAddTask(insight)}
                    className="min-h-[44px]"
                  >
                    Add to checklist
                  </Button>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
