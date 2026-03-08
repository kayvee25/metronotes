'use client';

import { useState, useEffect } from 'react';
import { getCachedBlob } from '../lib/offline-cache';

/**
 * Resolves an attachment's display URL:
 * 1. If a cached blob exists in IndexedDB, returns an object URL from it.
 * 2. Otherwise returns the original storageUrl (for online fetching).
 * 3. If offline and not cached, returns null.
 *
 * Cleans up object URLs on unmount to prevent memory leaks.
 */
export function useCachedUrl(
  attachmentId: string | undefined,
  storageUrl: string | undefined,
  isOnline: boolean,
): { url: string | null; fromCache: boolean; loading: boolean } {
  const [state, setState] = useState<{ url: string | null; fromCache: boolean; loading: boolean }>({
    url: null,
    fromCache: false,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    if (!attachmentId || !storageUrl) {
      Promise.resolve().then(() => {
        if (!cancelled) setState({ url: null, fromCache: false, loading: false });
      });
      return () => { cancelled = true; };
    }

    getCachedBlob(attachmentId).then((blob) => {
      if (cancelled) return;

      if (blob) {
        objectUrl = URL.createObjectURL(blob);
        setState({ url: objectUrl, fromCache: true, loading: false });
      } else if (isOnline) {
        setState({ url: storageUrl, fromCache: false, loading: false });
      } else {
        // Offline and not cached
        setState({ url: null, fromCache: false, loading: false });
      }
    }).catch(() => {
      if (!cancelled) {
        // Fallback: use storageUrl if online, null if offline
        setState({
          url: isOnline ? storageUrl : null,
          fromCache: false,
          loading: false,
        });
      }
    });

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [attachmentId, storageUrl, isOnline]);

  return state;
}
