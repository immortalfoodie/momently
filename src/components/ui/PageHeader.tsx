import type { ReactNode } from 'react';

export interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

/**
 * Top-level view header establishing the primary page title and actions.
 *
 * ACCESSIBILITY DECISION (WHY):
 * Renders exactly one `<h1>` per view to establish the primary landmark heading for
 * screen reader rotor navigation and WCAG 1.3.1 Info and Relationships compliance.
 */
export function PageHeader({
  title,
  description,
  actions,
  className = '',
}: PageHeaderProps) {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 mb-6 border-b border-[#E6DCD2] ${className}`}
    >
      <div>
        <h1 className="font-serif text-3xl font-bold text-[#2B1B2E] tracking-tight">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 text-base text-[#5B4A5E] leading-relaxed max-w-2xl">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex items-center gap-3 shrink-0">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
