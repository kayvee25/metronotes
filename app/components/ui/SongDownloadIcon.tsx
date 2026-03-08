'use client';

import { useState, useEffect } from 'react';
import { Attachment } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { firestoreGetAttachments } from '../../lib/firestore';
import { areAttachmentsCached, downloadAndCacheAny, getCachedAttachmentIds } from '../../lib/offline-cache';
import { isCloudLinked } from '../../lib/cloud-providers/types';
import { useToast } from './Toast';

interface SongDownloadIconProps {
  songId: string;
  /** Pre-fetched attachments (avoids redundant Firestore reads). */
  attachments?: Attachment[];
}

export default function SongDownloadIcon({ songId, attachments: prefetched }: SongDownloadIconProps) {
  const { user, authState } = useAuth();
  const isGuest = authState === 'guest';
  const { toast } = useToast();

  const [status, setStatus] = useState<'hidden' | 'loading' | 'not-cached' | 'downloading' | 'cached'>('loading');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [attachments, setAttachments] = useState<Attachment[] | null>(prefetched ?? null);

  // Fetch attachments and check cached status
  useEffect(() => {
    if (isGuest || !user) {
      Promise.resolve().then(() => setStatus('hidden'));
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const atts = prefetched ?? await firestoreGetAttachments(user.uid, songId);
        if (cancelled) return;
        setAttachments(atts);

        const media = atts.filter(a => (a.type === 'image' || a.type === 'pdf') && (a.storageUrl || isCloudLinked(a)));
        if (media.length === 0) { setStatus('hidden'); return; }

        const cached = await areAttachmentsCached(media);
        if (!cancelled) setStatus(cached ? 'cached' : 'not-cached');
      } catch {
        if (!cancelled) setStatus('hidden');
      }
    })();

    return () => { cancelled = true; };
  }, [songId, user, isGuest, prefetched]);

  if (isGuest || status === 'hidden' || status === 'loading') return null;

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (status === 'downloading' || status === 'cached' || !attachments) return;

    const media = attachments.filter(a => (a.type === 'image' || a.type === 'pdf') && (a.storageUrl || isCloudLinked(a)));
    const cachedIds = await getCachedAttachmentIds();
    const uncached = media.filter(a => !cachedIds.has(a.id));

    if (uncached.length === 0) { setStatus('cached'); return; }

    const total = media.length;
    let done = total - uncached.length;
    setStatus('downloading');
    setProgress({ done, total });

    let quotaError = false;
    let authError = false;
    for (const att of uncached) {
      try {
        const ok = await downloadAndCacheAny(att);
        if (ok) done++;
      } catch (err) {
        if (err instanceof Error && err.message.includes('Storage full')) {
          quotaError = true;
          break;
        }
        if (err instanceof Error && err.message.includes('Not authorized')) {
          authError = true;
          continue;
        }
      }
      setProgress({ done, total });
    }

    if (done === total) {
      setStatus('cached');
      toast('Downloaded for offline', 'success');
    } else {
      setStatus('not-cached');
      toast(
        quotaError ? 'Storage full — try clearing the offline cache in Settings'
          : authError ? 'Some Drive files need re-authentication'
          : 'Download failed — check your connection'
      );
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleDownload}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleDownload(e as unknown as React.MouseEvent); } }}
      className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all cursor-pointer ${
        status === 'cached'
          ? 'text-green-500'
          : status === 'downloading'
            ? 'text-[var(--accent)] pointer-events-none'
            : 'text-[var(--muted)] hover:bg-[var(--border)]'
      }`}
      aria-label={
        status === 'cached' ? 'Available offline' :
        status === 'downloading' ? `Downloading ${progress.done}/${progress.total}` :
        'Download for offline'
      }
      title={
        status === 'cached' ? 'Available offline' :
        status === 'downloading' ? `${progress.done}/${progress.total}` :
        'Download for offline'
      }
    >
      {status === 'downloading' ? (
        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={3} opacity={0.25} />
          <path d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
        </svg>
      ) : status === 'cached' ? (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75l2.25 2.25L15 11.25" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75v6.75m0 0l-3-3m3 3l3-3m-8.25 6a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
        </svg>
      )}
    </div>
  );
}
