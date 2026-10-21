import type { HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
}

export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
}

export interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  level?: 2 | 3 | 4 | 5 | 6;
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
      className={`bg-white rounded-[16px] border border-[#E6DCD2] p-5 shadow-[0_1px_3px_rgba(43,27,46,0.05)] ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '', ...props }: CardHeaderProps) {
  return (
    <div className={`flex flex-col gap-1 mb-4 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ level = 2, children, className = '', ...props }: CardTitleProps) {
  const HeadingTag = `h${level}` as const;
  return (
    <HeadingTag
      className={`font-serif text-xl font-semibold text-[#2B1B2E] tracking-tight ${className}`}
      {...props}
    >
      {children}
    </HeadingTag>
  );
}

export function CardContent({ children, className = '', ...props }: CardProps) {
  return (
    <div className={`text-[#2B1B2E] ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className = '', ...props }: CardProps) {
  return (
    <div className={`mt-5 pt-4 border-t border-[#E6DCD2] flex items-center justify-between ${className}`} {...props}>
      {children}
    </div>
  );
}
