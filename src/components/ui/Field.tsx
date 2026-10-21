'use client';

import {
  createContext,
  useContext,
  useId,
  type AriaAttributes,
  type ReactNode,
} from 'react';

export interface FieldContextValue {
  id: string;
  hintId?: string;
  errorId?: string;
  describedBy?: string;
  isInvalid: boolean;
  required?: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

export function useFieldContext(): FieldContextValue | null {
  return useContext(FieldContext);
}

export interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  alert?: boolean;
  required?: boolean;
  id?: string;
  className?: string;
  children: ReactNode;
}

export function resolveFieldBindings(
  custom: {
    id?: string;
    describedBy?: string;
    isInvalid?: AriaAttributes['aria-invalid'];
    required?: boolean;
  },
  context: FieldContextValue | null
) {
  const isInvalid = custom.isInvalid !== undefined ? custom.isInvalid : context?.isInvalid;
  return {
    id: custom.id ?? context?.id,
    describedBy: custom.describedBy ?? context?.describedBy,
    isInvalid,
    hasError: Boolean(isInvalid && isInvalid !== 'false'),
    isRequired: custom.required ?? context?.required,
  };
}

function getDescribedBy(hintId?: string, errorId?: string): string | undefined {
  const describedByParts = [hintId, errorId].filter(Boolean);
  return describedByParts.length > 0 ? describedByParts.join(' ') : undefined;
}

function renderFieldHint(hint?: string, hintId?: string, hasError?: boolean) {
  if (!hint || hasError) return null;
  return (
    <p id={hintId} className="text-xs text-[#5B4A5E]">
      {hint}
    </p>
  );
}

function renderFieldError(error?: string, errorId?: string, alert?: boolean) {
  if (!error) return null;
  return (
    <p
      id={errorId}
      role={alert ? 'alert' : undefined}
      className="text-xs font-medium text-[#A12B3A] flex items-center gap-1"
    >
      <span>{error}</span>
    </p>
  );
}

/**
 * Accessible form field wrapper connecting label, hints, inputs, and error states.
 *
 * ACCESSIBILITY DECISION (WHY):
 * 1. Semantic Association: Automates `htmlFor` on `<label>` and `id` on the control via `useId()`.
 * 2. Description Wiring: Links hint and error descriptions via `aria-describedby`.
 * 3. Conditional Alert: Per W3C form guidelines, field errors should only take `role="alert"`
 *    when displayed immediately following an explicit form submission, avoiding intrusive
 *    live interruptions during typing.
 */
export function Field({
  label,
  hint,
  error,
  alert = false,
  required = false,
  id: customId,
  className = '',
  children,
}: FieldProps) {
  const generatedId = useId();
  const fieldId = customId ?? generatedId;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = getDescribedBy(hintId, errorId);
  const isInvalid = Boolean(error);

  const contextValue: FieldContextValue = {
    id: fieldId,
    hintId,
    errorId,
    describedBy,
    isInvalid,
    required,
  };

  return (
    <FieldContext.Provider value={contextValue}>
      <div className={`flex flex-col gap-1.5 ${className}`}>
        <label
          htmlFor={fieldId}
          className="text-sm font-semibold text-[#2B1B2E] flex items-center gap-1"
        >
          <span>{label}</span>
          {required ? (
            <span className="text-[#A12B3A]" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>

        {children}
        {renderFieldHint(hint, hintId, isInvalid)}
        {renderFieldError(error, errorId, alert)}
      </div>
    </FieldContext.Provider>
  );
}
