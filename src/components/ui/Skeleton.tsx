import type { HTMLAttributes } from 'react';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
}

/**
 * Placeholder skeleton for loading states.
 *
 * ACCESSIBILITY DECISION (WHY):
 * Marked `aria-hidden="true"` so screen readers ignore unannounced empty visual boxes while
 * real content is being loaded. When full loading completes, parent containers announce state.
 */
export function Skeleton({ className = '', ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse motion-reduce:animate-none bg-[#E6DCD2] rounded-[8px] ${className}`}
      {...props}
    />
  );
}
