'use client';

import { useState, useEffect } from 'react';
import type { EventPlan } from '@/domain/types';
import { AssistantOutcomeView } from '@/components/review/AssistantOutcomeView';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { NumberInput } from '@/components/ui/NumberInput';
import { resolveIntent } from '@/engine/assistant/resolveIntent';
import type { AssistantOutcome } from '@/engine/assistant/types';
import type { PropagationPreviewResult } from '@/engine/budgetView';
import { propagationPreview } from '@/engine/budgetView';
import { formatInr } from '@/lib/format';
import { engineContext } from '@/store/engineContext';

export interface WhatIfGuestsProps {
  plan: EventPlan;
  eventId: string;
  className?: string;
}

/**
 * WhatIfGuests provides a live, zero-network headcount simulator demonstrating the living plan.
 * WHY: Answers "What happens if guest count increases or drops?" with immediate metric recalculation.
 */
export function WhatIfGuests({
  plan,
  eventId,
  className = '',
}: WhatIfGuestsProps) {
  const [guestCount, setGuestCount] = useState<number>(plan.meta.guestCount);
  const [debouncedCount, setDebouncedCount] = useState<number>(plan.meta.guestCount);
  const [prevPlanGuestCount, setPrevPlanGuestCount] = useState<number>(plan.meta.guestCount);
  const [outcome, setOutcome] = useState<AssistantOutcome | null>(null);

  if (plan.meta.guestCount !== prevPlanGuestCount) {
    setPrevPlanGuestCount(plan.meta.guestCount);
    setGuestCount(plan.meta.guestCount);
    setDebouncedCount(plan.meta.guestCount);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedCount(guestCount);
    }, 200);
    return () => clearTimeout(timer);
  }, [guestCount]);

  const preview: PropagationPreviewResult = propagationPreview(
    plan,
    debouncedCount,
    engineContext,
  );

  const isOver = preview.impact.overCap;
  const cap = preview.impact.budgetCap;
  const afterTotal = preview.impact.budgetTotalAfter;

  const handlePropose = () => {
    const today = new Date().toISOString().split('T')[0] ?? '2026-01-01';
    const res = resolveIntent(
      plan,
      { kind: 'change_guest_count', guestCount: debouncedCount },
      engineContext,
      today,
    );
    setOutcome(res);
  };

  return (
    <Card className={`p-5 bg-white border border-border space-y-4 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="font-serif font-bold text-base text-ink">
            What if the guest count changes?
          </h3>
          <p className="text-xs text-ink-muted mt-0.5">
            Test headcount shifts with instant recalculation of tables, servings, and budget feasibility.
          </p>
        </div>

        <div className="w-40 shrink-0">
          <Field label="Projected guests" id="what-if-guests-input">
            <NumberInput
              id="what-if-guests-input"
              value={guestCount}
              onChange={(e) => setGuestCount(Math.max(1, Math.min(5000, Number(e.target.value) || 1)))}
              min={1}
              max={5000}
              step={5}
            />
          </Field>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
        {/* Logistics metrics */}
        <div className="rounded-lg border border-border p-3 bg-surface-warm space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-primary">
            Logistics Summary
          </h4>
          <table className="w-full text-xs">
            <caption className="sr-only">Guest Metrics Projection</caption>
            <thead>
              <tr className="border-b border-border text-ink-muted">
                <th scope="col" className="text-left py-1">Metric</th>
                <th scope="col" className="text-right py-1">Current ({plan.meta.guestCount})</th>
                <th scope="col" className="text-right py-1">Projected ({debouncedCount})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <th scope="row" className="py-1 font-normal text-left">Banquet Tables (8 seats)</th>
                <td className="text-right py-1 font-medium">{preview.metricsBefore.tables}</td>
                <td className="text-right py-1 font-bold text-ink">{preview.metricsAfter.tables}</td>
              </tr>
              <tr>
                <th scope="row" className="py-1 font-normal text-left">Catering Servings</th>
                <td className="text-right py-1 font-medium">{preview.metricsBefore.servings}</td>
                <td className="text-right py-1 font-bold text-ink">{preview.metricsAfter.servings}</td>
              </tr>
              <tr>
                <th scope="row" className="py-1 font-normal text-left">Invitation Households</th>
                <td className="text-right py-1 font-medium">{preview.metricsBefore.households}</td>
                <td className="text-right py-1 font-bold text-ink">{preview.metricsAfter.households}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Financial projection */}
        <div className="rounded-lg border border-border p-3 bg-surface-warm space-y-2 flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-primary">
              Projected Total & Feasibility
            </h4>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-lg font-serif font-bold text-ink">
                {formatInr(afterTotal)}
              </span>
              <span className="text-xs text-ink-muted">
                (diff: {afterTotal >= preview.impact.budgetTotalBefore ? '+' : ''}
                {formatInr(afterTotal - preview.impact.budgetTotalBefore)})
              </span>
            </div>
            {cap !== null && (
              <div className="mt-1">
                {isOver ? (
                  <Badge tone="danger">
                    Over cap by {formatInr(afterTotal - cap)}
                  </Badge>
                ) : (
                  <Badge tone="success">
                    Within cap ({formatInr(cap - afterTotal)} to spare)
                  </Badge>
                )}
              </div>
            )}
            {preview.conflictsAfter.length > 0 && (
              <p className="text-xs text-danger mt-2 font-medium">
                {preview.conflictsAfter.length} conflict(s) would emerge at this guest count.
              </p>
            )}
          </div>

          <div className="pt-2">
            <Button
              size="sm"
              variant="primary"
              onClick={handlePropose}
              disabled={debouncedCount === plan.meta.guestCount}
              className="w-full"
            >
              Propose this change
            </Button>
          </div>
        </div>
      </div>

      {preview.impact.changedItems.length > 0 && (
        <div className="pt-2 border-t border-border">
          <h4 className="text-xs font-semibold text-ink-muted mb-2 uppercase tracking-wider">
            Items that scale with this headcount
          </h4>
          <div className="overflow-x-auto max-h-36 overflow-y-auto">
            <table className="w-full text-xs text-left">
              <caption className="sr-only">Scaled Line Items</caption>
              <thead>
                <tr className="border-b border-border text-ink-muted">
                  <th scope="col" className="py-1">Item</th>
                  <th scope="col" className="py-1 text-right">Current</th>
                  <th scope="col" className="py-1 text-right">Projected</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-muted">
                {preview.impact.changedItems.map((ci) => (
                  <tr key={ci.label}>
                    <th scope="row" className="py-1 font-normal text-ink">{ci.label}</th>
                    <td className="py-1 text-right text-ink-muted">{formatInr(ci.before)}</td>
                    <td className="py-1 text-right font-semibold text-ink">{formatInr(ci.after)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {outcome && (
        <div className="pt-3 border-t border-border">
          <AssistantOutcomeView
            outcome={outcome}
            eventId={eventId}
            plan={plan}
            currentVersion={plan.version}
          />
        </div>
      )}
    </Card>
  );
}
