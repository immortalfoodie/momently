'use client';

import { Suspense, useState, type ReactNode } from 'react';
import { ChatProvider } from '@/components/chat/ChatProvider';
import { TourBar } from '@/components/demo/TourBar';
import { Drawer } from '@/components/ui/Dialog';
import { useTourStore } from '@/store/tourStore';
import { useHydrateStore } from '@/store/useHydrateStore';
import { ChatDock } from './ChatDock';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

export interface AppShellProps {
  children: ReactNode;
}

function AppShellInner({ children }: AppShellProps) {
  useHydrateStore();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const tourActive = useTourStore((s) => s.active);

  return (
    <div className="min-h-screen bg-[#FBF7F2] text-[#2B1B2E] flex flex-col">
      <Header onToggleMobileNav={() => setIsMobileNavOpen(true)} />

      <div className="flex-1 flex overflow-x-hidden">
        {/* Desktop Sidebar: visible on lg+ */}
        <Sidebar className="hidden lg:flex" />

        {/* Mobile Navigation Drawer */}
        <Drawer
          open={isMobileNavOpen}
          onClose={() => setIsMobileNavOpen(false)}
          placement="right"
          title="Navigation"
          className="lg:hidden"
        >
          <Sidebar
            className="w-full border-none p-0 bg-white"
            onNavigate={() => setIsMobileNavOpen(false)}
          />
        </Drawer>

        {/* Central Workspace Main Landmark */}
        <main
          id="main-content"
          tabIndex={-1}
          className={`flex-1 min-w-0 max-w-full p-4 sm:p-6 lg:p-8 outline-none ${
            tourActive ? 'pb-48 sm:pb-40' : ''
          }`}
        >
          <div className="max-w-5xl mx-auto">{children}</div>
        </main>

        {/* Contextual Assistant Complementary Landmark */}
        <ChatDock />
      </div>

      <TourBar />
    </div>
  );
}

/**
 * Responsive application shell establishing the primary landmark architecture.
 *
 * ACCESSIBILITY DECISION (WHY):
 * 1. Landmarks: header (banner), nav (Main), main (Main Content), aside (Assistant).
 * 2. Focus Management: Mobile nav drawer locks scroll and restores focus upon closure.
 * 3. Responsive Layout: Operates cleanly from 360px to 1440px without horizontal scroll.
 */
export function AppShell({ children }: AppShellProps) {
  return (
    <Suspense fallback={null}>
      <ChatProvider>
        <AppShellInner>{children}</AppShellInner>
      </ChatProvider>
    </Suspense>
  );
}
