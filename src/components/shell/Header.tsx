'use client';

import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';

export interface HeaderProps {
  onToggleMobileNav?: () => void;
}

/**
 * Top application header banner landmark.
 *
 * ACCESSIBILITY DECISION (WHY):
 * Uses semantic `<header>` (role="banner") containing brand identification, operational
 * status badge, and mobile drawer trigger with clear accessible names.
 */
export function Header({ onToggleMobileNav }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 h-16 bg-white border-b border-[#E6DCD2] px-4 sm:px-6 flex items-center justify-between shadow-2xs">
      <div className="flex items-center gap-3">
        {onToggleMobileNav ? (
          <button
            type="button"
            onClick={onToggleMobileNav}
            aria-label="Open navigation menu"
            className="lg:hidden p-2 rounded-[8px] text-[#2B1B2E] hover:bg-[#F4EDE6] cursor-pointer"
          >
            <Icon name="menu" size={22} aria-hidden="true" />
          </button>
        ) : null}

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#6B2D5C] text-[#D4A24C] flex items-center justify-center shrink-0">
            <Icon name="sparkle" size={18} aria-hidden="true" />
          </div>
          <div>
            <span className="font-serif text-xl font-bold tracking-tight text-[#2B1B2E]">
              Momently
            </span>
            <span className="hidden sm:inline-block ml-2 text-xs text-[#5B4A5E] font-medium tracking-wide">
              Plan. Celebrate. Cherish.
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Badge tone="brand" className="hidden sm:inline-flex">
          Demo Mode
        </Badge>

        <div
          role="img"
          aria-label="Host Profile"
          className="w-8 h-8 rounded-full bg-[#F4EDE6] border border-[#E6DCD2] text-[#6B2D5C] flex items-center justify-center text-xs font-bold font-serif"
        >
          H
        </div>
      </div>
    </header>
  );
}
