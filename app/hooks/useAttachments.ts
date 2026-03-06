'use client';

import { useState, useEffect, useCallback } from 'react';
import { Attachment, AttachmentInput, AttachmentUpdate } from '../types';
import { storage } from '../lib/storage';
import { useAuth } from './useAuth';
import {
  firestoreGetAttachments,
  firestoreCreateAttachment,
  firestoreUpdateAttachment,
  firestoreDeleteAttachment,
  firestoreDeleteAllAttachments,
  firestoreReorderAttachments,
} from '../lib/firestore';

export function useAttachments(songId: string | null) {
  const { user, authState } = useAuth();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        if (isGuest) {
          setAttachments(storage.getAttachments(songId!));
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

    return () => { cancelled = true; };
  }, [songId, isGuest, userId, authState]);

  const addRichText = useCallback((content?: object): Attachment => {
    if (!songId) throw new Error('No song selected');

    const input: AttachmentInput = {
      type: 'richtext',
      order: attachments.length,
      isDefault: attachments.length === 0,
      content: content || { type: 'doc', content: [{ type: 'paragraph' }] },
    };

    if (isGuest) {
      const attachment = storage.createAttachment(songId, input);
      setAttachments(storage.getAttachments(songId));
      return attachment;
    }

    // Optimistic create
    const tempId = crypto.randomUUID();
    const now = new Date().toISOString();
    const tempAttachment: Attachment = { ...input, id: tempId, createdAt: now, updatedAt: now };
    setAttachments(prev => [...prev, tempAttachment]);

    if (userId) {
      firestoreCreateAttachment(userId, songId, input).then((attachment) => {
        setAttachments(prev => prev.map(a => a.id === tempId ? attachment : a));
      }).catch(() => {
        setAttachments(prev => prev.filter(a => a.id !== tempId));
        setError("Can't save — check your internet connection.");
      });
    }

    return tempAttachment;
  }, [songId, attachments.length, isGuest, userId]);

  const addImage = useCallback(async (input: AttachmentInput): Promise<Attachment> => {
    if (!songId) throw new Error('No song selected');

    if (isGuest) {
      const attachment = storage.createAttachment(songId, input);
      setAttachments(storage.getAttachments(songId));
      return attachment;
    }

    // Optimistic create
    const tempId = crypto.randomUUID();
    const now = new Date().toISOString();
    const tempAttachment: Attachment = { ...input, id: tempId, createdAt: now, updatedAt: now };
    setAttachments(prev => [...prev, tempAttachment]);

    if (userId) {
      try {
        const attachment = await firestoreCreateAttachment(userId, songId, input);
        setAttachments(prev => prev.map(a => a.id === tempId ? attachment : a));
        return attachment;
      } catch {
        setAttachments(prev => prev.filter(a => a.id !== tempId));
        setError("Can't save — check your internet connection.");
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
      firestoreUpdateAttachment(userId, songId, attachmentId, update).catch(() => {
        setError("Can't save — check your internet connection.");
        firestoreGetAttachments(userId, songId).then(setAttachments).catch(() => {});
      });
    }
  }, [songId, isGuest, userId]);

  const deleteAttachment = useCallback((attachmentId: string) => {
    if (!songId) return;

    const deleted = attachments.find(a => a.id === attachmentId);
    const remaining = attachments.filter(a => a.id !== attachmentId);
    const needsNewDefault = deleted?.isDefault && remaining.length > 0 && !remaining.some(a => a.isDefault);

    if (isGuest) {
      storage.deleteAttachment(songId, attachmentId);
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
      const deletePromise = firestoreDeleteAttachment(userId, songId, attachmentId);
      if (needsNewDefault) {
        deletePromise.then(() =>
          firestoreUpdateAttachment(userId, songId, remaining[0].id, { isDefault: true })
        ).catch(() => {
          setError("Can't save — check your internet connection.");
          firestoreGetAttachments(userId, songId).then(setAttachments).catch(() => {});
        });
      } else {
        deletePromise.catch(() => {
          setError("Can't save — check your internet connection.");
          firestoreGetAttachments(userId, songId).then(setAttachments).catch(() => {});
        });
      }
    }
  }, [songId, attachments, isGuest, userId]);

  const deleteAllAttachments = useCallback(() => {
    if (!songId) return;

    if (isGuest) {
      storage.deleteAllAttachments(songId);
      setAttachments([]);
      return;
    }

    setAttachments([]);

    if (userId) {
      firestoreDeleteAllAttachments(userId, songId).catch(() => {
        setError("Can't save — check your internet connection.");
        firestoreGetAttachments(userId, songId).then(setAttachments).catch(() => {});
      });
    }
  }, [songId, isGuest, userId]);

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
        setError("Can't save — check your internet connection.");
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
        setError("Can't save — check your internet connection.");
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
