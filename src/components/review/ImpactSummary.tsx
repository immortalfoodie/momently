import type { PlanImpact } from '@/domain/types';
import { formatInr } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { Money } from '@/components/ui/Money';

export interface ImpactSummaryProps {
  impact: PlanImpact;
  className?: string;
}

/**
 * Renders the deterministic financial and line-item impact of a proposed plan modification.
 *
 * ACCESSIBILITY DECISION (WHY):
 * Status uses explicit text alongside SVG icons per WCAG 1.4.1 (no color-only semantics).
 * Line item diffs use a semantic table with a descriptive caption and row/column headers.
 */
export function ImpactSummary({ impact, className = '' }: ImpactSummaryProps) {
  const { budgetTotalBefore, budgetTotalAfter, budgetCap, overCap, changedItems, notes } = impact;
  const isOver = overCap || (budgetCap !== null && budgetTotalAfter > budgetCap);
  const overBy = budgetCap !== null ? Math.max(0, budgetTotalAfter - budgetCap) : 0;
  const underBy = budgetCap !== null ? Math.max(0, budgetCap - budgetTotalAfter) : 0;

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-ink-muted">Budget:</span>
          <Money amount={budgetTotalBefore} />
          <span aria-hidden="true" className="text-[#8C7A87]">
            →
          </span>
          <span className="sr-only">to</span>
          <Money amount={budgetTotalAfter} className="font-semibold text-ink" />
        </div>

        {budgetCap !== null ? (
          isOver ? (
            <Badge tone="danger" className="inline-flex items-center gap-1">
              <Icon name="alert" size={14} aria-hidden="true" />
              <span>Over budget cap by {formatInr(overBy)}</span>
            </Badge>
          ) : (
            <Badge tone="success" className="inline-flex items-center gap-1">
              <Icon name="check" size={14} aria-hidden="true" />
              <span>Within budget cap ({formatInr(underBy)} to spare)</span>
            </Badge>
          )
        ) : (
          <Badge tone="neutral" className="inline-flex items-center gap-1">
            <Icon name="check" size={14} aria-hidden="true" />
            <span>No budget cap set</span>
          </Badge>
        )}
      </div>

      {changedItems.length > 0 && (
        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full text-left text-xs">
            <caption className="px-3 py-1.5 text-left text-xs font-medium text-ink-muted bg-surface-warm border-b border-border">
              Item budget changes
            </caption>
            <thead>
              <tr className="border-b border-border bg-surface-muted text-ink">
                <th scope="col" className="px-3 py-1.5 font-semibold">
                  Item
                </th>
                <th scope="col" className="px-3 py-1.5 font-semibold text-right">
                  Before
                </th>
                <th scope="col" className="px-3 py-1.5 font-semibold text-right">
                  After
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {changedItems.map((item) => (
                <tr key={item.label} className="hover:bg-surface-warm">
                  <th scope="row" className="px-3 py-1.5 font-normal text-ink">
                    {item.label}
                  </th>
                  <td className="px-3 py-1.5 text-right text-ink-muted">
                    <Money amount={item.before} />
                  </td>
                  <td className="px-3 py-1.5 text-right font-medium text-ink">
                    <Money amount={item.after} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {notes.length > 0 && (
        <ul className="list-disc pl-5 text-xs text-ink-muted space-y-0.5" aria-label="Notes">
          {notes.map((note, index) => (
            <li key={index}>{note}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
