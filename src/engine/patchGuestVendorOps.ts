import type { EventPlan, GuestNeeds, PlanPatchOp } from '@/domain/types';
import type { OpResult } from './patchOps';
import { err, ok } from '@/lib/result';

export const GUEST_NEEDS_FIELD_LABELS: Record<string, string> = {
  vegetarian: 'Vegetarians',
  jain: 'Jain guests',
  vegan: 'Vegans',
  glutenFree: 'Gluten-free guests',
  allergyAlerts: 'Guests with allergy alerts',
  wheelchairUsers: 'Wheelchair users',
  elderly: 'Elderly guests',
  children: 'Children',
};

const COUNT_FIELDS = [
  'vegetarian',
  'jain',
  'vegan',
  'glutenFree',
  'allergyAlerts',
  'wheelchairUsers',
  'elderly',
  'children',
] as const;

/**
 * Clamps guest needs counts when the total guest headcount is reduced.
 * WHY: Maintains consistency so aggregate demographic requirements never exceed the event size.
 */
export function clampGuestNeedsToCount(
  needs: GuestNeeds,
  newCount: number,
): { needs: GuestNeeds; clampedFields: string[] } {
  const updated = { ...needs };
  const clampedFields: string[] = [];

  for (const field of COUNT_FIELDS) {
    if (updated[field] > newCount) {
      updated[field] = newCount;
      clampedFields.push(GUEST_NEEDS_FIELD_LABELS[field] ?? field);
    }
  }

  return { needs: updated, clampedFields };
}

export function handleSetGuestNeeds(
  plan: EventPlan,
  changes: Partial<GuestNeeds>,
): OpResult {
  const maxGuests = plan.meta.guestCount;

  for (const field of COUNT_FIELDS) {
    const val = changes[field];
    if (typeof val === 'number' && val > maxGuests) {
      const label = GUEST_NEEDS_FIELD_LABELS[field] ?? field;
      return err({
        code: 'invalid_change',
        message: `${label} can't be more than your guest count of ${maxGuests}`,
      });
    }
  }

  const updatedPlan: EventPlan = {
    ...plan,
    guestNeeds: {
      ...plan.guestNeeds,
      ...changes,
    },
  };

  return ok({ plan: updatedPlan, notes: [] });
}

type VendorPatchOp = Extract<
  PlanPatchOp,
  | { type: 'update_vendor_need' }
  | { type: 'upsert_vendor_quote' }
  | { type: 'remove_vendor_quote' }
>;

export function handleVendorOps(plan: EventPlan, op: VendorPatchOp): OpResult {
  const opCategoryLower = op.category.toLowerCase();
  const needIdx = plan.vendors.findIndex(
    (v) => v.category.toLowerCase() === opCategoryLower,
  );

  if (needIdx === -1) {
    return err({
      code: 'vendor_not_found',
      message: `Vendor need for category "${op.category}" not found`,
    });
  }

  const targetNeed = plan.vendors[needIdx];
  if (!targetNeed) {
    return err({
      code: 'vendor_not_found',
      message: `Vendor need for category "${op.category}" not found`,
    });
  }

  if (op.type === 'update_vendor_need') {
    const updatedVendors = [...plan.vendors];
    updatedVendors[needIdx] = { ...targetNeed, status: op.status };
    return ok({ plan: { ...plan, vendors: updatedVendors }, notes: [] });
  }

  if (op.type === 'upsert_vendor_quote') {
    const existingIdx = targetNeed.quotes.findIndex(
      (q) => q.vendorName.toLowerCase() === op.quote.vendorName.toLowerCase(),
    );

    let newQuotes: typeof targetNeed.quotes;
    if (existingIdx !== -1) {
      newQuotes = [...targetNeed.quotes];
      newQuotes[existingIdx] = op.quote;
    } else {
      if (targetNeed.quotes.length >= 10) {
        return err({
          code: 'invalid_change',
          message: 'Quotes limit of 10 per need exceeded',
        });
      }
      newQuotes = [...targetNeed.quotes, op.quote];
    }

    const updatedVendors = [...plan.vendors];
    updatedVendors[needIdx] = { ...targetNeed, quotes: newQuotes };
    return ok({ plan: { ...plan, vendors: updatedVendors }, notes: [] });
  }

  // remove_vendor_quote
  const newQuotes = targetNeed.quotes.filter(
    (q) => q.vendorName.toLowerCase() !== op.vendorName.toLowerCase(),
  );
  const updatedVendors = [...plan.vendors];
  updatedVendors[needIdx] = { ...targetNeed, quotes: newQuotes };
  return ok({ plan: { ...plan, vendors: updatedVendors }, notes: [] });
}
