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
    <Card className={`p-5 bg-white border border-[#E6DCD2] space-y-4 ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <caption className="text-left font-serif font-bold text-base text-[#2B1B2E] mb-3">
            Budget Line Items
          </caption>
          <thead>
            <tr className="border-b border-[#E6DCD2] text-xs font-semibold uppercase tracking-wider text-[#5B4A5E]">
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
          <tbody className="divide-y divide-[#F4EDE6]">
            {categories.map((cat) => (
              <Fragment key={`group-${cat.category}`}>
                <tr className="bg-[#FBF7F2] font-semibold text-xs uppercase tracking-wider text-[#6B2D5C]">
                  <td colSpan={7} className="py-2 px-3">
                    {cat.label} ({cat.items.length})
                  </td>
                </tr>
                {cat.items.map(({ item, total }) => (
                  <tr key={item.id} className="hover:bg-[#FAF5F0] transition-colors">
                    <th scope="row" className="py-3 pr-4 font-normal text-left">
                      <div className="font-semibold text-[#2B1B2E]">{item.label}</div>
                      {item.note && (
                        <div className="text-xs text-[#5B4A5E] mt-0.5">{item.note}</div>
                      )}
                      {item.locked && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-[#8A5A00] mt-1 bg-[#FFF4DC] px-2 py-0.5 rounded">
                          <Icon name="lock" size={12} aria-hidden="true" />
                          Locked by you: Momently won&apos;t change it
                        </span>
                      )}
                    </th>
                    <td className="py-3 px-3 text-[#5B4A5E] capitalize whitespace-nowrap">
                      {item.basis === 'per_guest' ? 'per guest' : 'flat'}
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-[#2B1B2E] whitespace-nowrap">
                      {formatInr(item.unitCost)}
                    </td>
                    <td className="py-3 px-2 text-center text-[#5B4A5E]">
                      {item.quantity}
                    </td>
                    <td className="py-3 px-3 text-right font-semibold text-[#2B1B2E] whitespace-nowrap">
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
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                            item.locked
                              ? 'bg-[#FFF4DC] text-[#8A5A00] border-[#D4A24C]'
                              : 'bg-white text-[#5B4A5E] border-[#E6DCD2] hover:bg-[#F4EDE6]'
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
                          className={item.locked ? 'opacity-40 cursor-not-allowed' : 'text-[#A12B3A] hover:bg-[#FBE9EB]'}
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
          <p className="text-sm text-[#2B1B2E]">
            Item: <span className="font-semibold">{itemToRemove?.label}</span> (
            {itemToRemove && formatInr(itemTotal(itemToRemove, plan.meta.guestCount))})
          </p>
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t border-[#E6DCD2]">
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
