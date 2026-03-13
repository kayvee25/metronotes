'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Attachment } from '../types';
import { getSessionAsset, getSessionAssetUrl } from '../lib/live-session/session-storage';

/**
 * Resolves attachment content from session IndexedDB for member performance view.
 *
 * - richtext/drawing: fetches ArrayBuffer, deserializes JSON, sets content/drawingData
 * - image/pdf/audio: creates blob URL, sets storageUrl
 *
 * Polls for missing assets so the view updates as downloads complete.
 */
export function useSessionAttachments(
  songId: string | null,
  attachments: Attachment[],
) {
  const [resolvedAttachments, setResolvedAttachments] = useState<Attachment[]>([]);
  const [allAssetsReady, setAllAssetsReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Track previous inputs to detect changes during render (React 19 pattern)
  const [prevKey, setPrevKey] = useState<string | null>(null);
  const key = songId ? `${songId}:${attachments.length}` : null;

  if (key !== prevKey) {
    setPrevKey(key);
    if (!songId || attachments.length === 0) {
      setResolvedAttachments([]);
      setAllAssetsReady(attachments.length === 0);
      setLoading(false);
    } else {
      setLoading(true);
      setAllAssetsReady(false);
    }
  }

  const resolve = useCallback(async (sid: string, atts: Attachment[], cancelled: { current: boolean }) => {
    const resolved = await Promise.all(
      atts.map(async (att) => {
        if (!att.assetId) return att;

        if (att.type === 'richtext' || att.type === 'drawing') {
          // Fetch the JSON ArrayBuffer, deserialize, set content/drawingData
          const data = await getSessionAsset(sid, att.assetId);
          if (!data) return att;
          try {
            const json = new TextDecoder().decode(data);
            const parsed = JSON.parse(json);
            if (att.type === 'richtext') {
              return { ...att, content: parsed };
            } else {
              return { ...att, drawingData: parsed };
            }
          } catch {
            return att;
          }
        }

        if (att.type === 'image' || att.type === 'pdf' || att.type === 'audio') {
          // Create blob URL from IndexedDB
          const mimeType = att.type === 'image' ? 'image/png'
            : att.type === 'pdf' ? 'application/pdf'
            : 'audio/mpeg';
          const url = await getSessionAssetUrl(sid, att.assetId, mimeType);
          if (url) {
            return { ...att, storageUrl: url };
          }
          return att;
        }

        return att;
      })
    );

    if (cancelled.current) return false;

    // Check if all attachments with assetId are resolved
    const allReady = resolved.every(att => {
      if (!att.assetId) return true;
      if (att.type === 'richtext') return !!att.content;
      if (att.type === 'drawing') return !!att.drawingData;
      return att.storageUrl?.startsWith('blob:');
    });

    setResolvedAttachments(resolved);
    setAllAssetsReady(allReady);
    setLoading(false);

    return allReady;
  }, []);

  useEffect(() => {
    if (!songId || attachments.length === 0) return;

    const cancelled = { current: false };

    async function run() {
      const ready = await resolve(songId!, attachments, cancelled);
      if (cancelled.current) return;

      // If not all assets ready, poll every 2s for newly arrived assets
      if (!ready) {
        pollTimerRef.current = setInterval(async () => {
          if (cancelled.current) return;
          const nowReady = await resolve(songId!, attachments, cancelled);
          if (nowReady && pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
          }
        }, 2000);
      }
    }

    run();

    return () => {
      cancelled.current = true;
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [songId, attachments, resolve]);

  return { resolvedAttachments, allAssetsReady, loading };
}
