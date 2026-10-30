'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import type { BudgetStatus } from '@/engine/budget';
import type { RiskBand } from '@/engine/risk';
import { formatInr } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useAnnouncer } from '@/components/ui/LiveRegion';
import { Money } from '@/components/ui/Money';
import { ProgressMeter } from '@/components/ui/ProgressMeter';
import { useEvent, useEventDerived } from '@/store/selectors';

export interface PlanHealthStripProps {
  eventId: string;
  className?: string;
}

function formatConflictSummary(blockingCount: number, warningCount: number): string {
  if (blockingCount === 0 && warningCount === 0) {
    return 'No conflicts';
  }
  const parts: string[] = [];
  if (blockingCount > 0) {
    parts.push(`${blockingCount} blocking`);
  }
  if (warningCount > 0) {
    parts.push(`${warningCount} ${warningCount === 1 ? 'warning' : 'warnings'}`);
  }
  return parts.join(', ');
}

function isBudgetOverCap(status: BudgetStatus | undefined): boolean {
  if (!status || status.cap === null) return false;
  return status.total > status.cap;
}

function conflictIndicator(blockingCount: number, warningCount: number): { icon: IconName; className: string } {
  if (blockingCount > 0) return { icon: 'alert', className: 'text-danger' };
  if (warningCount > 0) return { icon: 'alert', className: 'text-warning' };
  return { icon: 'check', className: 'text-success' };
}

function BudgetMeter({ status }: { status: BudgetStatus }) {
  if (status.cap !== null) {
    return (
      <ProgressMeter
        value={status.total}
        max={status.cap}
        label={`Budget: ${formatInr(status.total)} / ${formatInr(status.cap)}`}
        aria-label="Budget cap progress"
      />
    );
  }
  return (
    <div className="flex items-center gap-1.5 text-sm font-medium text-ink">
      <span className="text-ink-muted">Budget:</span>
      <Money amount={status.total} />
      <Badge tone="neutral" className="text-xs">No budget cap set</Badge>
    </div>
  );
}

/**
 * PlanHealthStrip provides high-level vitals for active event planning.
 *
 * ACCESSIBILITY & NOTIFICATION DECISION (WHY):
 * Uses a semantic region landmark (`aria-label="Plan health"`).
 * Emits screen reader announcements ONLY on status transitions (cap exceeded or band shift),
 * preventing notification noise during normal editing cycles.
 */
export function PlanHealthStrip({ eventId, className = '' }: PlanHealthStripProps) {
  const { announce } = useAnnouncer();
  const event = useEvent(eventId);
  const derived = useEventDerived(eventId);

  const prevOverCapRef = useRef<boolean | null>(null);
  const prevBandRef = useRef<RiskBand | null>(null);

  const budgetStatus = derived?.budgetStatus;
  const isOverCap = isBudgetOverCap(budgetStatus);
  const chaosBand = derived?.scoreRisks.band;

  useEffect(() => {
    if (prevOverCapRef.current !== null && prevOverCapRef.current !== isOverCap) {
      if (isOverCap && budgetStatus?.cap) {
        announce(`Plan health update: Budget is now over cap by ${formatInr(budgetStatus.total - budgetStatus.cap)}.`);
      } else {
        announce('Plan health update: Budget is now within cap.');
      }
    }
    prevOverCapRef.current = isOverCap;
  }, [isOverCap, budgetStatus, announce]);

  useEffect(() => {
    if (prevBandRef.current !== null && chaosBand && prevBandRef.current !== chaosBand) {
      announce(`Plan health update: Chaos risk band changed to ${chaosBand}.`);
    }
    if (chaosBand) {
      prevBandRef.current = chaosBand;
    }
  }, [chaosBand, announce]);

  if (!event || !derived) return null;

  const status = derived.budgetStatus;
  const conflicts = derived.findConflicts;
  const blockingCount = conflicts.filter((c) => c.severity === 'blocking').length;
  const warningCount = conflicts.filter((c) => c.severity === 'warning').length;
  const conflictText = formatConflictSummary(blockingCount, warningCount);
  const indicator = conflictIndicator(blockingCount, warningCount);

  return (
    <section
      role="region"
      aria-label="Plan health"
      className={`w-full bg-surface-warm border-b border-border px-4 sm:px-6 lg:px-8 py-2.5 sticky top-[var(--header-h)] z-20 shadow-xs ${className}`}
    >
      <div className="max-w-[72rem] w-full flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        {/* 1. Budget progress meter or plain total */}
        <div className="flex-1 max-w-sm">
          <BudgetMeter status={status} />
        </div>

        {/* 2. Chaos Score & Band */}
        <div className="flex items-center gap-4">
          <Link
            href={`/events/${eventId}/chaos`}
            className="inline-flex items-center gap-1.5 text-ink hover:text-primary hover:underline font-medium transition-colors"
          >
            <Icon name="storm" size={16} aria-hidden="true" className="text-primary" />
            <span>Chaos Score:</span>
            <span className="font-semibold">{derived.scoreRisks.score}</span>
            <span className="text-ink-muted">({derived.scoreRisks.band})</span>
          </Link>

          {/* 3. Conflict Count */}
          <Link
            href={`/events/${eventId}#conflicts`}
            className="inline-flex items-center gap-1.5 text-ink hover:text-primary hover:underline font-medium transition-colors"
          >
            <Icon
              name={indicator.icon}
              size={14}
              aria-hidden="true"
              className={indicator.className}
            />
            <span>{conflictText}</span>
          </Link>

          {/* 4. Plan Version */}
          <Link
            href={`/events/${eventId}#history`}
            className="inline-flex items-center gap-1 text-ink-muted hover:text-ink hover:underline transition-colors"
          >
            <Icon name="clock" size={13} aria-hidden="true" />
            <span>Version {event.plan.version}</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
