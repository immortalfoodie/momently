'use client';

import type { ReactNode } from 'react';
import type { EventPlan } from '@/domain/types';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { diffPlans, type PlanDiff } from '@/engine/diff';
import { formatInr } from '@/lib/format';

export interface CompareVersionDialogProps {
  open: boolean;
  onClose: () => void;
  snapshotPlan: EventPlan | null;
  currentPlan: EventPlan;
  versionNumber: number;
}

interface DiffSectionProps {
  diff: PlanDiff;
  versionNumber: number;
}

function BudgetImpact({ diff, versionNumber }: DiffSectionProps) {
  return (
    <div className="p-3 rounded-lg border border-border bg-surface-warm space-y-1">
      <h4 className="font-semibold text-sm text-ink">Budget Impact</h4>
      <p className="text-ink-muted">
        v{versionNumber}: <span className="font-medium text-ink">{formatInr(diff.budgetTotalBefore)}</span> → Current:{' '}
        <span className="font-bold text-ink">{formatInr(diff.budgetTotalAfter)}</span>{' '}
        (diff: {diff.budgetTotalAfter >= diff.budgetTotalBefore ? '+' : ''}
        {formatInr(diff.budgetTotalAfter - diff.budgetTotalBefore)})
      </p>
    </div>
  );
}

function MetaChanges({ diff, versionNumber }: DiffSectionProps) {
  if (diff.meta.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <h4 className="font-semibold text-ink">Celebration Details</h4>
      <table className="w-full text-left border-collapse border border-border">
        <caption className="sr-only">Celebration Detail Changes</caption>
        <thead>
          <tr className="bg-surface-warm text-ink-muted border-b border-border">
            <th scope="col" className="p-2">Field</th>
            <th scope="col" className="p-2">In v{versionNumber}</th>
            <th scope="col" className="p-2">In Current</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {diff.meta.map((m) => (
            <tr key={m.field}>
              <th scope="row" className="p-2 font-medium capitalize text-ink">{m.field}</th>
              <td className="p-2 text-ink-muted">{String(m.before)}</td>
              <td className="p-2 font-medium text-ink">{String(m.after)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface ChangeListProps {
  count: number;
  label: string;
  labelClassName: string;
  children: ReactNode;
}

function ChangeList({ count, label, labelClassName, children }: ChangeListProps) {
  if (count === 0) return null;
  return (
    <div className="space-y-1">
      <span className={`font-medium ${labelClassName}`}>{label}</span>
      <ul className="list-disc pl-5 text-ink-muted space-y-0.5">{children}</ul>
    </div>
  );
}

function LineItemChanges({ items }: { items: PlanDiff['items'] }) {
  const { added, removed, changed } = items;
  if (added.length + removed.length + changed.length === 0) return null;
  return (
    <div className="space-y-2">
      <h4 className="font-semibold text-ink">Budget Line Changes</h4>

      <ChangeList count={added.length} label="Added Items:" labelClassName="text-success">
        {added.map((item, i) => (
          <li key={i}>
            {item.label} (+{formatInr(item.total)})
          </li>
        ))}
      </ChangeList>

      <ChangeList count={removed.length} label="Removed Items:" labelClassName="text-danger">
        {removed.map((item, i) => (
          <li key={i}>
            {item.label} (-{formatInr(item.total)})
          </li>
        ))}
      </ChangeList>

      <ChangeList count={changed.length} label="Price Adjustments:" labelClassName="text-warning">
        {changed.map((item, i) => (
          <li key={i}>
            {item.label}: {formatInr(item.before)} → {formatInr(item.after)}
          </li>
        ))}
      </ChangeList>
    </div>
  );
}

function ConceptChange({ concept }: { concept: PlanDiff['concept'] }) {
  if (!concept) return null;
  return (
    <div className="p-2.5 rounded bg-surface-warm border border-border">
      <span className="font-semibold text-ink">Concept change: </span>
      <span className="text-ink-muted">{concept.before ?? 'None'}</span> →{' '}
      <span className="font-medium text-primary">{concept.after ?? 'None'}</span>
    </div>
  );
}

/**
 * CompareVersionDialog presents an accessible side-by-side diff between a historical snapshot and current state.
 * WHY: Answers "What changed between version N and now?" across meta, budget, line items, and schedule.
 */
export function CompareVersionDialog({
  open,
  onClose,
  snapshotPlan,
  currentPlan,
  versionNumber,
}: CompareVersionDialogProps) {
  if (!snapshotPlan) return null;

  const diff = diffPlans(snapshotPlan, currentPlan);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Compare Version ${versionNumber} with Current (v${currentPlan.version})`}
      description="Review changes applied to celebration parameters, expenditure projections, and line items."
      className="max-w-2xl"
    >
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1 text-xs">
        {/* Budget comparison */}
        <BudgetImpact diff={diff} versionNumber={versionNumber} />

        {/* Meta changes table */}
        <MetaChanges diff={diff} versionNumber={versionNumber} />

        {/* Line item changes */}
        <LineItemChanges items={diff.items} />

        {/* Concept diff */}
        <ConceptChange concept={diff.concept} />

        {/* Logistics & task counters */}
        <div className="flex gap-4 pt-1 text-ink-muted">
          <span>Schedule adjustments: <strong className="text-ink">{diff.scheduleChanges}</strong></span>
          <span>Checklist adjustments: <strong className="text-ink">{diff.taskChanges}</strong></span>
        </div>
      </div>

      <div className="flex justify-end pt-3 border-t border-border mt-4">
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
    </Dialog>
  );
}
