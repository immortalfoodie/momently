import type { ReactNode } from 'react';

export interface PageContainerProps {
  width?: 'full' | 'narrow';
  className?: string;
  children: ReactNode;
}

/**
 * Standardized page content container enforcing left alignment and max-width boundaries.
 *
 * ACCESSIBILITY & LAYOUT DECISION (WHY):
 * Both 'full' (max 72rem) and 'narrow' (max 48rem) are strictly LEFT-aligned (never centered)
 * to align flush with the plan health strip and sidebar navigation on desktop viewports,
 * while maintaining comfortable reading lengths and responsive form ergonomics.
 */
export function PageContainer({
  width = 'full',
  className = '',
  children,
}: PageContainerProps) {
  const maxWidthClass = width === 'narrow' ? 'max-w-[48rem]' : 'max-w-[72rem]';

  return (
    <div className={`w-full ${maxWidthClass} px-4 sm:px-6 lg:px-8 py-6 ${className}`}>
      {children}
    </div>
  );
}
