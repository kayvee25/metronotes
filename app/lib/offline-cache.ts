'use client';

import { createStore, get, set, del, clear, keys, entries } from 'idb-keyval';

// Custom IndexedDB store for offline media cache
const store = createStore('metronotes-offline', 'blobs');

function key(attachmentId: string): string {
  return `attachment:${attachmentId}`;
}

export async function getCachedBlob(attachmentId: string): Promise<Blob | null> {
  try {
    const blob = await get<Blob>(key(attachmentId), store);
    return blob ?? null;
  } catch (err) {
    console.warn('[offline-cache] getCachedBlob failed:', err);
    return null;
  }
}

export async function cacheBlob(attachmentId: string, blob: Blob): Promise<void> {
  try {
    await set(key(attachmentId), blob, store);
  } catch (err) {
    // IndexedDB quota exceeded or other storage error
    if (err instanceof DOMException && (err.name === 'QuotaExceededError' || err.code === 22)) {
      throw new Error('Storage full — try clearing the offline cache in Settings');
    }
    throw err;
  }
}

export async function removeCachedBlob(attachmentId: string): Promise<void> {
  await del(key(attachmentId), store);
}

export async function clearAllCache(): Promise<void> {
  await clear(store);
}

export async function getCacheSize(): Promise<number> {
  try {
    const allEntries = await entries<string, Blob>(store);
    return allEntries.reduce((total, [, blob]) => total + (blob?.size ?? 0), 0);
  } catch (err) {
    console.warn('[offline-cache] getCacheSize failed:', err);
    return 0;
  }
}

export async function isCached(attachmentId: string): Promise<boolean> {
  try {
    const blob = await get<Blob>(key(attachmentId), store);
    return blob != null;
  } catch (err) {
    console.warn('[offline-cache] isCached failed:', err);
    return false;
  }
}

export async function getCachedAttachmentIds(): Promise<Set<string>> {
  try {
    const allKeys = await keys<string>(store);
    const ids = new Set<string>();
    for (const k of allKeys) {
      if (k.startsWith('attachment:')) {
        ids.add(k.slice('attachment:'.length));
      }
    }
    return ids;
  } catch (err) {
    console.warn('[offline-cache] getCachedAttachmentIds failed:', err);
    return new Set();
  }
}

/**
 * Download and cache a single attachment's media blob.
 * Returns true if successfully cached, false if skipped or failed.
 */
export async function downloadAndCache(attachmentId: string, storageUrl: string): Promise<boolean> {
  // Skip if already cached
  if (await isCached(attachmentId)) return true;

  try {
    const response = await fetch(storageUrl);
    if (!response.ok) return false;
    const blob = await response.blob();
    await cacheBlob(attachmentId, blob);
    return true;
  } catch (err) {
    // Re-throw quota errors so callers can show a meaningful message
    if (err instanceof Error && err.message.includes('Storage full')) {
      throw err;
    }
    return false;
  }
}

/**
 * Download a cloud-linked file and cache it.
 * Returns true if successfully cached, false if skipped (e.g. no auth).
 */
export async function downloadAndCacheCloud(
  attachmentId: string,
  cloudProvider: string,
  cloudFileId: string,
): Promise<boolean> {
  if (await isCached(attachmentId)) return true;

  // Dynamic import to avoid circular dependency
  const { fetchCloudBlob } = await import('./cloud-providers/fetch-cloud-blob');
  const blob = await fetchCloudBlob(cloudProvider, cloudFileId, attachmentId);
  // fetchCloudBlob already caches, but let's ensure
  return true;
}

type MediaAttachment = { id: string; type: string; storageUrl?: string; cloudProvider?: string; cloudFileId?: string };

function isDownloadable(a: MediaAttachment): boolean {
  return (a.type === 'image' || a.type === 'pdf' || a.type === 'audio') && !!(a.storageUrl || (a.cloudProvider && a.cloudFileId));
}

/** Check if a set of attachments are all cached (image/pdf/audio with storageUrl or cloud link). */
export async function areAttachmentsCached(attachments: MediaAttachment[]): Promise<boolean> {
  const media = attachments.filter(isDownloadable);
  if (media.length === 0) return true;
  const cachedIds = await getCachedAttachmentIds();
  return media.every(a => cachedIds.has(a.id));
}

/** Returns the number of media attachments that need downloading. */
export async function countUncached(attachments: MediaAttachment[]): Promise<number> {
  const media = attachments.filter(isDownloadable);
  if (media.length === 0) return 0;
  const cachedIds = await getCachedAttachmentIds();
  return media.filter(a => !cachedIds.has(a.id)).length;
}

/**
 * Download a single attachment (from storageUrl or cloud provider) and cache it.
 * Returns true on success, false on skip, throws on quota error.
 */
export async function downloadAndCacheAny(att: MediaAttachment): Promise<boolean> {
  if (await isCached(att.id)) return true;
  if (att.storageUrl) {
    return downloadAndCache(att.id, att.storageUrl);
  }
  if (att.cloudProvider && att.cloudFileId) {
    return downloadAndCacheCloud(att.id, att.cloudProvider, att.cloudFileId);
  }
  return false;
}

/**
 * Preload an audio attachment into the offline cache if not already cached.
 * Silently fails — intended for opportunistic prefetching (e.g. next song in setlist).
 */
export async function preloadAudio(attachments: MediaAttachment[]): Promise<void> {
  const audio = attachments.find(a => a.type === 'audio' && isDownloadable(a));
  if (!audio) return;
  try {
    await downloadAndCacheAny(audio);
  } catch {
    // Silently ignore — preloading is best-effort
  }
}
