'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Attachment, AttachmentInput, AttachmentUpdate, AssetInput } from '../types';
import { storage } from '../lib/storage';
import { useAuth } from './useAuth';
import {
  firestoreGetAttachments,
  firestoreCreateAttachment,
  firestoreUpdateAttachment,
  firestoreDeleteAttachment,
  firestoreDeleteAllAttachments,
  firestoreReorderAttachments,
  firestoreCreateAsset,
  firestoreUpdateAsset,
  firestoreDeleteAsset,
} from '../lib/firestore';
import { deleteAttachmentFile } from '../lib/storage-firebase';
import { removeCachedBlob, downloadAndCache } from '../lib/offline-cache';
import { getGuestBlob, deleteGuestBlob } from '../lib/guest-blob-storage';
import { generateId, getTimestamp } from '../lib/utils';

/** Create attachment + asset, then link them atomically.
 * If any step fails, cleans up and throws. */
async function createLinkedAttachmentAndAsset(
  userId: string,
  songId: string,
  attachmentInput: AttachmentInput,
  assetInput: AssetInput,
): Promise<{ attachment: Attachment; assetId: string }> {
  // Create asset first
  const asset = await firestoreCreateAsset(userId, assetInput);

  // Create attachment with assetId already set
  let attachment: Attachment;
  try {
    attachment = await firestoreCreateAttachment(userId, songId, { ...attachmentInput, assetId: asset.id });
  } catch (err) {
    // Attachment creation failed — clean up the orphaned asset
    firestoreDeleteAsset(userId, asset.id).catch(() => {});
    throw err;
  }

  return { attachment, assetId: asset.id };
}

