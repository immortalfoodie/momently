'use client';

import { INTAKE_PROMPTS, suggestedPrompts } from '@/lib/chatText';
import { useEvent, useEventDerived } from '@/store/selectors';
import { useChat } from './ChatProvider';

export interface SuggestedPromptsProps {
  className?: string;
}

/**
 * Context-aware prompt chips that send a message when clicked.
 * Hidden automatically while a request is pending.
 */
export function SuggestedPrompts({ className = '' }: SuggestedPromptsProps) {
  const { mode, eventId, pending, send } = useChat();
  const event = useEvent(eventId ?? '');
  const derived = useEventDerived(eventId ?? '');

  if (pending) {
    return null;
  }

  const prompts: readonly string[] =
    mode === 'event' && event
      ? suggestedPrompts(event.plan, derived)
      : INTAKE_PROMPTS;

  if (prompts.length === 0) {
    return null;
  }

  return (
    <div
      role="group"
      aria-label="Suggested prompts"
      className={`flex flex-wrap gap-1.5 ${className}`}
    >
      {prompts.map((prompt) => (
        <button
          key={prompt}
          type="button"
          onClick={() => {
            void send(prompt);
          }}
          className="text-left text-xs font-medium px-3 py-1.5 min-h-[36px] rounded-full border border-[#E2D2DC] bg-white text-[#2B1B2E] hover:bg-[#F4EDE6] hover:border-[#6B2D5C] transition-colors cursor-pointer"
        >
          {prompt}
        </button>
      ))}
    </div>
  );
}
