'use client';

import { useContext, useState } from 'react';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { ChatContext, ChatProvider, useChat } from '@/components/chat/ChatProvider';
import { Drawer } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';

function ChatDockInner() {
  const { isMobileOpen, setIsMobileOpen } = useChat();
  const [isDesktopOpen, setIsDesktopOpen] = useState(true);

  return (
    <>
      {/* Desktop Column: fixed right column on xl+ */}
      {isDesktopOpen ? (
        <aside
          id="desktop-assistant-panel"
          aria-label="Assistant"
          className="hidden xl:flex xl:w-[22rem] 2xl:w-[24rem] bg-white border-l border-[#E6DCD2] flex-col shrink-0 sticky top-[var(--header-h)] h-[calc(100dvh-var(--header-h))] overflow-hidden min-h-0"
        >
          <ChatPanel onClose={() => setIsDesktopOpen(false)} />
        </aside>
      ) : (
        <button
          type="button"
          onClick={() => setIsDesktopOpen(true)}
          aria-label="Open AI Event Assistant"
          aria-controls="desktop-assistant-panel"
          aria-expanded={false}
          title="Open AI assistant"
          className="fixed right-0 top-1/2 z-30 hidden h-14 w-8 -translate-y-1/2 items-center justify-center rounded-l-xl border border-r-0 border-[#E6DCD2] bg-white text-[#6B2D5C] shadow-md transition-colors hover:bg-[#F4EDE6] focus-visible:z-40 xl:flex"
        >
          <Icon name="sparkle" size={18} aria-hidden="true" />
        </button>
      )}

      {/* Mobile Floating Trigger: below xl */}
      <div className="xl:hidden">
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
          title="Assistant"
        >
          <div className="h-[75vh] max-h-[36rem] flex flex-col min-h-0">{isMobileOpen ? <ChatPanel /> : null}</div>
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
