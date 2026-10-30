'use client';

import { useContext, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';
import { useAiMode } from '@/lib/useAiMode';
import { ChatContext, ChatProvider, useChat } from './ChatProvider';
import { Composer } from './Composer';
import { MessageList } from './MessageList';
import { SuggestedPrompts } from './SuggestedPrompts';

type AssistantHealthMode = 'demo' | 'live';

function useAssistantHealthMode(): AssistantHealthMode {
  return useAiMode().status === 'live' ? 'live' : 'demo';
}

function ChatPanelInner({ onClose }: { onClose?: () => void }) {
  const { mode, messages, welcomeVisible, clear } = useChat();
  const healthMode = useAssistantHealthMode();
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  const handleConfirmClear = () => {
    clear();
    setConfirmClearOpen(false);
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-white">
      <div className="p-3.5 border-b border-[#E6DCD2] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-full bg-[#F4EDE6] text-[#6B2D5C] flex items-center justify-center shrink-0">
            <Icon name="sparkle" size={14} aria-hidden="true" />
          </div>
          <h2 className="font-serif text-base font-bold text-[#2B1B2E] truncate">
            Assistant
          </h2>
          {healthMode === 'live' ? (
            <Badge tone="success" className="whitespace-nowrap shrink-0">
              Live AI
            </Badge>
          ) : (
            <Badge tone="brand" className="whitespace-nowrap shrink-0">
              Demo mode
            </Badge>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {messages.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setConfirmClearOpen(true)}
              aria-label="Clear conversation"
              className="text-xs text-[#2B1B2E]"
            >
              Clear
            </Button>
          )}
          {onClose ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              aria-label="Close AI assistant"
              title="Close assistant"
              className="px-2 text-[#5B4A5E]"
              icon={<Icon name="close" size={17} aria-hidden="true" />}
            >
              <span className="sr-only">Close</span>
            </Button>
          ) : null}
        </div>
      </div>

      <MessageList />

      {!welcomeVisible && mode === 'event' && (
        <div className="px-3.5 py-2 border-t border-[#E6DCD2] bg-[#FAF5F0] shrink-0">
          <SuggestedPrompts />
        </div>
      )}

      <div className="shrink-0">
        <Composer />
      </div>

      <Dialog
        open={confirmClearOpen}
        onClose={() => setConfirmClearOpen(false)}
        title="Clear conversation?"
        description="This removes the chat messages from this view. Your celebration plan and approved decisions remain untouched."
      >
        <div className="flex items-center justify-end gap-3 mt-4">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setConfirmClearOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={handleConfirmClear}
          >
            Confirm clear
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

export interface ChatPanelProps {
  eventId?: string;
  onClose?: () => void;
}

/**
 * Complete AI Event Assistant panel combining header status, message log, context-aware
 * prompt chips, and the message composer.
 */
export function ChatPanel({ eventId, onClose }: ChatPanelProps = {}) {
  const parentContext = useContext(ChatContext);
  if (!parentContext) {
    return (
      <ChatProvider initialEventId={eventId}>
        <ChatPanelInner onClose={onClose} />
      </ChatProvider>
    );
  }
  return <ChatPanelInner onClose={onClose} />;
}
