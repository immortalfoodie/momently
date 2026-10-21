'use client';

import type { InputHTMLAttributes } from 'react';
import { resolveFieldBindings, useFieldContext } from './Field';

export interface NumberInputProps extends InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

/**
 * Numeric input primitive supporting integer and currency values.
 */
export function NumberInput({
  id: customId,
  'aria-describedby': customDescribedBy,
  'aria-invalid': customInvalid,
  required: customRequired,
  className = '',
  ...props
}: NumberInputProps) {
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
    <input
      type="number"
      id={bindings.id}
      aria-describedby={bindings.describedBy}
      aria-invalid={bindings.isInvalid}
      required={bindings.isRequired}
      className={`w-full min-h-[44px] px-3.5 py-2 rounded-[12px] border border-[#E6DCD2] bg-white text-[#2B1B2E] placeholder-[#5B4A5E]/60 text-base tabular-nums transition-colors hover:border-[#6B2D5C]/40 focus:border-[#6B2D5C] disabled:bg-[#F4EDE6] disabled:cursor-not-allowed ${
        bindings.hasError ? 'border-[#A12B3A] focus:border-[#A12B3A]' : ''
      } ${className}`}
      {...props}
    />
  );
}
