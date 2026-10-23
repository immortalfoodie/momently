'use client';

import { Icon } from '@/components/ui/Icon';

/**
 * Accessible thinking status indicator shown while the assistant processes a request.
 *
 * ACCESSIBILITY DECISION (WHY):
 * Exposes `role="status"` with text "Momently is thinking…" and uses `motion-reduce:animate-none`
 * so decorative pulse animations stop when `prefers-reduced-motion: reduce` is active.
 */
export function ThinkingIndicator() {
  return (
    <div
      role="status"
      className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-[#F4EDE6] text-[#2B1B2E] text-sm w-fit"
    >
      <span
        aria-hidden="true"
        className="inline-flex items-center justify-center text-[#6B2D5C] animate-pulse motion-reduce:animate-none"
      >
        <Icon name="sparkle" size={16} aria-hidden="true" />
      </span>
      <span className="font-medium text-[#2B1B2E]">Momently is thinking…</span>
      <span className="inline-flex items-center gap-1" aria-hidden="true">
        <span className="w-1.5 h-1.5 rounded-full bg-[#6B2D5C] animate-bounce motion-reduce:animate-none" />
        <span className="w-1.5 h-1.5 rounded-full bg-[#6B2D5C] animate-bounce motion-reduce:animate-none [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-[#6B2D5C] animate-bounce motion-reduce:animate-none [animation-delay:300ms]" />
      </span>
    </div>
  );
}
