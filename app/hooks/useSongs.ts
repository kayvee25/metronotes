'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Song, SongInput, SongUpdate } from '../types';
import { storage } from '../lib/storage';
import { GUEST } from '../lib/constants';
import { deleteAllGuestBlobs } from '../lib/guest-blob-storage';
import { useAuth } from './useAuth';
import {
  firestoreGetSongs,
  firestoreCreateSong,
  firestoreUpdateSong,
  firestoreDeleteSong,
  firestoreDeleteAllAttachments,
  firestoreGetAttachments,
  firestoreDeleteAsset,
} from '../lib/firestore';

export function useSongs(onError?: (message: string) => void) {
  const { user, authState } = useAuth();
  const [songs, setSongs] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const isGuest = authState === 'guest';
  const userId = user?.uid;

  // Load songs on mount and when auth changes
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        if (isGuest) {
          setSongs(storage.getSongs());
        } else if (userId) {
          const data = await firestoreGetSongs(userId);
          if (!cancelled) setSongs(data);
        }
      } catch {
        if (!cancelled) setError("Could not load data. Tap refresh to retry.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    if (authState === 'guest' || authState === 'authenticated') {
      load();
    }

    return () => { cancelled = true; };
  }, [isGuest, userId, authState]);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      if (isGuest) {
        setSongs(storage.getSongs());
      } else if (userId) {
        const data = await firestoreGetSongs(userId);
        setSongs(data);
      }
    } catch {
      setError("Could not load data. Tap refresh to retry.");
    }
  }, [isGuest, userId]);

  const createSong = useCallback(async (input: SongInput): Promise<Song | null> => {
    if (isGuest) {
      if (songs.length >= GUEST.MAX_SONGS) {
        onErrorRef.current?.(`Guest mode is limited to ${GUEST.MAX_SONGS} songs. Sign in for unlimited songs.`);
        return null;
      }
      const song = storage.createSong(input);
      setSongs(storage.getSongs());
      return song;
    }

    if (!userId) return null;

    try {
      const song = await firestoreCreateSong(userId, input);
      setSongs(prev => [...prev, song]);
      return song;
    } catch {
      onErrorRef.current?.("Can't save — check your internet connection.");
      return null;
    }
  }, [isGuest, userId, songs.length]);

  const updateSong = useCallback(async (id: string, update: SongUpdate): Promise<Song | null> => {
    if (isGuest) {
      const song = storage.updateSong(id, update);
      if (song) setSongs(storage.getSongs());
      return song;
    }

    if (!userId) return null;

    try {
      await firestoreUpdateSong(userId, id, update);
      let updated: Song | null = null;
      setSongs(prev => prev.map(s => {
        if (s.id === id) {
          updated = { ...s, ...update, updatedAt: new Date().toISOString() };
          return updated;
        }
        return s;
      }));
      return updated;
    } catch {
      onErrorRef.current?.("Can't save — check your internet connection.");
      return null;
    }
  }, [isGuest, userId]);

  const deleteSong = useCallback(async (id: string, keepFiles: boolean = false): Promise<boolean> => {
    if (isGuest) {
      const attachments = storage.getAttachments(id);
      if (!keepFiles) {
        for (const att of attachments) {
          if (att.assetId) storage.deleteAsset(att.assetId);
        }
      }
      storage.deleteAllAttachments(id);
      deleteAllGuestBlobs(id); // Clean up IndexedDB binary files
      const result = storage.deleteSong(id);
      if (result) setSongs(storage.getSongs());
      return result;
    }

    if (!userId) return false;

    try {
      const attachments = await firestoreGetAttachments(userId, id);
      if (!keepFiles) {
        const assetIds = attachments.map(a => a.assetId).filter((aid): aid is string => !!aid);
        const results = await Promise.allSettled(assetIds.map(assetId => firestoreDeleteAsset(userId, assetId)));
        const failures = results.filter(r => r.status === 'rejected').length;
        if (failures > 0) {
          onErrorRef.current?.(`${failures} file(s) could not be deleted. They may still exist in your library.`);
        }
      }
      await firestoreDeleteAllAttachments(userId, id);
      await firestoreDeleteSong(userId, id);
      setSongs(prev => prev.filter(s => s.id !== id));
      return true;
    } catch {
      onErrorRef.current?.("Can't delete — check your internet connection.");
      return false;
    }
  }, [isGuest, userId]);

  const getSong = useCallback((id: string): Song | null => {
    return songs.find(s => s.id === id) || null;
  }, [songs]);

  return {
    songs,
    isLoading,
    error,
    createSong,
    updateSong,
    deleteSong,
    getSong,
    refresh,
  };
}
