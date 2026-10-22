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
      <Card className={`p-5 bg-white border border-[#E6DCD2] ${className}`}>
        <p className="text-sm text-[#5B4A5E]">No budget items recorded yet.</p>
      </Card>
    );
  }

  return (
    <Card className={`p-5 bg-white border border-[#E6DCD2] space-y-3 ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <caption className="text-left font-serif font-bold text-base text-[#2B1B2E] mb-3">
            Category Breakdown
          </caption>
          <thead>
            <tr className="border-b border-[#E6DCD2] text-xs font-semibold uppercase tracking-wider text-[#5B4A5E]">
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
          <tbody className="divide-y divide-[#F4EDE6]">
            {categories.map((cat) => (
              <tr key={cat.category} className="hover:bg-[#FAF5F0] transition-colors">
                <th scope="row" className="py-2.5 pr-4 font-medium text-[#2B1B2E]">
                  {cat.label}
                </th>
                <td className="py-2.5 px-4 align-middle">
                  <div
                    className="h-2 w-full bg-[#F4EDE6] rounded-full overflow-hidden"
                    aria-hidden="true"
                  >
                    <div
                      className="h-full bg-[#6B2D5C] rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, Math.max(2, cat.sharePercent))}%`,
                      }}
                    />
                  </div>
                </td>
                <td className="py-2.5 px-4 text-right font-medium text-[#2B1B2E]">
                  {formatInr(cat.total)}
                </td>
                <td className="py-2.5 pl-4 text-right text-xs text-[#5B4A5E]">
                  {cat.sharePercent}%
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[#E6DCD2] font-semibold text-[#2B1B2E]">
              <th scope="row" className="py-2.5 pr-4">
                Total Allocated
              </th>
              <td className="py-2.5 px-4" aria-hidden="true" />
              <td className="py-2.5 px-4 text-right">{formatInr(total)}</td>
              <td className="py-2.5 pl-4 text-right text-xs text-[#5B4A5E]">100%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}
