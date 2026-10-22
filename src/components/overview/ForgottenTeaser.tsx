import Link from 'next/link';
import type { EventPlan } from '@/domain/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { findForgottenCosts } from '@/engine/forgottenCosts';

export interface ForgottenTeaserProps {
  plan: EventPlan;
  eventId: string;
  className?: string;
}

/**
 * ForgottenTeaser displays the top 3 hidden expense reminders.
 * WHY: Prompts hosts to address gotchas early, linking directly to the full Budget Guardian.
 */
export function ForgottenTeaser({
  plan,
  eventId,
  className = '',
}: ForgottenTeaserProps) {
  const reminders = findForgottenCosts(plan).slice(0, 3);

  if (reminders.length === 0) return null;

  return (
    <Card className={`p-5 bg-white border border-[#E6DCD2] space-y-4 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#E6DCD2]">
        <div>
          <h3 className="font-serif font-bold text-lg text-[#2B1B2E]">Hidden Gotchas & Overlooked Costs</h3>
          <p className="text-xs text-[#5B4A5E] mt-0.5">Top reminders commonly missing from initial milestone budgets.</p>
        </div>
        <Link href={`/events/${eventId}/budget`}>
          <Button variant="secondary" size="sm" icon={<Icon name="wallet" size={14} aria-hidden="true" />}>
            Manage in Budget Guardian
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {reminders.map((rem) => (
          <div
            key={rem.id}
            className="p-3.5 rounded-lg border border-[#E6DCD2] bg-[#FAF5F0] flex flex-col justify-between gap-2"
          >
            <div>
              <div className="flex items-start gap-1.5">
                <Icon name="alert" size={14} className="text-[#8A5A00] shrink-0 mt-0.5" aria-hidden="true" />
                <h4 className="font-semibold text-sm text-[#2B1B2E]">{rem.title}</h4>
              </div>
              <p className="text-xs text-[#5B4A5E] mt-1 pl-5 leading-relaxed">{rem.why}</p>
            </div>
            <p className="text-xs font-medium text-[#8A5A00] pl-5 italic">Reminder: unpriced</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
