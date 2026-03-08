'use client';

import { getProvider } from './index';
import { cacheBlob } from '../offline-cache';

/**
 * Fetches a file from a cloud provider and optionally caches it in IndexedDB.
 * Uses silent auth by default (no popup) — returns null if not authorized.
 * Returns a Blob that the caller can use (e.g. create an object URL).
 */
export async function fetchCloudBlob(
  cloudProvider: string,
  cloudFileId: string,
  attachmentId?: string,
): Promise<Blob> {
  const provider = getProvider(cloudProvider as 'google-drive');
  if (!provider) throw new Error(`Unknown cloud provider: ${cloudProvider}`);

  // Only use existing/silently-refreshed token — never open a popup
  const token = await provider.getAccessTokenSilent();
  if (!token) throw new Error('Not authorized — open a file from Drive to sign in');

  const blob = await provider.fetchFile(cloudFileId);

  // Cache in IndexedDB for offline use
  if (attachmentId) {
    cacheBlob(attachmentId, blob).catch((err) => {
      console.warn('[fetchCloudBlob] Cache failed:', err);
    });
  }

  return blob;
}
