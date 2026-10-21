import { formatInr, formatInrCompact } from '@/lib/format';
import type { HTMLAttributes } from 'react';

export interface MoneyProps extends HTMLAttributes<HTMLSpanElement> {
  amount: number;
  compact?: boolean;
  className?: string;
}

/**
 * Currency display primitive formatting INR rupee amounts.
 *
 * ACCESSIBILITY DECISION (WHY):
 * Applies `tabular-nums` font feature settings to prevent horizontal jitter when values
 * update, and ensures currency figures maintain proportional vertical column alignment
 * in data tables and budget cards.
 */
export function Money({
  amount,
  compact = false,
  className = '',
  ...props
}: MoneyProps) {
  const formatted = compact ? formatInrCompact(amount) : formatInr(amount);

  return (
    <span
      className={`tabular-nums font-medium ${className}`}
      {...props}
    >
      {formatted}
    </span>
  );
}
