'use client';

import { useId, useState, type TextareaHTMLAttributes } from 'react';
import { resolveFieldBindings, useFieldContext } from './Field';

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  maxLength?: number;
  showCount?: boolean;
  className?: string;
}

function computeInitialLength(controlledValue?: unknown, defaultValue?: unknown): number {
  if (typeof controlledValue === 'string') return controlledValue.length;
  if (typeof defaultValue === 'string') return defaultValue.length;
  return 0;
}

function getThresholdAnnouncement(currentLength: number, maxLength?: number): string {
  if (!maxLength || maxLength <= 0) return '';
  const ratio = currentLength / maxLength;
  if (currentLength >= maxLength) {
    return `Maximum limit reached: ${maxLength} characters used.`;
  }
  if (ratio >= 0.9) {
    return `90% capacity: ${currentLength} of ${maxLength} characters used.`;
  }
  if (ratio >= 0.8) {
    return `80% capacity: ${currentLength} of ${maxLength} characters used.`;
  }
  return '';
}

function getTextAreaDescribedBy(
  contextDescribedBy?: string,
  counterLiveId?: string,
  hasCounter?: boolean
): string | undefined {
  const parts = [contextDescribedBy, hasCounter ? counterLiveId : undefined].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : undefined;
}

/**
 * Multi-line text area with threshold-gated live character announcements.
 *
 * ACCESSIBILITY DECISION (WHY):
 * Constant live-region updates on every keystroke spam screen readers and drown out typing.
 * Instead, the live announcement region updates ONLY when the user crosses significant capacity
 * thresholds (80%, 90%, 100%), keeping assistive users informed without distraction.
 */
export function TextArea({
  id: customId,
  'aria-describedby': customDescribedBy,
  'aria-invalid': customInvalid,
  required: customRequired,
  maxLength,
  showCount = false,
  value: controlledValue,
  defaultValue,
  onChange,
  className = '',
  rows = 4,
  ...props
}: TextAreaProps) {
  const fieldContext = useFieldContext();
  const counterLiveId = useId();

  const bindings = resolveFieldBindings(
    {
      id: customId,
      describedBy: customDescribedBy,
      isInvalid: customInvalid,
      required: customRequired,
    },
    fieldContext
  );

  const [internalLength, setInternalLength] = useState<number>(() =>
    computeInitialLength(controlledValue, defaultValue)
  );

  const currentLength = typeof controlledValue === 'string' ? controlledValue.length : internalLength;
  const hasCounter = Boolean(showCount && maxLength);
  const thresholdMessage = getThresholdAnnouncement(currentLength, maxLength);
  const describedBy = getTextAreaDescribedBy(bindings.describedBy, counterLiveId, hasCounter);

  return (
    <div className="flex flex-col gap-1 w-full">
      <textarea
        id={bindings.id}
        rows={rows}
        maxLength={maxLength}
        aria-describedby={describedBy}
        aria-invalid={bindings.isInvalid}
        required={bindings.isRequired}
        value={controlledValue}
        defaultValue={defaultValue}
        onChange={(e) => {
          setInternalLength(e.target.value.length);
          onChange?.(e);
        }}
        className={`w-full px-3.5 py-2.5 rounded-[12px] border border-[#E6DCD2] bg-white text-[#2B1B2E] placeholder-[#5B4A5E]/60 text-base transition-colors hover:border-[#6B2D5C]/40 focus:border-[#6B2D5C] disabled:bg-[#F4EDE6] disabled:cursor-not-allowed resize-y ${
          bindings.hasError ? 'border-[#A12B3A] focus:border-[#A12B3A]' : ''
        } ${className}`}
        {...props}
      />

      {hasCounter ? (
        <div className="flex items-center justify-between text-xs text-[#5B4A5E] px-1">
          {/* Polite live region only announces when threshold is crossed */}
          <span id={counterLiveId} aria-live="polite" className="sr-only">
            {thresholdMessage}
          </span>
          <span className="ml-auto tabular-nums" aria-hidden="true">
            {currentLength} / {maxLength}
          </span>
        </div>
      ) : null}
    </div>
  );
}
