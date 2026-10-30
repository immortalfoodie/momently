import type { HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
}

/**
 * Surface container primitive for grouping related studio content.
 * WHY: Provides consistent visual hierarchy with a soft border and background meeting contrast.
 */
export function Card({ children, className = '', ...props }: CardProps) {
  return (
    <div
      className={`bg-white rounded-[16px] border border-border p-5 shadow-[0_1px_3px_rgba(43,27,46,0.05)] ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

