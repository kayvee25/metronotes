'use client';

import { useState, useCallback, useRef } from 'react';
import { Attachment } from '../types';
import { downloadAndCache, areAttachmentsCached, getCachedAttachmentIds } from '../lib/offline-cache';

export type DownloadStatus = 'idle' | 'checking' | 'downloading' | 'done' | 'error';

interface DownloadProgress {
  done: number;
  total: number;
}

interface DownloadState {
  status: DownloadStatus;
  progress: DownloadProgress;
  errorMessage?: string;
}

export function useOfflineDownload() {
  const [state, setState] = useState<DownloadState>({
    status: 'idle',
    progress: { done: 0, total: 0 },
  });
  const abortRef = useRef(false);

  const downloadAttachments = useCallback(async (attachments: Attachment[]) => {
    const media = attachments.filter(
      (a) => (a.type === 'image' || a.type === 'pdf') && a.storageUrl
    );

    if (media.length === 0) {
      setState({ status: 'done', progress: { done: 0, total: 0 } });
      return;
    }

    // Check which ones are already cached
    const cachedIds = await getCachedAttachmentIds();
    const uncached = media.filter((a) => !cachedIds.has(a.id));

    if (uncached.length === 0) {
      setState({ status: 'done', progress: { done: media.length, total: media.length } });
      return;
    }

    const total = media.length;
    let done = total - uncached.length;
    abortRef.current = false;

    setState({ status: 'downloading', progress: { done, total } });

    let quotaError = false;
    for (const attachment of uncached) {
      if (abortRef.current) break;
      try {
        const success = await downloadAndCache(attachment.id, attachment.storageUrl!);
        if (success) done++;
      } catch (err) {
        // Storage quota exceeded — stop downloading
        if (err instanceof Error && err.message.includes('Storage full')) {
          quotaError = true;
          break;
        }
      }
      setState({ status: 'downloading', progress: { done, total } });
    }

    setState({
      status: done === total ? 'done' : 'error',
      progress: { done, total },
      errorMessage: quotaError ? 'Storage full — try clearing the offline cache in Settings' : undefined,
    });
  }, []);

  const checkCached = useCallback(async (attachments: Attachment[]): Promise<boolean> => {
    return areAttachmentsCached(attachments);
  }, []);

  const cancel = useCallback(() => {
    abortRef.current = true;
  }, []);

  const reset = useCallback(() => {
    abortRef.current = true;
    setState({ status: 'idle', progress: { done: 0, total: 0 } });
  }, []);

  return {
    ...state,
    downloadAttachments,
    checkCached,
    cancel,
    reset,
  };
}
