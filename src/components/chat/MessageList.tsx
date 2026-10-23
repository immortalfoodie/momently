'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { useChat } from './ChatProvider';
import { MessageBubble } from './MessageBubble';
import { ThinkingIndicator } from './ThinkingIndicator';
import { WelcomeMessage } from './WelcomeMessage';

/**
 * Scrollable conversation history container.
 *
 * ACCESSIBILITY DECISION (WHY):
 * Uses `role="log"` with `aria-live="off"`. Because AssistantOutcomeView renders complex,
 * multi-option interactive cards with tables and radio buttons, announcing the entire DOM
 * subtree via aria-live would overwhelm screen readers. Instead, ChatProvider dispatches a
 * concise plain-text summary (`outcomeToText`) through the polite LiveRegionProvider.
 */
export function MessageList() {
  const { messages, pending, welcomeVisible, canRetry, retryLast } = useChat();
  const listRef = useRef<HTMLDivElement | null>(null);
  const isScrolledUpRef = useRef(false);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isScrolledUpRef.current = distanceFromBottom > 48;
  };

  useEffect(() => {
    const el = listRef.current;
    if (!el || isScrolledUpRef.current) return;
    if (typeof el.scrollTo === 'function') {
      el.scrollTo({ top: el.scrollHeight });
    } else {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length, pending]);

  return (
    <div
      ref={listRef}
      role="log"
      aria-live="off"
      aria-label="Conversation history"
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto p-4 space-y-3"
    >
      {welcomeVisible && <WelcomeMessage />}

      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}

      {canRetry && !pending && (
        <div className="flex justify-start">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              void retryLast();
            }}
          >
            Try again
          </Button>
        </div>
      )}

      {pending && <ThinkingIndicator />}
    </div>
  );
}
