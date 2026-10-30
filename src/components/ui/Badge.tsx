import type { HTMLAttributes, ReactNode } from 'react';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-muted text-ink border-border',
  success: 'bg-success-bg text-success border-success-border',
  warning: 'bg-warning-bg text-warning border-warning-border',
  danger: 'bg-danger-bg text-danger border-danger-border',
  info: 'bg-info-bg text-info border-info-border',
  brand: 'bg-surface-muted text-primary border-[#E2D2DC]',
};

/**
 * Text badge indicator.
 *
 * ACCESSIBILITY DECISION (WHY):
 * Per WCAG 1.4.1 Use of Color, color must never be the sole indicator of status.
 * Badges enforce textual content (`children: ReactNode`) alongside high-contrast background
 * pairings (minimum 5.3:1 contrast ratio) and a subtle border.
 */
export function Badge({ tone = 'neutral', children, className = '', ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${TONE_CLASSES[tone]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
