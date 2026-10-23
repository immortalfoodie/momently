'use client';

import { useContext } from 'react';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { ChatContext, ChatProvider, useChat } from '@/components/chat/ChatProvider';
import { Drawer } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';

function ChatDockInner() {
  const { isMobileOpen, setIsMobileOpen } = useChat();

  return (
    <>
      {/* Desktop Column: fixed right column on lg+ */}
      <aside
        aria-label="Assistant"
        className="hidden lg:flex w-80 bg-white border-l border-[#E6DCD2] flex-col shrink-0 h-[calc(100vh-4rem)] sticky top-16"
      >
        {!isMobileOpen ? <ChatPanel /> : null}
      </aside>

      {/* Mobile Floating Trigger: below lg */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setIsMobileOpen(true)}
          aria-label="Open AI Event Assistant"
          className="fixed bottom-5 right-5 z-40 p-3.5 rounded-full bg-[#6B2D5C] text-white shadow-xl hover:bg-[#55224A] cursor-pointer"
        >
          <Icon name="sparkle" size={24} aria-hidden="true" />
        </button>

        <Drawer
          open={isMobileOpen}
          onClose={() => setIsMobileOpen(false)}
          placement="bottom"
          title="AI Event Assistant"
        >
          <div className="h-96">{isMobileOpen ? <ChatPanel /> : null}</div>
        </Drawer>
      </div>
    </>
  );
}

/**
 * Assistant dock primitive providing contextual GenAI guidance.
 *
 * ACCESSIBILITY DECISION (WHY):
 * Uses `<aside aria-label="Assistant">` for semantic complementary landmark representation.
 * On viewports under 1024px (lg), collapses into an accessible floating action button opening
 * a focus-trapped bottom sheet drawer.
 */
export function ChatDock() {
  const parentContext = useContext(ChatContext);
  if (!parentContext) {
    return (
      <ChatProvider>
        <ChatDockInner />
      </ChatProvider>
    );
  }
  return <ChatDockInner />;
}
