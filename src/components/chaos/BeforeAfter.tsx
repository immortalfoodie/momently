'use client';

import type { EventPlan } from '@/domain/types';
import { getBudgetCap } from '@/engine/budget';
import { previewOption, type RecoveryOption } from '@/engine/chaos';
import { scoreRisks } from '@/engine/risk';
import { formatInr } from '@/lib/format';
import { Alert } from '@/components/ui/Alert';
import { engineContext } from '@/store/engineContext';

export interface BeforeAfterProps {
  plan: EventPlan;
  option: RecoveryOption;
  className?: string;
}

/**
 * Side-by-side comparison matrix showing plan metrics before and after applying a proposed recovery option.
 */
export function BeforeAfter({ plan, option, className = '' }: BeforeAfterProps) {
  const preview = previewOption(plan, option, engineContext);

  if (!preview.ok) {
    return (
      <Alert tone="danger" className={className}>
        <p className="font-semibold text-sm mb-1">Preview Projection Failed</p>
        {preview.error.message}
      </Alert>
    );
  }

  const { diff, scoreAfter, plan: projectedPlan } = preview.value;
  const scoreBefore = scoreRisks(plan, engineContext).score;
  const cap = getBudgetCap(plan.constraints);

  const formatVsCap = (total: number) => {
    if (cap === null) return 'No cap set';
    const delta = total - cap;
    if (delta > 0) return `Over cap by ${formatInr(delta)}`;
    return `Within cap (${formatInr(Math.abs(delta))} margin)`;
  };

  const lineItemsChangedCount =
    diff.items.added.length + diff.items.removed.length + diff.items.changed.length;

  const changedItemSummaries: string[] = [
    ...diff.items.added.map((i) => `Added: ${i.label} (${formatInr(i.total)})`),
    ...diff.items.removed.map((i) => `Removed: ${i.label} (${formatInr(i.total)})`),
    ...diff.items.changed.map(
      (i) => `Adjusted: ${i.label} (${formatInr(i.before)} → ${formatInr(i.after)})`,
    ),
  ].slice(0, 5);

  return (
    <div className={`space-y-3 bg-[#FAF5F0] p-4 rounded-xl border border-[#E6DCD2] ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <caption className="font-semibold text-xs text-[#2B1B2E] mb-2 text-left">
            Current plan versus after this recovery
          </caption>
          <thead>
            <tr className="border-b border-[#E6DCD2] text-[#5C4556]">
              <th scope="col" className="py-1.5 pr-3 font-semibold">Dimension</th>
              <th scope="col" className="py-1.5 px-3 font-semibold">Current plan</th>
              <th scope="col" className="py-1.5 pl-3 font-semibold">After recovery</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E6DCD2]/60 text-[#2B1B2E]">
            <tr>
              <th scope="row" className="py-1.5 pr-3 font-medium text-[#5C4556]">Chaos Score</th>
              <td className="py-1.5 px-3 tabular-nums">{scoreBefore} / 100</td>
              <td className="py-1.5 pl-3 tabular-nums font-semibold text-[#6B2D5C]">{scoreAfter} / 100</td>
            </tr>
            <tr>
              <th scope="row" className="py-1.5 pr-3 font-medium text-[#5C4556]">Budget total</th>
              <td className="py-1.5 px-3 tabular-nums">{formatInr(diff.budgetTotalBefore)}</td>
              <td className="py-1.5 pl-3 tabular-nums font-semibold">{formatInr(diff.budgetTotalAfter)}</td>
            </tr>
            <tr>
              <th scope="row" className="py-1.5 pr-3 font-medium text-[#5C4556]">Versus the cap</th>
              <td className="py-1.5 px-3">{formatVsCap(diff.budgetTotalBefore)}</td>
              <td className="py-1.5 pl-3 font-medium">{formatVsCap(diff.budgetTotalAfter)}</td>
            </tr>
            <tr>
              <th scope="row" className="py-1.5 pr-3 font-medium text-[#5C4556]">Guest count</th>
              <td className="py-1.5 px-3 tabular-nums">{plan.meta.guestCount} guests</td>
              <td className="py-1.5 pl-3 tabular-nums">{projectedPlan.meta.guestCount} guests</td>
            </tr>
            <tr>
              <th scope="row" className="py-1.5 pr-3 font-medium text-[#5C4556]">Schedule changes</th>
              <td className="py-1.5 px-3">0 changes</td>
              <td className="py-1.5 pl-3 tabular-nums">{diff.scheduleChanges} slot(s) modified</td>
            </tr>
            <tr>
              <th scope="row" className="py-1.5 pr-3 font-medium text-[#5C4556]">Tasks added</th>
              <td className="py-1.5 px-3">0 tasks</td>
              <td className="py-1.5 pl-3 tabular-nums">{diff.taskChanges} task(s) added</td>
            </tr>
            <tr>
              <th scope="row" className="py-1.5 pr-3 font-medium text-[#5C4556]">Line items changed</th>
              <td className="py-1.5 px-3">0 items</td>
              <td className="py-1.5 pl-3 tabular-nums">{lineItemsChangedCount} item(s)</td>
            </tr>
            <tr>
              <th scope="row" className="py-1.5 pr-3 font-medium text-[#5C4556]">Concept</th>
              <td className="py-1.5 px-3">{diff.concept?.before ?? 'Unchanged'}</td>
              <td className="py-1.5 pl-3">{diff.concept?.after ?? 'Unchanged'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {changedItemSummaries.length > 0 && (
        <div className="pt-2 border-t border-[#E6DCD2]/60 space-y-1">
          <p className="text-[11px] font-semibold text-[#5C4556]">Key line-item adjustments:</p>
          <ul className="list-disc pl-4 text-[11px] text-[#5C4556] space-y-0.5">
            {changedItemSummaries.map((summary, idx) => (
              <li key={idx}>{summary}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
