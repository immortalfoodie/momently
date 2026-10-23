'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import * as NextNavigation from 'next/navigation';
import { useAnnouncer } from '@/components/ui/LiveRegion';
import { sendMessage, slimPlanForRequest, submitIntake, type ClientError } from '@/lib/apiClient';
import { outcomeToText } from '@/lib/chatText';
import { engineContext } from '@/store/engineContext';
import { useEventsStore } from '@/store/eventsStore';
import type { ChatMessage } from '@/store/persistSchema';
import { useTourStore } from '@/store/tourStore';

export type ChatMode = 'event' | 'intake';

export interface ChatContextValue {
  mode: ChatMode;
  eventId: string | null;
  messages: ChatMessage[];
  pending: boolean;
  welcomeVisible: boolean;
  canRetry: boolean;
  composerText: string;
  setComposerText: (text: string) => void;
  composerRef: RefObject<HTMLTextAreaElement | null>;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  isSessionError: (messageId: string) => boolean;
  send: (text: string) => Promise<void>;
  retryLast: () => Promise<void>;
  clear: () => void;
}

export const ChatContext = createContext<ChatContextValue | null>(null);
const EMPTY_MESSAGES: ChatMessage[] = [];

function formatClientError(error: ClientError): string {
  if (error.code === 'rate_limited') {
    return `Rate limit reached. Please wait ${error.retryAfterSeconds ?? 30} seconds before trying again.`;
  }
  if (error.code === 'network') {
    return "I couldn't reach the server. Your plan is safe; please try again";
  }
  return 'Something went wrong while processing your request. Please try again.';
}

function useOptionalPathname(): string {
  try { return NextNavigation.usePathname() || '/'; } catch { return '/'; }
}

function useOptionalRouter(): { push: (href: string) => void } | undefined {
  try { return NextNavigation.useRouter(); } catch { return undefined; }
}

function resolveActiveEventId(
  initialEventId: string | undefined,
  pathname: string,
  tourActive: boolean,
  tourEventId: string | null,
  events: Record<string, unknown>,
): string | null {
  if (initialEventId) return initialEventId;
  const routeId = pathname.match(/^\/events\/([^/]+)/)?.[1];
  if (routeId) return routeId;
  if (tourActive && tourEventId && events[tourEventId]) return tourEventId;
  return null;
}

export interface ChatProviderProps {
  children: ReactNode;
  initialEventId?: string;
}

