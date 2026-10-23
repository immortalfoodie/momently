import type {
  EventPlan,
  PlanPatchOp,
  VendorNeed,
  VendorQuote,
} from '@/domain/types';
import type { Result } from '@/lib/result';
import { err, ok } from '@/lib/result';
import type { EngineContext } from './context';

export interface QuoteToBudgetSuccess {
  ops: PlanPatchOp[];
  summary: string;
}

export interface QuoteToBudgetError {
  message: string;
}

/**
 * Generates patch operations to apply a selected vendor quote directly to the active budget.
 * WHY: Enforces the verified quote write-path, linking real vendor pricing to budget line items
 * with appropriate provenance tracking.
 *
 * @param plan - Current EventPlan.
 * @param need - VendorNeed corresponding to the quote category.
 * @param quote - Candidate VendorQuote selected by the host.
 * @param confirmed - True if host confirmed written agreement (marks provenance verified), false for user provenance.
 * @param ctx - EngineContext providing ID generator and clock.
 * @returns Result with patch operations and human summary, or error message.
 */
export function quoteToBudgetOps(
  plan: EventPlan,
  need: VendorNeed,
  quote: VendorQuote,
  confirmed: boolean,
  ctx: EngineContext,
): Result<QuoteToBudgetSuccess, QuoteToBudgetError> {
  const provenance = confirmed ? 'verified' : 'user';
  const matchingItem = plan.budgetItems.find(
    (item) => item.category.toLowerCase() === need.category.toLowerCase(),
  );

  if (matchingItem) {
    if (matchingItem.locked) {
      return err({ message: 'Unlock this budget line first' });
    }

    const updateOp: PlanPatchOp = {
      type: 'update_budget_item',
      id: matchingItem.id,
      changes: {
        basis: 'flat',
        unitCost: quote.price,
        quantity: 1,
        provenance,
        note: `Quote from ${quote.vendorName}`,
      },
    };

    return ok({
      ops: [updateOp],
      summary: `Updated ${matchingItem.label} to ₹${quote.price} (${provenance} quote from ${quote.vendorName})`,
    });
  }

  // No existing line item: add new budget item
  const categoryLabel =
    need.category.charAt(0).toUpperCase() + need.category.slice(1);
  const addOp: PlanPatchOp = {
    type: 'add_budget_item',
    item: {
      id: ctx.ids('item'),
      category: need.category,
      label: `${categoryLabel}: ${quote.vendorName}`,
      basis: 'flat',
      unitCost: quote.price,
      quantity: 1,
      provenance,
      locked: false,
      note: `Quote from ${quote.vendorName}`,
    },
  };

  return ok({
    ops: [addOp],
    summary: `Added budget line for ${quote.vendorName} (${categoryLabel})`,
  });
}
