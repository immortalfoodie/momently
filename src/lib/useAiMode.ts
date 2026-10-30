'use client';

import { useEffect, useState } from 'react';
import { fetchHealth } from './apiClient';

/** Which AI is answering: a live model, the offline demo engine, or nothing reachable. */
export interface AiModeState {
  status: 'live' | 'demo' | 'offline';
  model?: string;
}

let inflight: Promise<AiModeState> | null = null;

function loadAiMode(): Promise<AiModeState> {
  inflight ??= fetchHealth()
    .then((res): AiModeState => {
      if (!res.ok) return { status: 'offline' };
      return res.value.mode === 'live'
        ? { status: 'live', ...(res.value.model ? { model: res.value.model } : {}) }
        : { status: 'demo' };
    })
    .catch((): AiModeState => ({ status: 'offline' }))
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/**
 * Reports whether live AI, demo mode, or offline mode is active.
 * WHY: The header, assistant panel and settings all mount together; sharing one in-flight
 * request avoids three identical /api/health calls on every page load, while never caching
 * a stale answer once the request settles.
 *
 * @returns Current AI mode; 'demo' until the health check answers.
 */
export function useAiMode(): AiModeState {
  const [state, setState] = useState<AiModeState>({ status: 'demo' });

  useEffect(() => {
    let mounted = true;
    void loadAiMode().then((next) => {
      if (mounted) setState(next);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return state;
}
