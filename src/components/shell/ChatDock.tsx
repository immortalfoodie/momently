'use client';

import { useState } from 'react';
import { Drawer } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';

/**
 * Assistant dock primitive providing contextual GenAI guidance.
 *
 * ACCESSIBILITY DECISION (WHY):
 * Uses `<aside aria-label="Assistant">` for semantic complementary landmark representation.
 * On viewports under 1024px (lg), collapses into an accessible floating action button opening
 * a focus-trapped bottom sheet drawer.
 */
export function ChatDock() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const dockContent = (
    <div className="flex flex-col h-full justify-between">
      <div className="p-4 border-b border-[#E6DCD2] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[#F4EDE6] text-[#6B2D5C] flex items-center justify-center">
            <Icon name="sparkle" size={14} aria-hidden="true" />
          </div>
          <h2 className="font-serif text-base font-bold text-[#2B1B2E]">
            AI Event Assistant
          </h2>
        </div>
      </div>

      <div className="flex-1 p-4 overflow-y-auto flex flex-col justify-center">
        <EmptyState
          icon={<Icon name="sparkle" size={24} aria-hidden="true" />}
          title="Studio Co-pilot"
          description="Ready to evaluate ideas, adjust budgets, stress-test contingency plans, or answer questions."
        />
      </div>

      <div className="p-4 border-t border-[#E6DCD2] bg-white">
        <form
          onSubmit={(e) => e.preventDefault()}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            disabled
            placeholder="Ask me anything..."
            aria-label="Ask me anything"
            className="flex-1 min-h-[44px] px-3.5 py-2 rounded-[12px] border border-[#E6DCD2] bg-[#F4EDE6]/50 text-[#2B1B2E] placeholder-[#5B4A5E]/60 text-sm cursor-not-allowed"
          />
          <button
            type="button"
            disabled
            aria-label="Send message"
            className="w-11 h-11 rounded-[12px] bg-[#6B2D5C] text-white opacity-50 flex items-center justify-center cursor-not-allowed shrink-0"
          >
            <Icon name="send" size={18} aria-hidden="true" />
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Column: fixed right column on lg+ */}
      <aside
        aria-label="Assistant"
        className="hidden lg:flex w-80 bg-white border-l border-[#E6DCD2] flex-col shrink-0 h-[calc(100vh-4rem)] sticky top-16"
      >
        {dockContent}
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
          <div className="h-96">{dockContent}</div>
        </Drawer>
      </div>
    </>
  );
}
