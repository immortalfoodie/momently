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
    <Card className={`p-4 sm:p-6 bg-white border border-border space-y-6 ${className}`}>
      {/* Derived metrics strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-3.5 rounded-[12px] bg-surface-warm border border-border space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
            Food servings
          </span>
          <p className="text-2xl font-serif font-bold text-ink">{metrics.servings}</p>
          <p className="text-xs text-ink-muted">Includes 5% safety buffer</p>
        </div>

        <div className="p-3.5 rounded-[12px] bg-surface-warm border border-border space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
            Banquet tables
          </span>
          <p className="text-2xl font-serif font-bold text-ink">{metrics.tables}</p>
          <p className="text-xs text-ink-muted">Assumes 8 seats per table</p>
        </div>

        <div className="p-3.5 rounded-[12px] bg-surface-warm border border-border space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
            Households
          </span>
          <p className="text-2xl font-serif font-bold text-ink">{metrics.households}</p>
          <p className="text-xs text-ink-muted">
            Invitations to send (assumes about 3 guests per invitation)
          </p>
        </div>
      </div>

      {/* Breakdown table */}
      <div className="space-y-2">
        <div
          tabIndex={0}
          role="region"
          aria-label="Dietary breakdown table"
          className="overflow-x-auto rounded-[12px] border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <table className="w-full text-left text-sm border-collapse">
            <caption className="sr-only">Dietary breakdown for catering provisions</caption>
            <thead>
              <tr className="bg-surface-warm border-b border-border">
                <th scope="col" className="py-2.5 px-4 font-semibold text-ink">
                  Dietary preference
                </th>
                <th scope="col" className="py-2.5 px-4 font-semibold text-ink text-right">
                  Count
                </th>
                <th scope="col" className="py-2.5 px-4 font-semibold text-ink text-right">
                  Share
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => {
                const pct = totalGuests > 0 ? Math.round((r.count / totalGuests) * 100) : 0;
                return (
                  <tr key={r.label} className="hover:bg-bg">
                    <td className="py-2.5 px-4 text-ink font-medium">{r.label}</td>
                    <td className="py-2.5 px-4 text-ink-muted text-right">{r.count}</td>
                    <td className="py-2.5 px-4 text-ink-muted text-right">{pct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-ink-muted italic">Hint: Share these numbers with your caterer.</p>
      </div>
    </Card>
  );
}
