import type { HTMLAttributes, ReactNode } from 'react';

export interface VisuallyHiddenProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  className?: string;
}

/**
 * Hides visual elements while keeping them accessible to screen readers and assistive tech.
 */
export function VisuallyHidden({ children, className = '', ...props }: VisuallyHiddenProps) {
  return (
    <span
      className={`sr-only ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
