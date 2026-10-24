import type { Metadata } from 'next';
import { BudgetClient } from '@/components/budget/BudgetClient';

export const metadata: Metadata = {
  title: 'Budget',
  description: 'See where every rupee goes, and what changes if you add, upgrade or cut something.',
};

/**
 * BudgetPage route hosting the complete Budget Guardian dashboard.
 */
export default function BudgetPage() {
  return <BudgetClient />;
}
