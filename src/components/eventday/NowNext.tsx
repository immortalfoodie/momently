'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import type { EventPlan, ScheduleSlot } from '@/domain/types';
import { dayStatus, type DayStatusReport } from '@/engine/eventDay';
import { useAnnouncer } from '@/components/ui/LiveRegion';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { formatMinuteOfDay } from '@/lib/format';

export interface NowNextProps {
  plan: EventPlan;
  minute: number;
  eventId: string;
  className?: string;
}

function HappeningNowCard({
  slot,
  concurrent,
  minutesLeft,
}: {
  slot: ScheduleSlot;
  concurrent: ScheduleSlot[];
  minutesLeft?: number;
}) {
  const endTime = formatMinuteOfDay(slot.startMinute + slot.durationMinutes);

  return (
    <Card className="p-5 bg-white border-2 border-[#2B1B2E] space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Badge tone="success">Happening now</Badge>
        <span className="text-sm font-semibold text-[#5B4A5E]">
          Ends at {endTime} {minutesLeft !== undefined && `(${minutesLeft}m left)`}
        </span>
      </div>
      <div>
        <h3 className="text-xl sm:text-2xl font-serif font-bold text-[#2B1B2E]">
          {slot.title}
        </h3>
        {slot.note && <p className="text-sm text-[#5B4A5E] mt-1">{slot.note}</p>}
      </div>
      {concurrent.length > 0 && (
        <div className="pt-2 border-t border-[#E6DCD2] space-y-1">
          <p className="text-xs font-semibold text-[#7A6B7E] uppercase tracking-wider">
            Also happening:
          </p>
          <ul className="space-y-1">
            {concurrent.map((c) => (
              <li key={c.id} className="text-sm text-[#2B1B2E] flex items-center justify-between">
                <span>{c.title}</span>
                <span className="text-xs text-[#7A6B7E]">
                  until {formatMinuteOfDay(c.startMinute + c.durationMinutes)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function UpNextCard({
  slot,
  minutesUntil,
}: {
  slot: ScheduleSlot;
  minutesUntil?: number;
}) {
  const startTime = formatMinuteOfDay(slot.startMinute);

  return (
    <Card className="p-4 bg-[#F5F2EB] border border-[#E6DCD2] space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Badge tone="neutral">Up next</Badge>
        <span className="text-xs font-semibold text-[#5B4A5E]">
          Starts at {startTime} {minutesUntil !== undefined && `(in ${minutesUntil}m)`}
        </span>
      </div>
      <h3 className="text-lg font-serif font-bold text-[#2B1B2E]">{slot.title}</h3>
      {slot.note && <p className="text-xs text-[#5B4A5E]">{slot.note}</p>}
    </Card>
  );
}

function LaterList({ slots }: { slots: ScheduleSlot[] }) {
  if (slots.length === 0) return null;
  return (
    <div className="space-y-2 pt-2">
      <p className="text-xs font-semibold text-[#7A6B7E] uppercase tracking-wider">Later today</p>
      <ul className="space-y-1.5">
        {slots.map((s) => (
          <li key={s.id} className="p-2.5 rounded-[12px] bg-white border border-[#E6DCD2] flex items-center justify-between text-sm">
            <span className="font-medium text-[#2B1B2E]">{s.title}</span>
            <span className="text-xs text-[#7A6B7E]">{formatMinuteOfDay(s.startMinute)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function NowNext({ plan, minute, eventId, className = '' }: NowNextProps) {
  const { announce } = useAnnouncer();
  const report: DayStatusReport = dayStatus(plan.schedule, minute);
  const lastAnnouncedKeyRef = useRef<string>('');

  useEffect(() => {
    const key = `${report.phase}:${report.current?.id ?? 'none'}:${report.next?.id ?? 'none'}`;
    if (lastAnnouncedKeyRef.current !== key) {
      lastAnnouncedKeyRef.current = key;
      if (report.current) {
        const nextPart = report.next ? ` Next: ${report.next.title} at ${formatMinuteOfDay(report.next.startMinute)}.` : '';
        announce(`Now: ${report.current.title}.${nextPart}`);
      } else if (report.next) {
        announce(`Next up: ${report.next.title} at ${formatMinuteOfDay(report.next.startMinute)}.`);
      }
    }
  }, [report, announce]);

  if (plan.schedule.length === 0) {
    return (
      <EmptyState
        icon={<Icon name="clock" size={28} aria-hidden="true" />}
        title="No timeline activities set"
        description="Your celebration timeline has no sessions yet. Add schedule activities to start live run-of-show tracking."
        action={
          <Link href={`/events/${eventId}/timeline`} className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-[12px] bg-[#2B1B2E] text-white font-medium text-sm">
            Configure timeline
          </Link>
        }
      />
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {report.phase === 'before' && report.next && (
        <Card className="p-4 bg-[#F5F2EB] border border-[#E6DCD2]">
          <p className="text-base font-semibold text-[#2B1B2E]">
            Doors open at {formatMinuteOfDay(report.next.startMinute)}
          </p>
          <p className="text-xs text-[#5B4A5E] mt-0.5">
            First session: &ldquo;{report.next.title}&rdquo;
          </p>
        </Card>
      )}

      {report.phase === 'between' && report.next && (
        <Card className="p-4 bg-[#F5F2EB] border border-[#E6DCD2]">
          <p className="text-base font-semibold text-[#2B1B2E]">
            Nothing is scheduled right now. Next up: &ldquo;{report.next.title}&rdquo; at {formatMinuteOfDay(report.next.startMinute)}
          </p>
        </Card>
      )}

      {report.phase === 'after' && (
        <Card className="p-5 bg-white border border-[#E6DCD2] space-y-2 text-center">
          <p className="text-lg font-serif font-bold text-[#2B1B2E]">
            That&apos;s a wrap. Congratulations!
          </p>
          <p className="text-xs text-[#5B4A5E]">
            All timeline activities for the day have completed.
          </p>
          <div className="pt-2">
            <Link href={`/events/${eventId}`} className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-[12px] bg-[#2B1B2E] text-white font-medium text-sm">
              Back to overview
            </Link>
          </div>
        </Card>
      )}

      {report.current && (
        <HappeningNowCard
          slot={report.current}
          concurrent={report.concurrent}
          minutesLeft={report.minutesLeftInCurrent}
        />
      )}

      {report.next && (
        <UpNextCard slot={report.next} minutesUntil={report.minutesUntilNext} />
      )}

      <LaterList slots={report.later} />
    </div>
  );
}
