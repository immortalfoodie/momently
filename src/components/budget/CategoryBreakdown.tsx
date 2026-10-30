import type { EventPlan } from '@/domain/types';
import { Card } from '@/components/ui/Card';
import { formatInr } from '@/lib/format';
import { buildBudgetView } from '@/engine/budgetView';

export interface CategoryBreakdownProps {
  plan: EventPlan;
  className?: string;
}

/**
 * CategoryBreakdown renders a semantic HTML table of budget expenditures by category.
 * WHY: The table serves as the primary accessible structure; internal progress bars are decorative.
 */
export function CategoryBreakdown({ plan, className = '' }: CategoryBreakdownProps) {
  const { categories, total } = buildBudgetView(plan);

  if (categories.length === 0) {
    return (
      <Card className={`p-5 bg-white border border-border ${className}`}>
        <p className="text-sm text-ink-muted">No budget items recorded yet.</p>
      </Card>
    );
  }

  return (
    <Card className={`p-5 bg-white border border-border space-y-3 ${className}`}>
      <div
        tabIndex={0}
        role="region"
        aria-label="Category Breakdown"
        className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <table className="w-full text-left text-sm border-collapse">
          <caption className="text-left font-serif font-bold text-base text-ink mb-3">
            Category Breakdown
          </caption>
          <thead>
            <tr className="border-b border-border text-xs font-semibold uppercase tracking-wider text-ink-muted">
              <th scope="col" className="py-2 pr-4">
                Category
              </th>
              <th scope="col" className="py-2 px-4 w-1/3 min-w-[120px]">
                Distribution
              </th>
              <th scope="col" className="py-2 px-4 text-right">
                Amount
              </th>
              <th scope="col" className="py-2 pl-4 text-right">
                Share
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-muted">
            {categories.map((cat) => (
              <tr key={cat.category} className="hover:bg-surface-warm transition-colors">
                <th scope="row" className="py-2.5 pr-4 font-medium text-ink">
                  {cat.label}
                </th>
                <td className="py-2.5 px-4 align-middle">
                  <div
                    className="h-2 w-full bg-surface-muted rounded-full overflow-hidden"
                    aria-hidden="true"
                  >
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, Math.max(2, cat.sharePercent))}%`,
                      }}
                    />
                  </div>
                </td>
                <td className="py-2.5 px-4 text-right font-medium text-ink">
                  {formatInr(cat.total)}
                </td>
                <td className="py-2.5 pl-4 text-right text-xs text-ink-muted">
                  {cat.sharePercent}%
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border font-semibold text-ink">
              <th scope="row" className="py-2.5 pr-4">
                Total Allocated
              </th>
              <td className="py-2.5 px-4" aria-hidden="true" />
              <td className="py-2.5 px-4 text-right">{formatInr(total)}</td>
              <td className="py-2.5 pl-4 text-right text-xs text-ink-muted">100%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}
