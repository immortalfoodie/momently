'use client';

import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { useAiMode } from '@/lib/useAiMode';

export interface HeaderProps {
  onToggleMobileNav?: () => void;
}

/**
 * Top application header banner landmark.
 *
 * ACCESSIBILITY DECISION (WHY):
 * Uses semantic `<header>` (role="banner") containing brand identification, operational
 * status badge with accessible description, and mobile drawer trigger.
 */
export function Header({ onToggleMobileNav }: HeaderProps) {
  const { status: health, model } = useAiMode();
  const liveDescription = model ? `Connected to live AI (${model})` : 'Connected to live AI provider';

  return (
    <header className="sticky top-0 z-30 h-[var(--header-h)] bg-white border-b border-border px-4 sm:px-6 flex items-center justify-between shadow-2xs">
      <div className="flex items-center gap-3">
        {onToggleMobileNav ? (
          <button
            type="button"
            onClick={onToggleMobileNav}
            aria-label="Open navigation menu"
            className="lg:hidden p-2 rounded-[8px] text-ink hover:bg-surface-muted cursor-pointer"
          >
            <Icon name="menu" size={22} aria-hidden="true" />
          </button>
        ) : null}

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary text-gold flex items-center justify-center shrink-0">
            <Icon name="sparkle" size={18} aria-hidden="true" />
          </div>
          <div>
            <span className="font-serif text-xl font-bold tracking-tight text-ink">
              Momently
            </span>
            <span className="hidden sm:inline-block ml-2 text-xs text-ink-muted font-medium tracking-wide">
              Plan. Celebrate. Cherish.
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {health === 'live' ? (
          <Badge
            tone="success"
            className="hidden sm:inline-flex"
            title={liveDescription}
            aria-description={liveDescription}
          >
            Live AI
          </Badge>
        ) : health === 'offline' ? (
          <Badge
            tone="neutral"
            className="hidden sm:inline-flex"
            title="Operating offline"
            aria-description="Operating offline"
          >
            Offline
          </Badge>
        ) : null}

        <div
          role="img"
          aria-label="Host Profile"
          className="w-8 h-8 rounded-full bg-surface-muted border border-border text-primary flex items-center justify-center text-xs font-bold font-serif"
        >
          H
        </div>
      </div>
    </header>
  );
}
