'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { CoverArt } from '@/components/ui/CoverArt';
import { Icon } from '@/components/ui/Icon';
import { budgetTotal, getBudgetCap } from '@/engine/budget';
import { eventStage } from '@/engine/stage';
import { formatInr, formatIsoDate } from '@/lib/format';
import type { EventRecord } from '@/store/persistSchema';

export interface EventCardProps {
  event: EventRecord;
  headingLevel?: 2 | 3;
  action?: ReactNode;
  className?: string;
}

const STAGE_CONFIG = {
  draft: { label: 'Draft', tone: 'neutral' as const },
  planning: { label: 'Planning', tone: 'brand' as const },
  completed: { label: 'Completed', tone: 'success' as const },
};

function getMeterColor(total: number, cap: number, percent: number): string {
  if (total > cap) return 'bg-[#A12B3A]';
  if (percent >= 90) return 'bg-[#8A5A00]';
  return 'bg-[#1F6F54]';
}

function BudgetSummary({ total, cap }: { total: number; cap: number | null }) {
  const percent = cap && cap > 0 ? Math.min(100, Math.round((total / cap) * 100)) : null;

  return (
    <div className="mt-5 pt-3.5 border-t border-[#E6DCD2]/70">
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="text-[#5B4A5E] font-medium">Estimated budget</span>
        <span className="font-bold text-[#2B1B2E]">
          {formatInr(total)}
          {cap ? <span className="font-normal text-[#5B4A5E]"> / {formatInr(cap)}</span> : null}
        </span>
      </div>

      {cap && percent !== null ? (
        <div
          role="progressbar"
          aria-valuenow={total}
          aria-valuemin={0}
          aria-valuemax={cap}
          aria-label="Budget consumption"
          className="w-full h-2 rounded-full bg-[#F4EDE6] overflow-hidden"
        >
          <div
            style={{ width: `${percent}%` }}
            className={`h-full rounded-full transition-all ${getMeterColor(total, cap, percent)}`}
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * Celebration event card.
 *
 * ACCESSIBILITY DECISION (WHY):
 * Uses a single stretched link (`after:absolute after:inset-0`) on the heading, ensuring
 * screen reader users navigate via one distinct accessible name without confusing nested links.
 * Any optional secondary action (such as delete) is placed outside the link with relative z-10.
 */
export function EventCard({
  event,
  headingLevel = 3,
  action,
  className = '',
}: EventCardProps) {
  const plan = event.plan;
  const today = new Date().toISOString().slice(0, 10);
  const stage = eventStage(plan, today);
  const stageInfo = STAGE_CONFIG[stage];

  const selectedConcept = plan.concepts.find((c) => c.id === plan.selectedConceptId);
  const palette = selectedConcept?.palette;

  const total = budgetTotal(plan.budgetItems, plan.meta.guestCount);
  const cap = getBudgetCap(plan.constraints);

  const HeadingTag = `h${headingLevel}` as 'h2' | 'h3';

  return (
    <article
      className={`relative bg-white rounded-[16px] border border-[#E6DCD2] p-5 shadow-2xs hover:shadow-md transition-shadow flex flex-col justify-between ${className}`}
    >
      <div>
        <div className="relative mb-4 overflow-hidden rounded-[12px]">
          <CoverArt seed={plan.id} palette={palette} height={130} />
          <div className="absolute top-2.5 right-2.5">
            <Badge tone={stageInfo.tone}>{stageInfo.label}</Badge>
          </div>
        </div>

        <div className="flex items-start justify-between gap-2">
          <HeadingTag className="font-serif text-lg font-bold text-[#2B1B2E] leading-snug">
            <Link
              href={`/events/${plan.id}`}
              className="focus-visible:outline-hidden after:absolute after:inset-0 text-inherit no-underline hover:text-[#6B2D5C]"
            >
              {plan.meta.title}
            </Link>
          </HeadingTag>

          {action ? <div className="relative z-10 shrink-0">{action}</div> : null}
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-[#5B4A5E]">
          <span className="inline-flex items-center gap-1">
            <Icon name="calendar" size={13} aria-hidden="true" />
            <span>{formatIsoDate(plan.meta.dateIso)}</span>
          </span>
          <span>•</span>
          <span className="inline-flex items-center gap-1">
            <Icon name="store" size={13} aria-hidden="true" />
            <span>{plan.meta.city || 'City not set'}</span>
          </span>
          <span>•</span>
          <span className="inline-flex items-center gap-1">
            <Icon name="users" size={13} aria-hidden="true" />
            <span>{plan.meta.guestCount} guests</span>
          </span>
        </div>
      </div>

      <BudgetSummary total={total} cap={cap} />
    </article>
  );
}
