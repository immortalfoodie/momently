'use client';

import { useContext, type FormEvent, type KeyboardEvent } from 'react';
import { Field } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { TextArea } from '@/components/ui/TextArea';
import { ChatContext, ChatProvider, useChat } from './ChatProvider';

function ComposerInner() {
  const { composerText, setComposerText, composerRef, pending, send } = useChat();

  const submitCurrentText = () => {
    if (pending) return;
    const trimmed = composerText.trim();
    if (!trimmed) return;
    setComposerText('');
    composerRef.current?.focus();
    void send(trimmed);
  };

  const handleFormSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    submitCurrentText();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitCurrentText();
    }
  };

  return (
    <form
      onSubmit={handleFormSubmit}
      className="p-3 border-t border-[#E6DCD2] bg-white space-y-2"
    >
      <div className="flex items-end gap-2">
        <div className="flex-1 min-w-0">
          <Field label="Ask me anything">
            <TextArea
              ref={composerRef}
              rows={2}
              maxLength={500}
              showCount
              placeholder="Ask to adjust budget, guests, or test a scenario..."
              value={composerText}
              onChange={(e) => setComposerText(e.target.value)}
              onKeyDown={handleKeyDown}
              className="text-sm resize-none"
            />
          </Field>
        </div>

        <button
          type="submit"
          disabled={pending}
          aria-label="Send message"
          className="w-11 h-11 mb-5 rounded-[12px] bg-[#6B2D5C] text-white hover:bg-[#55224A] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shrink-0 transition-colors cursor-pointer"
        >
          <Icon name="send" size={18} aria-hidden="true" />
        </button>
      </div>
    </form>
  );
}

/**
 * Chat message composer with Enter-to-send, Shift+Enter newline, 500-char threshold counter,
 * and automatic focus restoration to the textarea after sending.
 */
export function Composer() {
  const parentContext = useContext(ChatContext);
  if (!parentContext) {
    return (
      <ChatProvider>
        <ComposerInner />
      </ChatProvider>
    );
  }
  return <ComposerInner />;
}
