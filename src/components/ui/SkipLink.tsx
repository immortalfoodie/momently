export interface SkipLinkProps {
  targetId?: string;
  className?: string;
}

/**
 * Skip navigation link allowing keyboard users to bypass header and sidebar landmarks.
 *
 * ACCESSIBILITY DECISION (WHY):
 * Required by WCAG 2.4.1 Bypass Blocks. Positioned offscreen by default, it becomes visibly
 * prominent on initial Tab focus, navigating directly to `<main id="main-content">`.
 */
export function SkipLink({ targetId = 'main-content', className = '' }: SkipLinkProps) {
  return (
    <a
      href={`#${targetId}`}
      className={`sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2.5 focus:bg-[#6B2D5C] focus:text-white focus:rounded-[8px] focus:font-semibold focus:shadow-lg focus:outline-none focus:ring-4 focus:ring-[#1D4F91] ${className}`}
    >
      Skip to main content
    </a>
  );
}
