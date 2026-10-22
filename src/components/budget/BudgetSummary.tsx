import type { EventPlan } from '@/domain/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { ProgressMeter } from '@/components/ui/ProgressMeter';
import { formatInr } from '@/lib/format';
import { getBudgetStatus } from '@/engine/budget';

export interface BudgetSummaryProps {
  plan: EventPlan;
  onEditCap?: () => void;
  className?: string;
}

/**
 * BudgetSummary displaying overall expenditure against the host's budget cap.
 * WHY: Answers "Where do we stand financially?" at a single glance with accessible status badges.
 */
export function BudgetSummary({
  plan,
  onEditCap,
  className = '',
}: BudgetSummaryProps) {
  const status = getBudgetStatus(plan);
  const capConstraint = plan.constraints.find((c) => c.kind === 'budget_cap');
  const isHard = capConstraint?.severity === 'hard';

  return (
    <Card className={`p-5 bg-white border border-[#E6DCD2] space-y-4 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-serif font-bold text-[#2B1B2E]">
              {formatInr(status.total)}
            </h3>
            {status.cap !== null ? (
              <Badge tone={isHard ? 'danger' : 'info'}>
                {isHard ? 'Hard limit' : 'Flexible target'}
              </Badge>
            ) : (
              <Badge tone="neutral">
                No cap set
              </Badge>
            )}
          </div>
          <p className="text-xs text-[#5B4A5E] mt-0.5">
            {status.cap !== null ? (
              <>
                Budget cap: {formatInr(status.cap)} ·{' '}
                {status.overCap ? (
                  <span className="text-[#A12B3A] font-semibold">
                    Over by {formatInr(status.total - status.cap)}
                  </span>
                ) : (
                  <span className="text-[#1F6F54] font-semibold">
                    {formatInr(status.remaining)} remaining
                  </span>
                )}
              </>
            ) : (
              'Set a budget cap to protect your spending'
            )}
          </p>
        </div>

        {onEditCap && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onEditCap}
            icon={<Icon name="sparkle" size={14} aria-hidden="true" />}
          >
            Adjust cap
          </Button>
        )}
      </div>

      {status.cap !== null && (
        <div className="space-y-1">
          <ProgressMeter
            value={status.total}
            max={status.cap}
            label="Budget utilization"
          />
        </div>
      )}
    </Card>
  );
}
