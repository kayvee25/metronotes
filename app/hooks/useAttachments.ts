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
  firestoreDeleteAsset,
} from '../lib/firestore';
import { deleteAttachmentFile } from '../lib/storage-firebase';
import { removeCachedBlob, downloadAndCache } from '../lib/offline-cache';
import { getGuestBlob, deleteGuestBlob } from '../lib/guest-blob-storage';
import { generateId, getTimestamp } from '../lib/utils';

/** Shared helper: create attachment + asset in parallel, then link them.
 * If one creation fails, the other is cleaned up to avoid orphans.
 * If the link step fails, both entities exist but are unlinked — migration will fix. */
async function createLinkedAttachmentAndAsset(
  userId: string,
  songId: string,
  attachmentInput: AttachmentInput,
  assetInput: AssetInput,
): Promise<{ attachment: Attachment; assetId: string }> {
  const [attResult, assetResult] = await Promise.allSettled([
    firestoreCreateAttachment(userId, songId, attachmentInput),
    firestoreCreateAsset(userId, assetInput),
  ]);

  const attachment = attResult.status === 'fulfilled' ? attResult.value : null;
  const asset = assetResult.status === 'fulfilled' ? assetResult.value : null;

  if (!attachment && !asset) {
    // Both failed
    throw attResult.status === 'rejected' ? attResult.reason : new Error('Failed to create attachment and asset');
  }
  if (attachment && !asset) {
    // Attachment created but asset failed — acceptable, just no asset link
    return { attachment, assetId: '' };
  }
  if (asset && !attachment) {
    // Asset created but attachment failed — delete the orphaned asset
    firestoreDeleteAsset(userId, asset.id).catch(() => {});
    throw assetResult.status === 'rejected' ? assetResult.reason : new Error('Failed to create attachment');
  }

  // Both succeeded — link asset to attachment
  await firestoreUpdateAttachment(userId, songId, attachment!.id, { assetId: asset!.id }).catch((err) => {
    console.error('Failed to link asset to attachment:', err);
  });
  return { attachment: { ...attachment!, assetId: asset!.id }, assetId: asset!.id };
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

  const addRichText = useCallback((content?: object): Attachment => {
    if (!songId) throw new Error('No song selected');

    const richContent = content || { type: 'doc', content: [{ type: 'paragraph' }] };

    const assetInput: AssetInput = {
      name: 'Rich text',
      type: 'richtext',
      mimeType: 'application/json',
      size: null,
      storageUrl: null,
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

    // Firestore: create attachment + asset in parallel
    const input: AttachmentInput = {
      type: 'richtext',
      order: attachments.length,
      isDefault: attachments.length === 0,
      content: richContent,
    };

    const tempId = generateId();
    const now = new Date().toISOString();
    const tempAttachment: Attachment = { ...input, id: tempId, createdAt: now, updatedAt: now };
    setAttachments(prev => [...prev, tempAttachment]);

    if (userId) {
      createLinkedAttachmentAndAsset(userId, songId, input, assetInput).then(({ attachment }) => {
        setAttachments(prev => prev.map(a => a.id === tempId ? attachment : a));
      }).catch(() => {
        setAttachments(prev => prev.filter(a => a.id !== tempId));
        onErrorRef.current?.("Can't save — check your internet connection.");
      });
    }

    return tempAttachment;
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

    // Optimistic create
    const tempId = generateId();
    const now = new Date().toISOString();
    const tempAttachment: Attachment = { ...input, id: tempId, createdAt: now, updatedAt: now };
    setAttachments(prev => [...prev, tempAttachment]);

    if (userId) {
      try {
        if (assetInput) {
          const { attachment } = await createLinkedAttachmentAndAsset(userId, songId, input, assetInput);
          setAttachments(prev => prev.map(a => a.id === tempId ? attachment : a));
          return attachment;
        } else {
          const attachment = await firestoreCreateAttachment(userId, songId, input);
          setAttachments(prev => prev.map(a => a.id === tempId ? attachment : a));
          return attachment;
        }
      } catch (err) {
        console.error('addImage failed:', err);
        setAttachments(prev => prev.filter(a => a.id !== tempId));
        onErrorRef.current?.("Can't save — check your internet connection.");
        throw new Error('Upload failed');
      }
    }

    return tempAttachment;
  }, [songId, isGuest, userId]);

  const updateAttachment = useCallback((attachmentId: string, update: AttachmentUpdate) => {
    if (!songId) return;

    if (isGuest) {
      storage.updateAttachment(songId, attachmentId, update);
      setAttachments(storage.getAttachments(songId));
      return;
    }

    // Optimistic update
    setAttachments(prev => prev.map(a =>
      a.id === attachmentId ? { ...a, ...update, updatedAt: new Date().toISOString() } : a
    ));

    if (userId) {
      firestoreUpdateAttachment(userId, songId, attachmentId, update).catch((err) => {
        console.error('Attachment update failed:', err);
        onErrorRef.current?.("Can't save — check your internet connection.");
        firestoreGetAttachments(userId, songId).then(setAttachments).catch(() => {});
      });
    }

    // Auto-update offline cache if storageUrl changed
    if (update.storageUrl) {
      downloadAndCache(attachmentId, update.storageUrl).catch(() => {});
    }
  }, [songId, isGuest, userId]);

  const deleteAttachment = useCallback((attachmentId: string) => {
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

    // Optimistic delete + promote default
    setAttachments(prev => {
      const after = prev.filter(a => a.id !== attachmentId);
      if (needsNewDefault && after.length > 0) {
        return after.map((a, i) => i === 0 ? { ...a, isDefault: true, updatedAt: new Date().toISOString() } : a);
      }
      return after;
    });

    if (userId) {
      // Delete file from Storage if it's an image
      if (deleted?.storagePath) {
        deleteAttachmentFile(userId, songId, attachmentId).catch(() => {});
      }
      const deletePromise = firestoreDeleteAttachment(userId, songId, attachmentId);
      if (needsNewDefault) {
        deletePromise.then(() =>
          firestoreUpdateAttachment(userId, songId, remaining[0].id, { isDefault: true })
        ).catch(() => {
          onErrorRef.current?.("Can't save — check your internet connection.");
          firestoreGetAttachments(userId, songId).then(setAttachments).catch(() => {});
        });
      } else {
        deletePromise.catch(() => {
          onErrorRef.current?.("Can't save — check your internet connection.");
          firestoreGetAttachments(userId, songId).then(setAttachments).catch(() => {});
        });
      }
    }

    // Remove from offline cache
    removeCachedBlob(attachmentId).catch(() => {});
  }, [songId, attachments, isGuest, userId]);

  const deleteAllAttachments = useCallback(() => {
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

    setAttachments([]);

    if (userId) {
      firestoreDeleteAllAttachments(userId, songId).catch(() => {
        onErrorRef.current?.("Can't save — check your internet connection.");
        firestoreGetAttachments(userId, songId).then(setAttachments).catch(() => {});
      });
    }
  }, [songId, attachments, isGuest, userId]);

  const reorderAttachments = useCallback((orderedIds: string[]) => {
    if (!songId) return;

    if (isGuest) {
      storage.reorderAttachments(songId, orderedIds);
      setAttachments(storage.getAttachments(songId));
      return;
    }

    // Optimistic reorder
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

    if (userId) {
      firestoreReorderAttachments(userId, songId, orderedIds).catch(() => {
        onErrorRef.current?.("Can't save — check your internet connection.");
        firestoreGetAttachments(userId, songId).then(setAttachments).catch(() => {});
      });
    }
  }, [songId, isGuest, userId]);

  const setDefault = useCallback((attachmentId: string) => {
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

    // Optimistic: update all in state
    setAttachments(prev => prev.map(a => ({
      ...a,
      isDefault: a.id === attachmentId,
      updatedAt: new Date().toISOString(),
    })));

    if (userId) {
      // Update all attachments' isDefault in Firestore
      const updates = attachments.map(a =>
        firestoreUpdateAttachment(userId, songId, a.id, { isDefault: a.id === attachmentId })
      );
      Promise.all(updates).catch(() => {
        onErrorRef.current?.("Can't save — check your internet connection.");
        firestoreGetAttachments(userId, songId).then(setAttachments).catch(() => {});
      });
    }
  }, [songId, attachments, isGuest, userId]);

  return {
    attachments,
    isLoading,
    error,
    addRichText,
    addImage,
    updateAttachment,
    deleteAttachment,
    deleteAllAttachments,
    reorderAttachments,
    setDefault,
  };
}
