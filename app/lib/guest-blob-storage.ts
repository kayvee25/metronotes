'use client';

import { createStore, get, set, del, keys } from 'idb-keyval';

// Separate IndexedDB store for guest binary files (images, PDFs, audio)
const store = createStore('metronotes-guest', 'blobs');

function blobKey(songId: string, attachmentId: string): string {
  return `guest:${songId}:${attachmentId}`;
}

export async function getGuestBlob(songId: string, attachmentId: string): Promise<Blob | null> {
  try {
    const blob = await get<Blob>(blobKey(songId, attachmentId), store);
    return blob ?? null;
  } catch (err) {
    console.warn('[guest-blob-storage] getGuestBlob failed:', err);
    return null;
  }
}

export async function saveGuestBlob(songId: string, attachmentId: string, blob: Blob): Promise<void> {
  try {
    await set(blobKey(songId, attachmentId), blob, store);
  } catch (err) {
    if (err instanceof DOMException && (err.name === 'QuotaExceededError' || err.code === 22)) {
      throw new Error('Storage full — try deleting some songs');
    }
    throw err;
  }
}

export async function deleteGuestBlob(songId: string, attachmentId: string): Promise<void> {
  try {
    await del(blobKey(songId, attachmentId), store);
  } catch {
    // Silently ignore delete failures
  }
}

export async function deleteAllGuestBlobs(songId: string): Promise<void> {
  try {
    const allKeys = await keys<string>(store);
    const prefix = `guest:${songId}:`;
    for (const k of allKeys) {
      if (k.startsWith(prefix)) {
        await del(k, store);
      }
    }
  } catch {
    // Silently ignore
  }
}

/** Get all guest blob entries as {songId, attachmentId, blob} for migration. */
export async function getAllGuestBlobs(): Promise<{ songId: string; attachmentId: string; blob: Blob }[]> {
  try {
    const allKeys = await keys<string>(store);
    const results: { songId: string; attachmentId: string; blob: Blob }[] = [];
    for (const k of allKeys) {
      if (k.startsWith('guest:')) {
        const parts = k.split(':');
        if (parts.length === 3) {
          const blob = await get<Blob>(k, store);
          if (blob) {
            results.push({ songId: parts[1], attachmentId: parts[2], blob });
          }
        }
      }
    }
    return results;
  } catch (err) {
    console.warn('[guest-blob-storage] getAllGuestBlobs failed:', err);
    return [];
  }
}

/** Clear all guest blob data (after migration). */
export async function clearAllGuestBlobs(): Promise<void> {
  try {
    const allKeys = await keys<string>(store);
    for (const k of allKeys) {
      if (k.startsWith('guest:')) {
        await del(k, store);
      }
    }
  } catch {
    // Silently ignore
  }
}
