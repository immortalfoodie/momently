import type { EventPlan } from '@/domain/types';
import { Card } from '@/components/ui/Card';
import { deriveGuestMetrics } from '@/engine/guestMetrics';

export interface MealPlanTableProps {
  plan: EventPlan;
  className?: string;
}

export function MealPlanTable({ plan, className = '' }: MealPlanTableProps) {
  const metrics = deriveGuestMetrics(plan.meta.guestCount, plan.guestNeeds);
  const totalGuests = plan.meta.guestCount;
  const breakdown = metrics.mealBreakdown;

  const rows = [
    { label: 'Vegetarian', count: breakdown.vegetarian },
    { label: 'Jain', count: breakdown.jain },
    { label: 'Vegan', count: breakdown.vegan },
    { label: 'Gluten-free', count: breakdown.glutenFree },
    { label: 'Other / no restriction', count: breakdown.other },
  ];

  return (
    <Card className={`p-4 sm:p-6 bg-white border border-[#E6DCD2] space-y-6 ${className}`}>
      {/* Derived metrics strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-3.5 rounded-[12px] bg-[#F5F2EB] border border-[#E6DCD2] space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#7A6B7E]">
            Food servings
          </span>
          <p className="text-2xl font-serif font-bold text-[#2B1B2E]">{metrics.servings}</p>
          <p className="text-xs text-[#5B4A5E]">Includes 5% safety buffer</p>
        </div>

        <div className="p-3.5 rounded-[12px] bg-[#F5F2EB] border border-[#E6DCD2] space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#7A6B7E]">
            Banquet tables
          </span>
          <p className="text-2xl font-serif font-bold text-[#2B1B2E]">{metrics.tables}</p>
          <p className="text-xs text-[#5B4A5E]">Assumes 8 seats per table</p>
        </div>

        <div className="p-3.5 rounded-[12px] bg-[#F5F2EB] border border-[#E6DCD2] space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#7A6B7E]">
            Households
          </span>
          <p className="text-2xl font-serif font-bold text-[#2B1B2E]">{metrics.households}</p>
          <p className="text-xs text-[#5B4A5E]">
            Invitations to send (assumes about 3 guests per invitation)
          </p>
        </div>
      </div>

      {/* Breakdown table */}
      <div className="space-y-2">
        <div className="overflow-x-auto rounded-[12px] border border-[#E6DCD2]">
          <table className="w-full text-left text-sm border-collapse">
            <caption className="sr-only">Dietary breakdown for catering provisions</caption>
            <thead>
              <tr className="bg-[#F5F2EB] border-b border-[#E6DCD2]">
                <th scope="col" className="py-2.5 px-4 font-semibold text-[#2B1B2E]">
                  Dietary preference
                </th>
                <th scope="col" className="py-2.5 px-4 font-semibold text-[#2B1B2E] text-right">
                  Count
                </th>
                <th scope="col" className="py-2.5 px-4 font-semibold text-[#2B1B2E] text-right">
                  Share
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6DCD2]">
              {rows.map((r) => {
                const pct = totalGuests > 0 ? Math.round((r.count / totalGuests) * 100) : 0;
                return (
                  <tr key={r.label} className="hover:bg-[#FAF7F2]">
                    <td className="py-2.5 px-4 text-[#2B1B2E] font-medium">{r.label}</td>
                    <td className="py-2.5 px-4 text-[#5B4A5E] text-right">{r.count}</td>
                    <td className="py-2.5 px-4 text-[#7A6B7E] text-right">{pct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-[#5B4A5E] italic">Hint: Share these numbers with your caterer.</p>
      </div>
    </Card>
  );
}
