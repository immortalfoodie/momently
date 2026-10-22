import type { HTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export type AlertTone = 'danger' | 'warning' | 'info' | 'success';

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  tone?: AlertTone;
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

const TONE_STYLES: Record<
  AlertTone,
  { bg: string; text: string; border: string; icon: IconName }
> = {
  danger: {
    bg: 'bg-[#FBE9EB]',
    text: 'text-[#A12B3A]',
    border: 'border-[#F4C5CB]',
    icon: 'alert',
  },
  warning: {
    bg: 'bg-[#FFF4DC]',
    text: 'text-[#8A5A00]',
    border: 'border-[#FFE2A8]',
    icon: 'alert',
  },
  info: {
    bg: 'bg-[#E8F0F8]',
    text: 'text-[#2B5C8A]',
    border: 'border-[#C3DBEE]',
    icon: 'info',
  },
  success: {
    bg: 'bg-[#E7F4EE]',
    text: 'text-[#1F6F54]',
    border: 'border-[#C3E6D7]',
    icon: 'check',
  },
};

/**
 * Accessible alert banner.
 *
 * ACCESSIBILITY DECISION (WHY):
 * Uses `role="alert"` for assertive screen reader notifications.
 * Pairs text and explicit glyph icons per WCAG 1.4.1 to avoid color-only indicators.
 */
export function Alert({
  tone = 'danger',
  title,
  action,
  children,
  className = '',
  ...props
}: AlertProps) {
  const style = TONE_STYLES[tone];

  return (
    <div
      role="alert"
      className={`rounded-[12px] border p-4 flex items-start gap-3 text-sm ${style.bg} ${style.border} ${style.text} ${className}`}
      {...props}
    >
      <div className="shrink-0 mt-0.5" aria-hidden="true">
        <Icon name={style.icon} size={18} />
      </div>

      <div className="flex-1 min-w-0">
        {title ? <h4 className="font-semibold text-sm mb-1">{title}</h4> : null}
        <div className="leading-relaxed">{children}</div>
      </div>

      {action ? <div className="shrink-0 ml-2">{action}</div> : null}
    </div>
  );
}
