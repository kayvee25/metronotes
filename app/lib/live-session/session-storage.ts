/**
 * IndexedDB-backed storage for session assets (member side).
 *
 * Stores binary asset data received from host via WebRTC.
 * Key format: {songId}:{assetId}
 * Cleared on session end/leave.
 */

const DB_NAME = 'metronotes-session';
const STORE_NAME = 'assets';
const DB_VERSION = 1;

// Blob URLs we've created — revoked on cleanup
const activeBlobUrls = new Map<string, string>();

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function makeKey(songId: string, assetId: string): string {
  return `${songId}:${assetId}`;
}

export async function storeSessionAsset(
  songId: string,
  assetId: string,
  data: ArrayBuffer
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(data, makeKey(songId, assetId));
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function getSessionAsset(
  songId: string,
  assetId: string
): Promise<ArrayBuffer | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(makeKey(songId, assetId));
    request.onsuccess = () => {
      db.close();
      resolve(request.result ?? null);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

export async function hasSessionAsset(
  songId: string,
  assetId: string
): Promise<boolean> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.count(makeKey(songId, assetId));
    request.onsuccess = () => {
      db.close();
      resolve(request.result > 0);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Get a blob URL for a session asset. Creates and caches the URL.
 * Returns null if asset not found in storage.
 */
export async function getSessionAssetUrl(
  songId: string,
  assetId: string,
  mimeType?: string
): Promise<string | null> {
  const key = makeKey(songId, assetId);

  // Return cached URL if available
  const cached = activeBlobUrls.get(key);
  if (cached) return cached;

  const data = await getSessionAsset(songId, assetId);
  if (!data) return null;

  const blob = new Blob([data], { type: mimeType || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  activeBlobUrls.set(key, url);
  return url;
}

/**
 * Get all stored asset keys (format: "songId:assetId").
 * Used on rejoin to pre-populate receivedAssetsRef and skip re-downloads.
 */
export async function getAllSessionAssetKeys(): Promise<string[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAllKeys();
    request.onsuccess = () => {
      db.close();
      resolve((request.result as string[]) ?? []);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Clear all session data and revoke blob URLs.
 */
export async function clearSessionStorage(): Promise<void> {
  // Revoke all blob URLs
  for (const url of activeBlobUrls.values()) {
    URL.revokeObjectURL(url);
  }
  activeBlobUrls.clear();

  // Clear IndexedDB store
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/**
 * Delete all session assets for a specific song and revoke their blob URLs.
 */
export async function deleteSessionAssetsForSong(songId: string): Promise<void> {
  // Revoke blob URLs for this song
  const prefix = `${songId}:`;
  for (const [key, url] of activeBlobUrls) {
    if (key.startsWith(prefix)) {
      URL.revokeObjectURL(url);
      activeBlobUrls.delete(key);
    }
  }

  // Delete from IndexedDB
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        if (typeof cursor.key === 'string' && cursor.key.startsWith(prefix)) {
          cursor.delete();
        }
        cursor.continue();
      }
    };
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/**
 * Revoke all cached blob URLs without clearing IndexedDB.
 */
export function revokeAllBlobUrls(): void {
  for (const url of activeBlobUrls.values()) {
    URL.revokeObjectURL(url);
  }
  activeBlobUrls.clear();
}
