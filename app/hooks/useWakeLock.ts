'use client';

import { useEffect, useRef } from 'react';

export function useWakeLock(enabled: boolean, active: boolean) {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!enabled || !active) {
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
      return;
    }

    let cancelled = false;

    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          const sentinel = await navigator.wakeLock.request('screen');
          if (!cancelled) {
            wakeLockRef.current = sentinel;
          } else {
            sentinel.release();
          }
        }
      } catch {}
    };

    requestWakeLock();

    // Re-acquire on visibility change (wake lock is released when tab is hidden)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && enabled && active) {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    };
  }, [enabled, active]);
}
