'use client';

import type { SelectHTMLAttributes } from 'react';
import { resolveFieldBindings, useFieldContext } from './Field';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  className?: string;
}

/**
 * Native select dropdown primitive styled for the studio design system.
 */
export function Select({
  id: customId,
  'aria-describedby': customDescribedBy,
  'aria-invalid': customInvalid,
  required: customRequired,
  className = '',
  children,
  ...props
}: SelectProps) {
  const fieldContext = useFieldContext();
  const bindings = resolveFieldBindings(
    {
      id: customId,
      describedBy: customDescribedBy,
      isInvalid: customInvalid,
      required: customRequired,
    },
    fieldContext
  );

  return (
    <div className="relative w-full">
      <select
        id={bindings.id}
        aria-describedby={bindings.describedBy}
        aria-invalid={bindings.isInvalid}
        required={bindings.isRequired}
        className={`w-full min-h-[44px] px-3.5 py-2 pr-10 rounded-[12px] border border-[#E6DCD2] bg-white text-[#2B1B2E] text-base transition-colors hover:border-[#6B2D5C]/40 focus:border-[#6B2D5C] disabled:bg-[#F4EDE6] disabled:cursor-not-allowed appearance-none cursor-pointer ${
          bindings.hasError ? 'border-[#A12B3A] focus:border-[#A12B3A]' : ''
        } ${className}`}
        {...props}
      >
        {children}
      </select>
      <div
        className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[#5B4A5E]"
        aria-hidden="true"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    </div>
  );
}
