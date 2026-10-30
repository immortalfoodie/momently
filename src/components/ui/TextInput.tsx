'use client';

import type { InputHTMLAttributes } from 'react';
import { resolveFieldBindings, useFieldContext } from './Field';

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

/**
  * Text input control integrating seamlessly with Field wrapper context.
  */
export function TextInput({
  id: customId,
  'aria-describedby': customDescribedBy,
  'aria-invalid': customInvalid,
  required: customRequired,
  className = '',
  ...props
}: TextInputProps) {
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
      type="text"
      id={bindings.id}
      aria-describedby={bindings.describedBy}
      aria-invalid={bindings.isInvalid}
      required={bindings.isRequired}
      className={`w-full min-h-[44px] px-3.5 py-2 rounded-[12px] border border-border bg-white text-ink placeholder-ink-muted/60 text-base transition-colors hover:border-primary/40 focus:border-primary disabled:bg-surface-muted disabled:cursor-not-allowed ${
        bindings.hasError ? 'border-danger focus:border-danger' : ''
      } ${className}`}
      {...props}
    />
  );
}
