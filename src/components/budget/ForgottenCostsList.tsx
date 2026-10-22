import type { BudgetCategory, EventPlan } from '@/domain/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { findForgottenCosts } from '@/engine/forgottenCosts';

export interface ForgottenCostsListProps {
  plan: EventPlan;
  onAddLineItem: (prefill: { category: BudgetCategory; label: string }) => void;
  className?: string;
}

/**
 * ForgottenCostsList presenting unpriced gotchas and hidden operational costs.
 * WHY: Helps hosts avoid surprise fees (taxes, overtime, licenses) by adding explicit placeholders.
 */
export function ForgottenCostsList({
  plan,
  onAddLineItem,
  className = '',
}: ForgottenCostsListProps) {
  const reminders = findForgottenCosts(plan);

  if (reminders.length === 0) {
    return (
      <Card className={`p-5 bg-white border border-[#E6DCD2] ${className}`}>
        <p className="text-sm text-[#1F6F54] font-medium flex items-center gap-1.5">
          <Icon name="check" size={16} aria-hidden="true" />
          No common hidden gotchas detected for this celebration format.
        </p>
      </Card>
    );
  }

  return (
    <Card className={`p-5 bg-white border border-[#E6DCD2] space-y-4 ${className}`}>
      <div>
        <h3 className="font-serif font-bold text-base text-[#2B1B2E]">
          Common Hidden Gotchas
        </h3>
        <p className="text-xs text-[#5B4A5E] mt-0.5">
          Frequently overlooked fees, statutory deposits, and operational costs for your event setting.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {reminders.map((rem) => (
          <div
            key={rem.id}
            className="p-3.5 rounded-lg border border-[#E6DCD2] bg-[#FAF5F0] flex flex-col justify-between gap-2.5"
          >
            <div>
              <div className="flex items-start gap-1.5">
                <Icon
                  name="alert"
                  size={14}
                  className="text-[#8A5A00] shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <h4 className="font-semibold text-sm text-[#2B1B2E]">{rem.title}</h4>
              </div>
              <p className="text-xs text-[#5B4A5E] mt-1 pl-5">{rem.why}</p>
              <p className="text-xs font-medium text-[#8A5A00] mt-1.5 pl-5 italic">
                Reminder: no estimate included
              </p>
            </div>

            <div className="pt-1 self-end">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onAddLineItem({ category: rem.category, label: rem.title })}
                icon={<Icon name="sparkle" size={12} aria-hidden="true" />}
              >
                Add a budget line
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
