'use client';

import { useContext, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';
import { fetchHealth } from '@/lib/apiClient';
import { ChatContext, ChatProvider, useChat } from './ChatProvider';
import { Composer } from './Composer';
import { MessageList } from './MessageList';
import { SuggestedPrompts } from './SuggestedPrompts';

type AssistantHealthMode = 'demo' | 'live';

function useAssistantHealthMode(): AssistantHealthMode {
  const [healthMode, setHealthMode] = useState<AssistantHealthMode>('demo');

  useEffect(() => {
    if (typeof fetchHealth !== 'function') return;
    let mounted = true;
    fetchHealth()
      .then((res) => {
        if (!mounted) return;
        if (res.ok && res.value.mode === 'live') {
          setHealthMode('live');
        } else {
          setHealthMode('demo');
        }
      })
      .catch(() => {
        if (mounted) setHealthMode('demo');
      });
    return () => {
      mounted = false;
    };
  }, []);

  return healthMode;
}

function ChatPanelInner() {
  const { mode, messages, welcomeVisible, clear } = useChat();
  const healthMode = useAssistantHealthMode();
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  const handleConfirmClear = () => {
    clear();
    setConfirmClearOpen(false);
  };

  return (
    <div className="flex flex-col h-full justify-between bg-white">
      <div className="p-3.5 border-b border-[#E6DCD2] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-full bg-[#F4EDE6] text-[#6B2D5C] flex items-center justify-center shrink-0">
            <Icon name="sparkle" size={14} aria-hidden="true" />
          </div>
          <h2 className="font-serif text-base font-bold text-[#2B1B2E] truncate">
            AI Event Assistant
          </h2>
          {healthMode === 'live' ? (
            <Badge tone="success">Live AI</Badge>
          ) : (
            <Badge tone="brand">Demo mode</Badge>
          )}
        </div>

        <button
          type="button"
          onClick={() => setConfirmClearOpen(true)}
          disabled={messages.length === 0}
          aria-label="Clear conversation"
          className="text-xs font-medium text-[#5B4A5E] hover:text-[#2B1B2E] px-2 py-1 rounded hover:bg-[#F4EDE6] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shrink-0"
        >
          Clear
        </button>
      </div>

      <MessageList />

      {!welcomeVisible && mode === 'event' && (
        <div className="px-3.5 py-2 border-t border-[#E6DCD2] bg-[#FAF5F0]">
          <SuggestedPrompts />
        </div>
      )}

      <Composer />

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
}

/**
 * Complete AI Event Assistant panel combining header status, message log, context-aware
 * prompt chips, and the message composer.
 */
export function ChatPanel({ eventId }: ChatPanelProps = {}) {
  const parentContext = useContext(ChatContext);
  if (!parentContext) {
    return (
      <ChatProvider initialEventId={eventId}>
        <ChatPanelInner />
      </ChatProvider>
    );
  }
  return <ChatPanelInner />;
}
