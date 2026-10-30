'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { formatInr } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { useAnnouncer } from '@/components/ui/LiveRegion';
import { ScoreDelta } from '@/components/review/ScoreDelta';

export interface RecoveryAppliedProps {
  eventId: string;
  scoreBefore: number;
  scoreAfter: number;
  budgetTotalAfter: number;
  onDismiss: () => void;
  className?: string;
}

/**
 * Confirmation banner announcing that a host has approved and committed an engine recovery option.
 */
export function RecoveryApplied({
  eventId,
  scoreBefore,
  scoreAfter,
  budgetTotalAfter,
  onDismiss,
  className = '',
}: RecoveryAppliedProps) {
  const { announce } = useAnnouncer();

  useEffect(() => {
    announce(
      `Recovery applied. Chaos Score changed from ${scoreBefore} to ${scoreAfter}. New budget total is ${formatInr(budgetTotalAfter)}.`,
    );
  }, [scoreBefore, scoreAfter, budgetTotalAfter, announce]);

  return (
    <Card
      className={`p-5 border-success/30 bg-[#F4F9F6] shadow-sm space-y-3.5 relative ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-success text-white flex items-center justify-center shrink-0">
            <Icon name="check" size={16} aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-success">Recovery applied</h3>
            <p className="text-xs text-ink-muted">
              Your plan has advanced to a new version with the approved contingency patch.
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss confirmation"
        >
          Dismiss
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs pt-1 border-t border-border/60">
        <div>
          <span className="text-ink-muted mr-2">Resilience transition:</span>
          <ScoreDelta scoreBefore={scoreBefore} scoreAfter={scoreAfter} />
        </div>

        <div className="text-xs">
          <span className="text-ink-muted">New budget total: </span>
          <span className="font-semibold text-ink">{formatInr(budgetTotalAfter)}</span>
        </div>
      </div>

      <div className="pt-1">
        <Link
          href={`/events/${eventId}/checklist`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary-hover hover:underline"
        >
          <span>View newly added contingency tasks in your checklist</span>
          <span aria-hidden="true">&rarr;</span>
        </Link>
      </div>
    </Card>
  );
}
