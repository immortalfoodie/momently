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
          <span className="text-[#5C4556]">Budget:</span>
          <Money amount={budgetTotalBefore} />
          <span aria-hidden="true" className="text-[#8C7A87]">
            →
          </span>
          <span className="sr-only">to</span>
          <Money amount={budgetTotalAfter} className="font-semibold text-[#2B1B2E]" />
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
        <div className="overflow-x-auto rounded border border-[#E6DCD2]">
          <table className="w-full text-left text-xs">
            <caption className="px-3 py-1.5 text-left text-xs font-medium text-[#5C4556] bg-[#FAF5F0] border-b border-[#E6DCD2]">
              Item budget changes
            </caption>
            <thead>
              <tr className="border-b border-[#E6DCD2] bg-[#F4EDE6] text-[#2B1B2E]">
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
            <tbody className="divide-y divide-[#E6DCD2]">
              {changedItems.map((item) => (
                <tr key={item.label} className="hover:bg-[#FAF5F0]">
                  <th scope="row" className="px-3 py-1.5 font-normal text-[#2B1B2E]">
                    {item.label}
                  </th>
                  <td className="px-3 py-1.5 text-right text-[#5C4556]">
                    <Money amount={item.before} />
                  </td>
                  <td className="px-3 py-1.5 text-right font-medium text-[#2B1B2E]">
                    <Money amount={item.after} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {notes.length > 0 && (
        <ul className="list-disc pl-5 text-xs text-[#5C4556] space-y-0.5" aria-label="Notes">
          {notes.map((note, index) => (
            <li key={index}>{note}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
