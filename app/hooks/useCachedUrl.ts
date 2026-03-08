'use client';

import { useState, useEffect } from 'react';
import { getCachedBlob } from '../lib/offline-cache';
import { fetchCloudBlob } from '../lib/cloud-providers/fetch-cloud-blob';

/**
 * Resolves an attachment's display URL:
 * 1. If a cached blob exists in IndexedDB, returns an object URL from it.
 * 2. Otherwise returns the original storageUrl (for online fetching).
 * 3. If no storageUrl but cloud provider info is present, fetches from cloud and caches.
 * 4. If offline and not cached, returns null.
 *
 * Cleans up object URLs on unmount to prevent memory leaks.
 */
export function useCachedUrl(
  attachmentId: string | undefined,
  storageUrl: string | undefined,
  isOnline: boolean,
  cloud?: { provider: string; fileId: string } | undefined,
): { url: string | null; fromCache: boolean; loading: boolean } {
  const [state, setState] = useState<{ url: string | null; fromCache: boolean; loading: boolean }>({
    url: null,
    fromCache: false,
    loading: true,
  });

  const cloudProvider = cloud?.provider;
  const cloudFileId = cloud?.fileId;

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    if (!attachmentId || (!storageUrl && !cloudProvider)) {
      Promise.resolve().then(() => {
        if (!cancelled) setState({ url: null, fromCache: false, loading: false });
      });
      return () => { cancelled = true; };
    }

    getCachedBlob(attachmentId).then(async (blob) => {
      if (cancelled) return;

      if (blob) {
        objectUrl = URL.createObjectURL(blob);
        setState({ url: objectUrl, fromCache: true, loading: false });
        return;
      }

      if (storageUrl && isOnline) {
        setState({ url: storageUrl, fromCache: false, loading: false });
        return;
      }

      // Try fetching from cloud provider
      if (cloudProvider && cloudFileId && isOnline) {
        try {
          const cloudBlob = await fetchCloudBlob(cloudProvider, cloudFileId, attachmentId);
          if (cancelled) return;
          objectUrl = URL.createObjectURL(cloudBlob);
          setState({ url: objectUrl, fromCache: false, loading: false });
        } catch {
          // Silent auth not available — user needs to interact with Drive first
          if (!cancelled) setState({ url: null, fromCache: false, loading: false });
        }
        return;
      }

      // Offline and not cached
      setState({ url: null, fromCache: false, loading: false });
    }).catch(() => {
      if (!cancelled) {
        // Fallback: use storageUrl if online, null if offline
        setState({
          url: isOnline ? (storageUrl || null) : null,
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
  }, [attachmentId, storageUrl, isOnline, cloudProvider, cloudFileId]);

  return state;
}
