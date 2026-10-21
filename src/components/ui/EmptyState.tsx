import type { ReactNode } from 'react';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
  level?: 2 | 3 | 4;
}

/**
 * Friendly empty state display for lists, tabs, or unloaded resources.
 *
 * ACCESSIBILITY DECISION (WHY):
 * Uses `level = 2` by default to preserve sequential heading hierarchy (h1 -> h2)
 * per WCAG 1.3.1 Info and Relationships and axe-core heading-order rules.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className = '',
  level = 2,
}: EmptyStateProps) {
  const HeadingTag = `h${level}` as const;

  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-8 rounded-[16px] border border-dashed border-[#E6DCD2] bg-[#F4EDE6]/50 ${className}`}
    >
      {icon ? (
        <div className="mb-3 text-[#6B2D5C] p-3 rounded-full bg-white shadow-sm" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <HeadingTag className="font-serif text-lg font-semibold text-[#2B1B2E] mb-1">
        {title}
      </HeadingTag>
      <p className="text-sm text-[#5B4A5E] max-w-md mb-4">{description}</p>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
