'use client';

import { useState, Fragment } from 'react';
import type { BudgetItem, EventPlan } from '@/domain/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';
import { ProvenanceBadge } from '@/components/ui/ProvenanceBadge';
import { formatInr } from '@/lib/format';
import { itemTotal } from '@/engine/budget';
import { buildBudgetView } from '@/engine/budgetView';

export interface LineItemsTableProps {
  plan: EventPlan;
  onEditPrice: (item: BudgetItem) => void;
  onToggleLock: (item: BudgetItem) => void;
  onRemoveItem: (item: BudgetItem) => void;
  className?: string;
}

/**
 * LineItemsTable displaying granular expense items categorized with lock controls, provenance badges, and actions.
 * WHY: Answers "Where is every rupee allocated?" and enforces host control over locked line items.
 */
export function LineItemsTable({
  plan,
  onEditPrice,
  onToggleLock,
  onRemoveItem,
  className = '',
}: LineItemsTableProps) {
  const { categories } = buildBudgetView(plan);
  const [itemToRemove, setItemToRemove] = useState<BudgetItem | null>(null);

  const confirmRemove = () => {
    if (itemToRemove) {
      onRemoveItem(itemToRemove);
      setItemToRemove(null);
    }
  };

  return (
    <Card className={`p-5 bg-white border border-border space-y-4 ${className}`}>
      <div
        tabIndex={0}
        role="region"
        aria-label="Budget Line Items"
        className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <table className="w-full text-left text-sm border-collapse">
          <caption className="text-left font-serif font-bold text-base text-ink mb-3">
            Budget Line Items
          </caption>
          <thead>
            <tr className="border-b border-border text-xs font-semibold uppercase tracking-wider text-ink-muted">
              <th scope="col" className="py-2.5 pr-4">Item</th>
              <th scope="col" className="py-2.5 px-3">Basis</th>
              <th scope="col" className="py-2.5 px-3 text-right">Price</th>
              <th scope="col" className="py-2.5 px-2 text-center">Qty</th>
              <th scope="col" className="py-2.5 px-3 text-right">
                Total at {plan.meta.guestCount} guests
              </th>
              <th scope="col" className="py-2.5 px-3">Source</th>
              <th scope="col" className="py-2.5 pl-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-muted">
            {categories.map((cat) => (
              <Fragment key={`group-${cat.category}`}>
                <tr className="bg-bg font-semibold text-xs uppercase tracking-wider text-primary">
                  <td colSpan={7} className="py-2 px-3">
                    {cat.label} ({cat.items.length})
                  </td>
                </tr>
                {cat.items.map(({ item, total }) => (
                  <tr key={item.id} className="hover:bg-surface-warm transition-colors">
                    <th scope="row" className="py-3 pr-4 font-normal text-left">
                      <div className="font-semibold text-ink">{item.label}</div>
                      {item.note && (
                        <div className="text-xs text-ink-muted mt-0.5">{item.note}</div>
                      )}
                      {item.locked && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-warning mt-1 bg-warning-bg px-2 py-0.5 rounded">
                          <Icon name="lock" size={12} aria-hidden="true" />
                          Locked by you: Momently won&apos;t change it
                        </span>
                      )}
                    </th>
                    <td className="py-3 px-3 text-ink-muted capitalize whitespace-nowrap">
                      {item.basis === 'per_guest' ? 'per guest' : 'flat'}
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-ink whitespace-nowrap">
                      {formatInr(item.unitCost)}
                    </td>
                    <td className="py-3 px-2 text-center text-ink-muted">
                      {item.quantity}
                    </td>
                    <td className="py-3 px-3 text-right font-semibold text-ink whitespace-nowrap">
                      {formatInr(total)}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <ProvenanceBadge provenance={item.provenance} />
                    </td>
                    <td className="py-3 pl-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onEditPrice(item)}
                        >
                          Edit price
                        </Button>

                        <button
                          type="button"
                          aria-pressed={item.locked}
                          onClick={() => onToggleLock(item)}
                          className={`inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-[8px] text-xs font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                            item.locked
                              ? 'bg-warning-bg text-warning border-gold'
                              : 'bg-white text-ink-muted border-border hover:bg-surface-muted'
                          }`}
                        >
                          <Icon
                            name="lock"
                            size={12}
                            aria-hidden="true"
                          />
                          <span>{item.locked ? 'Locked' : 'Lock'}</span>
                        </button>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setItemToRemove(item)}
                          disabled={item.locked}
                          title={item.locked ? "Unlock this item before removing" : undefined}
                          aria-label={item.locked ? `Remove ${item.label} (disabled: unlock first)` : `Remove ${item.label}`}
                          className={item.locked ? 'opacity-40 cursor-not-allowed' : 'text-danger hover:bg-danger-bg'}
                        >
                          Remove
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog
        open={Boolean(itemToRemove)}
        onClose={() => setItemToRemove(null)}
        title="Remove Budget Line Item"
        description="Are you sure you want to remove this item from your budget? This will adjust your overall spending projection."
      >
        <div className="py-3">
          <p className="text-sm text-ink">
            Item: <span className="font-semibold">{itemToRemove?.label}</span> (
            {itemToRemove && formatInr(itemTotal(itemToRemove, plan.meta.guestCount))})
          </p>
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t border-border">
          <Button variant="ghost" onClick={() => setItemToRemove(null)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={confirmRemove}>
            Remove Item
          </Button>
        </div>
      </Dialog>
    </Card>
  );
}
