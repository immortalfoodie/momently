import type { HTMLAttributes, ReactNode } from 'react';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-[#F4EDE6] text-[#2B1B2E] border-[#E6DCD2]',
  success: 'bg-[#E7F4EE] text-[#1F6F54] border-[#C3E6D7]',
  warning: 'bg-[#FFF4DC] text-[#8A5A00] border-[#FFE2A8]',
  danger: 'bg-[#FBE9EB] text-[#A12B3A] border-[#F4C5CB]',
  info: 'bg-[#E8F0F8] text-[#2B5C8A] border-[#C3DBEE]',
  brand: 'bg-[#F4EDE6] text-[#6B2D5C] border-[#E2D2DC]',
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
