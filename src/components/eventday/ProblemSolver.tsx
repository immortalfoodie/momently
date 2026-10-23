'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { EventPlan } from '@/domain/types';
import { dayStatus } from '@/engine/eventDay';
import { DelayPlanner } from '@/components/timeline/DelayPlanner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';

export interface ProblemSolverProps {
  plan: EventPlan;
  minute: number;
  eventId: string;
  className?: string;
}

export function ProblemSolver({
  plan,
  minute,
  eventId,
  className = '',
}: ProblemSolverProps) {
  const [delayOpen, setDelayOpen] = useState(false);
  const status = dayStatus(plan.schedule, minute);
  const targetAnchorSlotId = status.current?.id ?? status.next?.id ?? plan.schedule[0]?.id;

  return (
    <Card className={`p-5 bg-white border border-[#E6DCD2] space-y-4 ${className}`}>
      <div className="space-y-1">
        <h3 className="font-serif font-bold text-lg text-[#2B1B2E]">
          Something went wrong?
        </h3>
        <p className="text-xs text-[#5B4A5E]">
          Quick triage and contingency strategies for common event-day disruptions.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Button
          variant={delayOpen ? 'secondary' : 'primary'}
          onClick={() => setDelayOpen((prev) => !prev)}
          className="min-h-[48px] justify-start text-left px-4"
        >
          <span className="flex items-center gap-2">
            <Icon name="clock" size={20} aria-hidden="true" />
            <span className="font-medium text-sm">
              {delayOpen ? 'Hide delay planner' : 'Something is running late'}
            </span>
          </span>
        </Button>

        <Link
          href={`/events/${eventId}/chaos?scenario=rain`}
          className="min-h-[48px] inline-flex items-center gap-2 px-4 py-2.5 rounded-[12px] bg-white border border-[#E6DCD2] hover:bg-[#FBF8F4] text-[#2B1B2E] font-medium text-sm transition-colors"
        >
          <Icon name="storm" size={20} aria-hidden="true" />
          <span>It started raining</span>
        </Link>

        <Link
          href={`/events/${eventId}/chaos?scenario=vendor_cancels`}
          className="min-h-[48px] inline-flex items-center gap-2 px-4 py-2.5 rounded-[12px] bg-white border border-[#E6DCD2] hover:bg-[#FBF8F4] text-[#2B1B2E] font-medium text-sm transition-colors"
        >
          <Icon name="users" size={20} aria-hidden="true" />
          <span>A vendor can&apos;t make it</span>
        </Link>

        <Link
          href={`/events/${eventId}/chaos?scenario=item_unavailable`}
          className="min-h-[48px] inline-flex items-center gap-2 px-4 py-2.5 rounded-[12px] bg-white border border-[#E6DCD2] hover:bg-[#FBF8F4] text-[#2B1B2E] font-medium text-sm transition-colors"
        >
          <Icon name="alert" size={20} aria-hidden="true" />
          <span>An item is unavailable</span>
        </Link>
      </div>

      {delayOpen && (
        <div className="pt-2 border-t border-[#E6DCD2]">
          <DelayPlanner
            plan={plan}
            eventId={eventId}
            defaultAnchorSlotId={targetAnchorSlotId}
            defaultDelayMinutes={30}
          />
        </div>
      )}

      <p className="text-xs text-[#7A6B7E] pt-2 border-t border-[#E6DCD2]">
        Momently suggests; you decide. It never contacts vendors or guests: you do that yourself.
      </p>
    </Card>
  );
}
