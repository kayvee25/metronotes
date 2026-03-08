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

/** Check if a set of attachments are all cached (only considers image/pdf types). */
export async function areAttachmentsCached(attachments: { id: string; type: string; storageUrl?: string }[]): Promise<boolean> {
  const mediaAttachments = attachments.filter(a => (a.type === 'image' || a.type === 'pdf') && a.storageUrl);
  if (mediaAttachments.length === 0) return true;
  const cachedIds = await getCachedAttachmentIds();
  return mediaAttachments.every(a => cachedIds.has(a.id));
}

/** Returns the number of media attachments that need downloading. */
export async function countUncached(attachments: { id: string; type: string; storageUrl?: string }[]): Promise<number> {
  const mediaAttachments = attachments.filter(a => (a.type === 'image' || a.type === 'pdf') && a.storageUrl);
  if (mediaAttachments.length === 0) return 0;
  const cachedIds = await getCachedAttachmentIds();
  return mediaAttachments.filter(a => !cachedIds.has(a.id)).length;
}
