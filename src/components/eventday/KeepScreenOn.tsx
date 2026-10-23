'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

export interface KeepScreenOnProps {
  className?: string;
}

interface WakeLockSentinelLike {
  release: () => Promise<void>;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
}

interface NavigatorWithWakeLock {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockSentinelLike>;
  };
}

function subscribeWakeLock() {
  return () => {};
}

function getWakeLockSnapshot() {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
}

function getWakeLockServerSnapshot() {
  return false;
}

export function KeepScreenOn({ className = '' }: KeepScreenOnProps) {
  const supported = useSyncExternalStore(
    subscribeWakeLock,
    getWakeLockSnapshot,
    getWakeLockServerSnapshot,
  );
  const [active, setActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);

  const handleToggle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setActive(checked);
    setErrorMsg(null);

    if (checked) {
      try {
        const nav = navigator as NavigatorWithWakeLock;
        if (nav.wakeLock?.request) {
          sentinelRef.current = await nav.wakeLock.request('screen');
        }
      } catch {
        setErrorMsg('Could not keep screen on (battery saver or browser restriction active).');
        setActive(false);
      }
    } else {
      if (sentinelRef.current) {
        try {
          await sentinelRef.current.release();
        } catch {
          // Safe ignore on release failure
        }
        sentinelRef.current = null;
      }
    }
  };

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && active && !sentinelRef.current) {
        try {
          const nav = navigator as NavigatorWithWakeLock;
          if (nav.wakeLock?.request) {
            sentinelRef.current = await nav.wakeLock.request('screen');
          }
        } catch {
          // Safe ignore on visibility re-acquisition
        }
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [active]);

  useEffect(() => {
    return () => {
      if (sentinelRef.current) {
        void sentinelRef.current.release();
        sentinelRef.current = null;
      }
    };
  }, []);

  if (!supported) {
    return null;
  }

  return (
    <div className={`space-y-1.5 ${className}`}>
      <label className="min-h-[44px] inline-flex items-center gap-2.5 cursor-pointer text-sm font-medium text-[#2B1B2E]">
        <input
          type="checkbox"
          checked={active}
          onChange={handleToggle}
          className="w-5 h-5 rounded border-[#E6DCD2] text-[#2B1B2E] focus:ring-1 focus:ring-[#2B1B2E]"
        />
        <span>Keep screen on</span>
      </label>
      {errorMsg && (
        <p className="text-xs text-[#A82B35]" role="alert">
          {errorMsg}
        </p>
      )}
    </div>
  );
}