export function ChatProvider({ children, initialEventId }: ChatProviderProps) {
  const pathname = useOptionalPathname();
  const router = useOptionalRouter();
  const { announce } = useAnnouncer();

  const tourActive = useTourStore((s) => s.active);
  const tourEventId = useTourStore((s) => s.eventId);
  const events = useEventsStore((s) => s.events);

  const eventId = resolveActiveEventId(initialEventId, pathname, tourActive, tourEventId, events);
  const mode: ChatMode = eventId ? 'event' : 'intake';

  const eventMessages = useEventsStore((s) =>
    eventId ? (s.events[eventId]?.messages ?? EMPTY_MESSAGES) : EMPTY_MESSAGES,
  );
  const [intakeMessages, setIntakeMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [canRetry, setCanRetry] = useState(false);
  const [composerText, setComposerText] = useState('');
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const pendingRef = useRef(false);
  const lastFailedTextRef = useRef<string | null>(null);
  const sessionErrorIdsRef = useRef<Set<string>>(new Set());
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  const messages = mode === 'event' ? eventMessages : intakeMessages;
  const welcomeVisible = messages.length === 0;

  useEffect(() => {
    const consumeDraft = (draft: string) => {
      if (!draft) return;
      useEventsStore.getState().setChatDraft('');
      setComposerText(draft);
      if (typeof window !== 'undefined' && window.innerWidth < 1024) setIsMobileOpen(true);
      composerRef.current?.focus();
      requestAnimationFrame(() => composerRef.current?.focus());
    };
    const initial = useEventsStore.getState().chatDraft;
    if (initial) queueMicrotask(() => consumeDraft(initial));
    return useEventsStore.subscribe((state, prev) => {
      if (state.chatDraft && state.chatDraft !== prev.chatDraft) consumeDraft(state.chatDraft);
    });
  }, []);

  const sendInEventMode = useCallback(
    async (activeEventId: string, trimmed: string) => {
      const store = useEventsStore.getState();
      const record = store.events[activeEventId];
      if (!record) return;

      const basedOnVersion = record.plan.version;
      const recentMessages = record.messages
        .slice(-6)
        .map((m) => ({ role: m.role, text: m.text.slice(0, 300) }));
      store.addMessage(activeEventId, { role: 'user', text: trimmed, basedOnVersion });

      const res = await sendMessage({
        message: trimmed,
        plan: slimPlanForRequest(record.plan),
        recentMessages,
      });

      const latest = useEventsStore.getState();
      if (res.ok) {
        const { outcome, narration } = res.value;
        const shortText = outcomeToText(outcome, narration);
        latest.addMessage(activeEventId, { role: 'assistant', text: shortText, outcomeKind: outcome.kind, basedOnVersion });
        const added = useEventsStore.getState().events[activeEventId]?.messages.at(-1);
        if (added) useEventsStore.getState().setOutcome(added.id, outcome);
        lastFailedTextRef.current = null;
        setCanRetry(false);
        announce(shortText);
      } else {
        const errText = formatClientError(res.error);
        latest.addMessage(activeEventId, { role: 'assistant', text: errText, outcomeKind: 'error', basedOnVersion });
        const added = useEventsStore.getState().events[activeEventId]?.messages.at(-1);
        if (added) sessionErrorIdsRef.current.add(added.id);
        lastFailedTextRef.current = trimmed;
        setCanRetry(true);
        announce(errText);
      }
    },
    [announce],
  );

  const sendInIntakeMode = useCallback(
    async (trimmed: string) => {
      const nowIso = engineContext.clock().toISOString();
      setIntakeMessages((prev) => [
        ...prev,
        { id: engineContext.ids('msg'), role: 'user', text: trimmed, createdAt: nowIso },
      ]);
      const res = await submitIntake(trimmed);
      if (res.ok) {
        const createdId = useEventsStore.getState().createEvent(res.value.plan, {
          assumptions: res.value.assumptions,
          missingInfo: res.value.missingInfo,
        });
        lastFailedTextRef.current = null;
        setCanRetry(false);
        announce(`Created ${res.value.plan.meta.title}`);
        router?.push(`/events/${createdId}/concepts`);
      } else {
        const errText = formatClientError(res.error);
        const errId = engineContext.ids('msg');
        sessionErrorIdsRef.current.add(errId);
        setIntakeMessages((prev) => [
          ...prev,
          { id: errId, role: 'assistant', text: errText, createdAt: nowIso, outcomeKind: 'error' },
        ]);
        lastFailedTextRef.current = trimmed;
        setCanRetry(true);
        announce(errText);
      }
    },
    [announce, router],
  );

  const send = useCallback(
    async (rawText: string) => {
      const trimmed = rawText.trim().slice(0, 500);
      if (!trimmed || pendingRef.current) return;
      pendingRef.current = true;
      setPending(true);
      try {
        if (mode === 'event' && eventId) await sendInEventMode(eventId, trimmed);
        else await sendInIntakeMode(trimmed);
      } finally {
        pendingRef.current = false;
        setPending(false);
        composerRef.current?.focus();
      }
    },
    [mode, eventId, sendInEventMode, sendInIntakeMode],
  );

  const retryLast = useCallback(async () => {
    if (lastFailedTextRef.current && !pendingRef.current) await send(lastFailedTextRef.current);
  }, [send]);

  const clear = useCallback(() => {
    if (mode === 'event' && eventId) useEventsStore.getState().clearMessages(eventId);
    else setIntakeMessages([]);
    lastFailedTextRef.current = null;
    setCanRetry(false);
    announce('Conversation cleared');
  }, [mode, eventId, announce]);

  const isSessionError = useCallback((msgId: string) => sessionErrorIdsRef.current.has(msgId), []);

  return (
    <ChatContext.Provider
      value={{
        mode, eventId, messages, pending, welcomeVisible, canRetry,
        composerText, setComposerText, composerRef, isMobileOpen, setIsMobileOpen,
        isSessionError, send, retryLast, clear,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within a ChatProvider');
  return ctx;
}
