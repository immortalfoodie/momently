'use client';

import { useState } from 'react';
import { useAnnouncer } from './LiveRegion';

export interface CopyTextOptions {
  announceText?: string;
  title?: string;
  description?: string;
}

export interface UseCopyTextResult {
  copyText: (text: string, options?: CopyTextOptions) => Promise<boolean>;
  fallbackOpen: boolean;
  fallbackText: string;
  fallbackTitle: string;
  fallbackDescription: string;
  closeFallback: () => void;
}

const DEFAULT_DESCRIPTION =
  'Clipboard access was blocked. Select and copy the text below.';

async function tryWriteClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Shared hook for copying text to the clipboard with polite screen-reader announcement
 * and automatic modal fallback when clipboard permissions are denied or unavailable.
 */
export function useCopyText(): UseCopyTextResult {
  const { announce } = useAnnouncer();
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const [fallbackText, setFallbackText] = useState('');
  const [fallbackTitle, setFallbackTitle] = useState('Copy text');
  const [fallbackDescription, setFallbackDescription] =
    useState(DEFAULT_DESCRIPTION);

  const copyText = async (
    text: string,
    options?: CopyTextOptions,
  ): Promise<boolean> => {
    setFallbackText(text);
    setFallbackTitle(options?.title ?? 'Copy text');
    setFallbackDescription(options?.description ?? DEFAULT_DESCRIPTION);

    const wrote = await tryWriteClipboard(text);
    if (wrote) {
      announce(options?.announceText ?? 'Copied');
      return true;
    }

    setFallbackOpen(true);
    return false;
  };

  const closeFallback = () => {
    setFallbackOpen(false);
  };

  return {
    copyText,
    fallbackOpen,
    fallbackText,
    fallbackTitle,
    fallbackDescription,
    closeFallback,
  };
}
