'use client';

import Link from 'next/link';
import type { EventPlan } from '@/domain/types';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { engineContext } from '@/store/engineContext';

export interface PrepCountdownProps {
  plan: EventPlan;
  eventId: string;
  className?: string;
  clock?: () => Date;
}

export function useCountdownDays(dateIso: string | undefined, clock: () => Date): number | null {
  if (!dateIso) return null;
  const parts = dateIso.slice(0, 10).split('-').map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (!year || !month || !day) return null;

  const eventUtc = Date.UTC(year, month - 1, day);
  const today = clock();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());

  return Math.round((eventUtc - todayUtc) / 86_400_000);
}

/**
 * PrepCountdown displays days remaining until the celebration date.
 * WHY: Gives hosts immediate clarity on timeline urgency without client-clock drift.
 */
export function PrepCountdown({
  plan,
  eventId,
  className = '',
  clock = engineContext.clock,
}: PrepCountdownProps) {
  const diffDays = useCountdownDays(plan.meta.dateIso, clock);

  if (diffDays === null) {
    return (
      <Card className={`p-4 bg-[#FAF7F2] border border-[#E6DCD2] ${className}`}>
        <div className="flex items-center gap-3">
          <Icon name="clock" size={20} className="text-[#5B4A5E] shrink-0" aria-hidden="true" />
          <div className="text-sm text-[#2B1B2E]">
            <span>No celebration date set yet.&nbsp;</span>
            <Link
              href={`/events/${eventId}#facts`}
              className="font-medium text-[#7C2D37] underline hover:text-[#581F26]"
            >
              Add a date in celebration facts
            </Link>
            <span> to see your countdown.</span>
          </div>
        </div>
      </Card>
    );
  }

  let text = '';
  if (diffDays > 0) {
    text = `${diffDays} ${diffDays === 1 ? 'day' : 'days'} to go`;
  } else if (diffDays === 0) {
    text = 'Today is the day';
  } else {
    text = 'This event has passed';
  }

  return (
    <Card className={`p-4 bg-white border border-[#E6DCD2] ${className}`}>
      <div className="flex items-center gap-3">
        <Icon
          name={diffDays >= 0 ? 'clock' : 'check'}
          size={22}
          className={diffDays >= 0 ? 'text-[#7C2D37]' : 'text-[#1F6F54]'}
          aria-hidden="true"
        />
        <div>
          <span className="text-xs uppercase tracking-wider font-semibold text-[#5B4A5E]">
            Milestone Countdown
          </span>
          <p className="text-lg font-serif font-bold text-[#2B1B2E]">{text}</p>
        </div>
      </div>
    </Card>
  );
}
