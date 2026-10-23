'use client';

import { Icon } from '@/components/ui/Icon';
import { useChat } from './ChatProvider';
import { SuggestedPrompts } from './SuggestedPrompts';

/**
 * Initial welcome card shown when the conversation has no messages yet.
 * Adapts copy and starter chips to intake mode vs active event mode.
 */
export function WelcomeMessage() {
  const { mode } = useChat();

  return (
    <div className="rounded-2xl border border-[#E6DCD2] bg-[#FAF5F0] p-4 space-y-3">
      <div className="flex items-start gap-2.5">
        <div className="w-7 h-7 rounded-full bg-[#6B2D5C] text-[#D4A24C] flex items-center justify-center shrink-0 mt-0.5">
          <Icon name="sparkle" size={14} aria-hidden="true" />
        </div>
        <div className="space-y-1">
          {mode === 'intake' ? (
            <p className="text-sm text-[#2B1B2E] leading-relaxed">
              Hi, I&apos;m Momently, your AI event planner. Tell me your idea and I&apos;ll help plan every detail.
            </p>
          ) : (
            <p className="text-sm text-[#2B1B2E] leading-relaxed">
              Hi, I&apos;m Momently. You can ask to change anything in your celebration plan—every suggestion is shown as a proposal first, and nothing changes until you approve it.
            </p>
          )}
        </div>
      </div>

      <SuggestedPrompts />
    </div>
  );
}
