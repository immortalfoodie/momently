'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { fetchHealth } from '@/lib/apiClient';

export interface HeaderProps {
  onToggleMobileNav?: () => void;
}

type HealthState = 'demo' | 'live' | 'offline';

/**
 * Top application header banner landmark.
 *
 * ACCESSIBILITY DECISION (WHY):
 * Uses semantic `<header>` (role="banner") containing brand identification, operational
 * status badge with accessible description, and mobile drawer trigger.
 */
export function Header({ onToggleMobileNav }: HeaderProps) {
  const [health, setHealth] = useState<HealthState>('demo');

  useEffect(() => {
    let mounted = true;
    fetchHealth()
      .then((res) => {
        if (!mounted) return;
        if (res.ok) {
          setHealth(res.value.mode === 'live' ? 'live' : 'demo');
        } else {
          setHealth('offline');
        }
      })
      .catch(() => {
        if (mounted) setHealth('offline');
      });
    return () => {
      mounted = false;
    };
  }, []);

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
        {health === 'live' ? (
          <Badge
            tone="success"
            className="hidden sm:inline-flex"
            title="Connected to live AI provider"
            aria-description="Connected to live AI provider"
          >
            Live AI
          </Badge>
        ) : health === 'demo' ? (
          <Badge
            tone="brand"
            className="hidden sm:inline-flex"
            title="Works offline with built-in ideas"
            aria-description="Works offline with built-in ideas"
          >
            Demo mode
          </Badge>
        ) : (
          <Badge
            tone="neutral"
            className="hidden sm:inline-flex"
            title="Operating offline"
            aria-description="Operating offline"
          >
            Offline
          </Badge>
        )}

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
