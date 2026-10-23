import { BUDGET_CATEGORIES } from '@/domain/constants';
import type { EventPlan, Provenance } from '@/domain/types';
import { budgetTotal, getBudgetCap, itemTotal } from '@/engine/budget';
import { type CsvCell, toCsv } from './csv';

export const PROVENANCE_TEXT_MAP: Record<Provenance, string> = {
  user: 'Your input',
  estimate: 'Estimate',
  verified: 'Verified quote',
};

const CATEGORY_LABEL_MAP = new Map(BUDGET_CATEGORIES.map((c) => [c.id, c.label]));

/**
 * Generates an RFC 4180 CSV spreadsheet of the active event budget.
 * WHY: Exports raw integer INR values without currency symbols so hosts can immediately sum,
 * pivot, or model scenarios in Excel or Google Sheets while preserving provenance labels.
 *
 * @param plan - Active EventPlan.
 * @returns RFC 4180 CSV string.
 */
export function budgetCsv(plan: EventPlan): string {
  const guestCount = plan.meta.guestCount;
  const header: CsvCell[] = [
    'Category',
    'Item',
    'Basis',
    'Unit price (INR)',
    'Quantity',
    `Total at ${guestCount} guests (INR)`,
    'Source',
    'Locked',
    'Note',
  ];

  const rows: CsvCell[][] = [header];

  for (const item of plan.budgetItems) {
    const categoryLabel = CATEGORY_LABEL_MAP.get(item.category) ?? item.category;
    const basisLabel = item.basis === 'per_guest' ? 'Per guest' : 'Flat';
    const total = itemTotal(item, guestCount);
    const sourceLabel = PROVENANCE_TEXT_MAP[item.provenance];
    const lockedLabel = item.locked ? 'Yes' : 'No';

    rows.push([
      categoryLabel,
      item.label,
      basisLabel,
      item.unitCost,
      item.quantity,
      total,
      sourceLabel,
      lockedLabel,
      item.note ?? '',
    ]);
  }

  // Blank separator row
  rows.push(['', '', '', '', '', '', '', '', '']);

  // Grand total row
  const grandTotal = budgetTotal(plan.budgetItems, guestCount);
  rows.push(['Total', '', '', '', '', grandTotal, '', '', '']);

  // Optional Budget cap row
  const cap = getBudgetCap(plan.constraints);
  if (cap !== null) {
    rows.push(['Budget cap', '', '', '', '', cap, '', '', '']);
  }

  return toCsv(rows);
}
