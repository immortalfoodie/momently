'use client';

import type { EventPlan } from '@/domain/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { CopyTextOptions } from '@/components/ui/useCopyText';
import {
  orderQuantities,
  orderQuantitiesToText,
} from '@/lib/export/orderQuantities';

export interface KitOrderQuantitiesCardProps {
  plan: EventPlan;
  onCopy: (text: string, options?: CopyTextOptions) => Promise<boolean>;
}

export function KitOrderQuantitiesCard({
  plan,
  onCopy,
}: KitOrderQuantitiesCardProps) {
  const rows = orderQuantities(plan);

  const handleCopyQuantities = async () => {
    const text = orderQuantitiesToText(rows);
    await onCopy(text, {
      announceText: 'Copied order quantities',
      title: 'Order quantities',
    });
  };

  return (
    <Card className="p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-serif font-bold text-ink">
            Order quantities
          </h2>
          <p className="text-sm text-ink-muted">
            Practical catering, seating, invitation and favour counts derived from your guest breakdown.
          </p>
        </div>

        <div>
          <Button
            type="button"
            variant="secondary"
            onClick={handleCopyQuantities}
            className="min-h-[44px]"
          >
            Copy as text
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <caption className="sr-only">
            Quantities to share with your caterer and decorator
          </caption>
          <thead>
            <tr className="border-b border-border text-xs font-semibold uppercase tracking-wider text-ink-muted">
              <th scope="col" className="py-2.5 pr-4">
                Item
              </th>
              <th scope="col" className="py-2.5 px-4">
                Quantity
              </th>
              <th scope="col" className="py-2.5 pl-4">
                How we worked it out
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.label}>
                <th scope="row" className="py-3 pr-4 font-semibold text-ink">
                  {row.label}
                </th>
                <td className="py-3 px-4 font-medium text-ink">
                  {row.value}
                </td>
                <td className="py-3 pl-4 text-ink-muted">{row.how}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