export function useAttachments(songId: string | null, onError?: (message: string) => void) {
  const { user, authState } = useAuth();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stabilize onError with a ref to avoid stale closures
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  // Track guest blob URLs so we can revoke them on cleanup
  const guestBlobUrlsRef = useRef<string[]>([]);

  const isGuest = authState === 'guest';
  const userId = user?.uid;

  // Load attachments
  useEffect(() => {
    if (!songId) {
      setAttachments([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    // Revoke previous guest blob URLs to prevent memory leaks
    for (const url of guestBlobUrlsRef.current) {
      URL.revokeObjectURL(url);
    }
    guestBlobUrlsRef.current = [];

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        if (isGuest) {
          const localAttachments = storage.getAttachments(songId!);
          // Resolve blob URLs from IndexedDB for binary attachments
          const blobUrls: string[] = [];
          const resolved = await Promise.all(
            localAttachments.map(async (att) => {
              if ((att.type === 'image' || att.type === 'pdf' || att.type === 'audio') && att.storageUrl) {
                const blob = await getGuestBlob(songId!, att.id);
                if (blob) {
                  const url = URL.createObjectURL(blob);
                  blobUrls.push(url);
                  return { ...att, storageUrl: url };
                }
              }
              return att;
            })
          );
          if (!cancelled) {
            guestBlobUrlsRef.current = blobUrls;
            setAttachments(resolved);
          } else {
            // Clean up if cancelled before we could set state
            for (const url of blobUrls) URL.revokeObjectURL(url);
          }
        } else if (userId) {
          const data = await firestoreGetAttachments(userId, songId!);
          if (!cancelled) setAttachments(data);
        }
      } catch {
        if (!cancelled) setError('Could not load attachments.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    if (authState === 'guest' || authState === 'authenticated') {
      load();
    }

    return () => {
      cancelled = true;
      // Revoke on unmount / song change
      for (const url of guestBlobUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
      guestBlobUrlsRef.current = [];
    };
  }, [songId, isGuest, userId, authState]);

  const addRichText = useCallback(async (content?: object): Promise<Attachment> => {
    if (!songId) throw new Error('No song selected');

    const richContent = content || { type: 'doc', content: [{ type: 'paragraph' }] };

    const assetInput: AssetInput = {
      name: 'Rich text',
      type: 'richtext',
      mimeType: 'application/json',
      size: null,
      storageUrl: null,
      storagePath: null,
      content: richContent,
    };

    if (isGuest) {
      const assetId = generateId();
      const now = getTimestamp();
      storage.createAsset({ ...assetInput, id: assetId, createdAt: now, updatedAt: now });

      const input: AttachmentInput = {
        type: 'richtext',
        order: attachments.length,
        isDefault: attachments.length === 0,
        content: richContent,
        assetId,
      };
      const attachment = storage.createAttachment(songId, input);
      setAttachments(storage.getAttachments(songId));
      return attachment;
    }

    if (!userId) throw new Error('Not authenticated');

    const input: AttachmentInput = {
      type: 'richtext',
      order: attachments.length,
      isDefault: attachments.length === 0,
      content: richContent,
    };

    try {
      const { attachment } = await createLinkedAttachmentAndAsset(userId, songId, input, assetInput);
      setAttachments(prev => [...prev, attachment]);
      return attachment;
    } catch {
      onErrorRef.current?.("Can't save — check your internet connection.");
      throw new Error('Failed to create rich text');
    }
  }, [songId, attachments.length, isGuest, userId]);

  const addImage = useCallback(async (input: AttachmentInput): Promise<Attachment> => {
    if (!songId) throw new Error('No song selected');

    // Cloud-linked files are externally hosted — no asset created
    const isCloudLinked = !!input.cloudProvider;

    // Build asset from the attachment input (skip for cloud-linked)
    const assetInput: AssetInput | null = isCloudLinked ? null : {
      name: input.name || input.fileName || `${input.type} attachment`,
      type: input.type as 'image' | 'pdf' | 'audio' | 'drawing',
      mimeType: input.cloudMimeType || (
        input.type === 'pdf' ? 'application/pdf' :
        input.type === 'audio' ? 'audio/mpeg' :
        input.type === 'drawing' ? 'application/json' :
        'image/jpeg'
      ),
      size: input.fileSize || input.cloudFileSize || null,
      storageUrl: input.storageUrl || null,
      storagePath: null,
      ...(input.type === 'drawing' && input.drawingData ? { drawingData: input.drawingData } : {}),
    };

    if (isGuest) {
      let assetId: string | undefined;
      if (assetInput) {
        assetId = generateId();
        const now = getTimestamp();
        storage.createAsset({ ...assetInput, id: assetId, createdAt: now, updatedAt: now });
      }

      const attachment = storage.createAttachment(songId, { ...input, ...(assetId ? { assetId } : {}) });
      setAttachments(storage.getAttachments(songId));
      return attachment;
    }

    if (!userId) throw new Error('Not authenticated');

    try {
      if (assetInput) {
        const { attachment } = await createLinkedAttachmentAndAsset(userId, songId, input, assetInput);
        setAttachments(prev => [...prev, attachment]);
        return attachment;
      } else {
        const attachment = await firestoreCreateAttachment(userId, songId, input);
        setAttachments(prev => [...prev, attachment]);
        return attachment;
      }
    } catch (err) {
      console.error('addImage failed:', err);
      onErrorRef.current?.("Can't save — check your internet connection.");
      throw new Error('Upload failed');
    }
  }, [songId, isGuest, userId]);

  const updateAttachment = useCallback(async (attachmentId: string, update: AttachmentUpdate): Promise<void> => {
    if (!songId) return;

    if (isGuest) {
      storage.updateAttachment(songId, attachmentId, update);
      setAttachments(storage.getAttachments(songId));
      return;
    }

    if (!userId) return;

    try {
      await firestoreUpdateAttachment(userId, songId, attachmentId, update);
      setAttachments(prev => prev.map(a =>
        a.id === attachmentId ? { ...a, ...update, updatedAt: new Date().toISOString() } : a
      ));
    } catch {
      onErrorRef.current?.("Can't save — check your internet connection.");
    }
  }, [songId, isGuest, userId]);

  /** Update the linked Asset's storage fields after file upload, and set runtime storageUrl on the attachment */
  const updateAssetStorage = useCallback(async (attachmentId: string, storageUrl: string, storagePath: string): Promise<void> => {
    if (!songId) return;

    const att = attachments.find(a => a.id === attachmentId);
    if (!att?.assetId) return;

    if (isGuest) {
      storage.updateAsset(att.assetId, { storageUrl, storagePath });
      setAttachments(prev => prev.map(a =>
        a.id === attachmentId ? { ...a, storageUrl, updatedAt: new Date().toISOString() } : a
      ));
      return;
    }

    if (!userId) return;

    try {
      await firestoreUpdateAsset(userId, att.assetId, { storageUrl, storagePath });
      setAttachments(prev => prev.map(a =>
        a.id === attachmentId ? { ...a, storageUrl, updatedAt: new Date().toISOString() } : a
      ));
      // Update offline cache
      downloadAndCache(attachmentId, storageUrl).catch(() => {});
    } catch {
      console.error('Asset storage update failed');
    }
  }, [songId, isGuest, userId, attachments]);

  const deleteAttachment = useCallback(async (attachmentId: string): Promise<void> => {
    if (!songId) return;

    const deleted = attachments.find(a => a.id === attachmentId);
    const remaining = attachments.filter(a => a.id !== attachmentId);
    const needsNewDefault = deleted?.isDefault && remaining.length > 0 && !remaining.some(a => a.isDefault);

    if (isGuest) {
      storage.deleteAttachment(songId, attachmentId);
      deleteGuestBlob(songId, attachmentId); // Clean up IndexedDB blob
      if (needsNewDefault) {
        storage.updateAttachment(songId, remaining[0].id, { isDefault: true });
      }
      setAttachments(storage.getAttachments(songId));
      return;
    }

    if (!userId) return;

    try {
      // Delete file from Storage if it has a binary asset
      if (deleted?.assetId && ['image', 'pdf', 'audio'].includes(deleted.type)) {
        deleteAttachmentFile(userId, songId, attachmentId).catch(() => {});
      }
      await firestoreDeleteAttachment(userId, songId, attachmentId);
      if (needsNewDefault) {
        await firestoreUpdateAttachment(userId, songId, remaining[0].id, { isDefault: true });
      }
      setAttachments(prev => {
        const after = prev.filter(a => a.id !== attachmentId);
        if (needsNewDefault && after.length > 0) {
          return after.map((a, i) => i === 0 ? { ...a, isDefault: true, updatedAt: new Date().toISOString() } : a);
        }
        return after;
      });
    } catch {
      onErrorRef.current?.("Can't delete — check your internet connection.");
    }

    // Remove from offline cache
    removeCachedBlob(attachmentId).catch(() => {});
  }, [songId, attachments, isGuest, userId]);

  const deleteAllAttachments = useCallback(async (): Promise<void> => {
    if (!songId) return;

    // Remove all cached blobs for this song's attachments
    for (const a of attachments) {
      if (a.storageUrl) {
        removeCachedBlob(a.id).catch(() => {});
      }
    }

    if (isGuest) {
      storage.deleteAllAttachments(songId);
      setAttachments([]);
      return;
    }

    if (!userId) return;

    try {
      await firestoreDeleteAllAttachments(userId, songId);
      setAttachments([]);
    } catch {
      onErrorRef.current?.("Can't delete — check your internet connection.");
    }
  }, [songId, attachments, isGuest, userId]);

  const reorderAttachments = useCallback(async (orderedIds: string[]): Promise<void> => {
    if (!songId) return;

    if (isGuest) {
      storage.reorderAttachments(songId, orderedIds);
      setAttachments(storage.getAttachments(songId));
      return;
    }

    if (!userId) return;

    try {
      await firestoreReorderAttachments(userId, songId, orderedIds);
      const now = new Date().toISOString();
      setAttachments(prev => {
        const map = new Map(prev.map(a => [a.id, a]));
        return orderedIds
          .map((id, index) => {
            const att = map.get(id);
            if (!att) return null;
            return { ...att, order: index, updatedAt: now };
          })
          .filter((a): a is Attachment => a !== null);
      });
    } catch {
      onErrorRef.current?.("Can't save — check your internet connection.");
    }
  }, [songId, isGuest, userId]);

  const setDefault = useCallback(async (attachmentId: string): Promise<void> => {
    if (!songId) return;

    if (isGuest) {
      // Clear all defaults, then set the new one
      const all = storage.getAttachments(songId);
      all.forEach(a => {
        if (a.isDefault && a.id !== attachmentId) {
          storage.updateAttachment(songId, a.id, { isDefault: false });
        }
      });
      storage.updateAttachment(songId, attachmentId, { isDefault: true });
      setAttachments(storage.getAttachments(songId));
      return;
    }

    if (!userId) return;

    try {
      // Update all attachments' isDefault in Firestore
      const updates = attachments.map(a =>
        firestoreUpdateAttachment(userId, songId, a.id, { isDefault: a.id === attachmentId })
      );
      await Promise.all(updates);
      setAttachments(prev => prev.map(a => ({
        ...a,
        isDefault: a.id === attachmentId,
        updatedAt: new Date().toISOString(),
      })));
    } catch {
      onErrorRef.current?.("Can't save — check your internet connection.");
    }
  }, [songId, attachments, isGuest, userId]);

  return {
    attachments,
    isLoading,
    error,
    addRichText,
    addImage,
    updateAttachment,
    updateAssetStorage,
    deleteAttachment,
    deleteAllAttachments,
    reorderAttachments,
    setDefault,
  };
}
