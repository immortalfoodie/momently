'use client';

import { useMemo, useState } from 'react';
import type { EventPlan, VendorNeed, VendorQuote } from '@/domain/types';
import { useUserEdit } from '@/components/budget/useUserEdit';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { useAnnouncer } from '@/components/ui/LiveRegion';
import { previewOps } from '@/engine/preview';
import { quoteToBudgetOps } from '@/engine/quoteToBudget';
import { formatInr } from '@/lib/format';
import { engineContext } from '@/store/engineContext';

export interface UseQuoteButtonProps {
  plan: EventPlan;
  need: VendorNeed;
  quote: VendorQuote;
  eventId: string;
  className?: string;
}

export function UseQuoteButton({
  plan,
  need,
  quote,
  eventId,
  className = '',
}: UseQuoteButtonProps) {
  const { announce } = useAnnouncer();
  const { applyEdit } = useUserEdit(eventId);
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  // Derive ops & preview
  const budgetOpsResult = useMemo(() => {
    return quoteToBudgetOps(plan, need, quote, confirmed, engineContext);
  }, [plan, need, quote, confirmed]);

  const preview = useMemo(() => {
    if (!budgetOpsResult.ok) return null;
    return previewOps(plan, budgetOpsResult.value.ops, engineContext);
  }, [plan, budgetOpsResult]);

  const handleApply = async () => {
    if (!budgetOpsResult.ok) return;

    setIsApplying(true);
    const success = await applyEdit(
      budgetOpsResult.value.ops,
      budgetOpsResult.value.summary,
      need.category,
    );
    setIsApplying(false);

    if (success) {
      announce(`Budget updated with quote from ${quote.vendorName}.`);
      setOpen(false);
    } else {
      // If over cap, useUserEdit opened the funding modal, close this dialog
      setOpen(false);
    }
  };

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
        className={`min-h-[44px] ${className}`}
      >
        Use this price in my budget
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Apply quote: ${quote.vendorName}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-[#5B4A5E]">
            This will update your budget line for <strong>{need.category}</strong> to{' '}
            <strong>{formatInr(quote.price)}</strong>.
          </p>

          <label className="min-h-[44px] inline-flex items-center gap-2.5 cursor-pointer text-sm font-medium text-[#2B1B2E]">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="w-5 h-5 rounded border-[#E6DCD2] text-[#2B1B2E] focus:ring-1 focus:ring-[#2B1B2E]"
            />
            <span>This is a confirmed written quote (marks provenance as verified)</span>
          </label>

          {!budgetOpsResult.ok ? (
            <div className="p-3.5 rounded-[12px] bg-[#FBE9EB] border border-[#F4C5CB] text-sm text-[#A12B3A]">
              {budgetOpsResult.error.message}
            </div>
          ) : (
            preview?.ok && (
              <div className="p-3.5 rounded-[12px] bg-[#F5F2EB] border border-[#E6DCD2] space-y-1.5 text-xs text-[#5B4A5E]">
                <div className="flex justify-between">
                  <span>Current budget total:</span>
                  <span className="font-semibold text-[#2B1B2E]">
                    {formatInr(preview.value.impact.budgetTotalBefore)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>New budget total:</span>
                  <span className="font-bold text-[#2B1B2E]">
                    {formatInr(preview.value.impact.budgetTotalAfter)}
                  </span>
                </div>
                {preview.value.impact.overCap && (
                  <p className="text-[#A82B35] pt-1 border-t border-[#E6DCD2] font-semibold">
                    Warning: This quote will push your plan over the budget cap. You will be prompted to rebalance savings.
                  </p>
                )}
              </div>
            )
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
              className="min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={!budgetOpsResult.ok || isApplying}
              onClick={handleApply}
              className="min-h-[44px]"
            >
              {isApplying ? 'Applying...' : 'Apply to budget'}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
