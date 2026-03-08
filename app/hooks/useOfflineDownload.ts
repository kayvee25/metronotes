'use client';

import { useState, useCallback, useRef } from 'react';
import { Attachment } from '../types';
import { downloadAndCacheAny, areAttachmentsCached, getCachedAttachmentIds } from '../lib/offline-cache';
import { isCloudLinked } from '../lib/cloud-providers/types';

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
      (a) => (a.type === 'image' || a.type === 'pdf') && (a.storageUrl || isCloudLinked(a))
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
    let authError = false;
    for (const attachment of uncached) {
      if (abortRef.current) break;
      try {
        const success = await downloadAndCacheAny(attachment);
        if (success) done++;
      } catch (err) {
        if (err instanceof Error && err.message.includes('Storage full')) {
          quotaError = true;
          break;
        }
        if (err instanceof Error && err.message.includes('Not authorized')) {
          authError = true;
          // Skip cloud files that need auth, continue with others
          continue;
        }
      }
      setState({ status: 'downloading', progress: { done, total } });
    }

    setState({
      status: done === total ? 'done' : 'error',
      progress: { done, total },
      errorMessage: quotaError
        ? 'Storage full — try clearing the offline cache in Settings'
        : authError
          ? 'Some Drive files need re-authentication — open a Drive file first'
          : undefined,
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
