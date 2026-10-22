import type { Metadata } from 'next';
import { BudgetClient } from '@/components/budget/BudgetClient';

export const metadata: Metadata = {
  title: 'Budget Guardian',
  description: 'Deterministic line-item ledger with real-time floor protection, provenance badges, and lever controls.',
};

/**
 * BudgetPage route hosting the complete Budget Guardian dashboard.
 */
export default function BudgetPage() {
  return <BudgetClient />;
}
