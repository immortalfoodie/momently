'use client';

import { Suspense, useState, type ReactNode } from 'react';
import { ChatProvider } from '@/components/chat/ChatProvider';
import { TourBar } from '@/components/demo/TourBar';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Dialog';
import { useEventsStore } from '@/store/eventsStore';
import { safeStorage } from '@/store/safeStorage';
import { useTourStore } from '@/store/tourStore';
import { useHydrateStore } from '@/store/useHydrateStore';
import { ChatDock } from './ChatDock';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

export interface AppShellProps {
  children: ReactNode;
}

const STORAGE_FALLBACK_NOTICE =
  'Your browser is blocking storage, so changes will be lost when you close this tab. Export your data from Settings to keep a copy.';

function AppShellInner({ children }: AppShellProps) {
  const hydrated = useHydrateStore();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [storageNoticeDismissed, setStorageNoticeDismissed] = useState(false);
  const tourActive = useTourStore((s) => s.active);
  const storeNotice = useEventsStore((s) => s.notice);
  const dismissNotice = useEventsStore((s) => s.dismissNotice);

  const showStorageFallbackNotice =
    hydrated && !storageNoticeDismissed && !safeStorage.isPersistent();

  return (
    <div className="min-h-screen bg-[#FBF7F2] text-[#2B1B2E] flex flex-col">
      <Header onToggleMobileNav={() => setIsMobileNavOpen(true)} />

      <div className="flex-1 flex min-w-0">
        {/* Desktop Sidebar: visible on lg+ */}
        <Sidebar className="hidden lg:flex sticky top-[var(--header-h)] h-[calc(100dvh-var(--header-h))] overflow-y-auto min-h-0" />

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
          className={`flex-1 min-w-0 max-w-full outline-none ${
            tourActive ? 'pb-48 sm:pb-40' : ''
          }`}
        >
          <div className="w-full">
            {(showStorageFallbackNotice || storeNotice) && (
              <div className="px-4 sm:px-6 lg:px-8 pt-4 space-y-4">
                {showStorageFallbackNotice && (
                  <Alert
                    tone="warning"
                    action={
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setStorageNoticeDismissed(true)}
                        aria-label="Dismiss storage notice"
                      >
                        Dismiss
                      </Button>
                    }
                  >
                    {STORAGE_FALLBACK_NOTICE}
                  </Alert>
                )}
                {storeNotice && (
                  <Alert
                    tone="warning"
                    action={
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={dismissNotice}
                        aria-label="Dismiss notice"
                      >
                        Dismiss
                      </Button>
                    }
                  >
                    {storeNotice}
                  </Alert>
                )}
              </div>
            )}
            {children}
          </div>
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
