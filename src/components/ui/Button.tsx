import Link from 'next/link';
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  loading?: boolean;
  children: ReactNode;
}

export interface LinkButtonProps extends Omit<ComponentProps<typeof Link>, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-[#6B2D5C] text-white hover:bg-[#55224A] active:bg-[#431A3A] border border-transparent shadow-sm',
  secondary:
    'bg-white text-[#2B1B2E] border border-[#E6DCD2] hover:bg-[#F4EDE6] active:bg-[#EADBCC]',
  ghost:
    'bg-transparent text-[#2B1B2E] hover:bg-[#F4EDE6] active:bg-[#EADBCC] border border-transparent',
  danger:
    'bg-[#A12B3A] text-white hover:bg-[#82212E] active:bg-[#681823] border border-transparent shadow-sm',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'min-h-[36px] px-3 py-1.5 text-sm gap-1.5 rounded-[8px]',
  // WCAG 2.5.5 / 2.5.8 Target Size: Minimum 44x44px touch target
  md: 'min-h-[44px] px-4 py-2 text-base gap-2 rounded-[12px]',
};

function Spinner() {
  return (
    <svg
      className="animate-spin motion-reduce:animate-none -ml-0.5 shrink-0"
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

/**
 * Accessible button primitive.
 *
 * ACCESSIBILITY DECISION (WHY):
 * 1. Touch target size: Size 'md' enforces `min-height: 44px` per WCAG 2.5.8 Target Size (Minimum).
 * 2. Asynchronous busy state: Sets `aria-busy="true"` and `disabled` when `loading`, while stopping the spinner animation under `prefers-reduced-motion`.
 * 3. AsChild avoidance: Avoids brittle Slot/asChild patterns by explicitly exporting `LinkButton` for Next.js navigation anchors.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  disabled,
  className = '',
  children,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      type={props.type ?? 'button'}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center font-medium transition-colors cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...props}
    >
      {loading ? <Spinner /> : icon ? <span aria-hidden="true">{icon}</span> : null}
      <span>{children}</span>
    </button>
  );
}

/**
 * Anchor navigation button styled identically to Button.
 * WHY: Maintains semantic HTML (`<a>` vs `<button>`) for accessible screen reader navigation.
 */
export function LinkButton({
  variant = 'primary',
  size = 'md',
  icon,
  className = '',
  children,
  ...props
}: LinkButtonProps) {
  return (
    <Link
      className={`inline-flex items-center justify-center font-medium transition-colors cursor-pointer select-none no-underline ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...props}
    >
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      <span>{children}</span>
    </Link>
  );
}
