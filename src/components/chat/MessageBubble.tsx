'use client';

import { AssistantOutcomeView } from '@/components/review/AssistantOutcomeView';
import type { AssistantOutcome } from '@/engine/assistant/types';
import { useEventsStore } from '@/store/eventsStore';
import type { ChatMessage } from '@/store/persistSchema';
import { useChat } from './ChatProvider';

export interface MessageBubbleProps {
  message: ChatMessage;
}

function shouldShowSummaryText(outcome: AssistantOutcome | undefined, text: string): boolean {
  if (!outcome) return true;
  return outcome.kind === 'info' && text !== outcome.message;
}

function resolveChaosNarration(
  outcome: AssistantOutcome | undefined,
  text: string,
): string | undefined {
  if (outcome?.kind === 'chaos' && text !== outcome.result.headline) {
    return text;
  }
  return undefined;
}

/**
 * Renders an individual user or assistant chat turn with visually hidden sender labels
 * and live or reloaded outcome handling.
 */
export function MessageBubble({ message }: MessageBubbleProps) {
  const { eventId, isSessionError, send } = useChat();
  const outcome = useEventsStore((s) => s.outcomes[message.id]);
  const plan = useEventsStore((s) => (eventId ? s.events[eventId]?.plan : undefined));

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-xs bg-[#6B2D5C] text-white px-3.5 py-2.5 text-sm leading-relaxed shadow-2xs">
          <span className="sr-only">You said: </span>
          <p className="whitespace-pre-wrap break-words">{message.text}</p>
        </div>
      </div>
    );
  }

  const showSeparateSummaryText = shouldShowSummaryText(outcome, message.text);
  const chaosNarration = resolveChaosNarration(outcome, message.text);
  const showReloadExpiredNote = !outcome && !isSessionError(message.id);

  return (
    <div className="flex justify-start">
      <div className="w-full rounded-2xl rounded-bl-xs border border-[#E6DCD2] bg-white p-3.5 text-sm text-[#2B1B2E] space-y-2.5 shadow-2xs">
        <span className="sr-only">Momently said: </span>

        {showSeparateSummaryText && (
          <p className="text-sm text-[#2B1B2E] leading-relaxed whitespace-pre-wrap break-words">
            {message.text}
          </p>
        )}

        {outcome && (
          <AssistantOutcomeView
            outcome={outcome}
            eventId={eventId ?? undefined}
            plan={plan}
            currentVersion={plan?.version}
            basedOnVersion={message.basedOnVersion}
            narration={chaosNarration}
            onAskToRelax={(_conflict, resolution) => {
              void send(resolution.label);
            }}
          />
        )}

        {showReloadExpiredNote && (
          <p className="text-xs italic text-[#5B4A5E] border-t border-[#E6DCD2] pt-2">
            Suggestions expire when you reload: ask again to see them
          </p>
        )}
      </div>
    </div>
  );
}
