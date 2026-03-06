'use client';

import { useState, useEffect, useCallback } from 'react';
import { Song, SongInput, SongUpdate } from '../types';
import { storage } from '../lib/storage';
import { useAuth } from './useAuth';
import {
  firestoreGetSongs,
  firestoreCreateSong,
  firestoreUpdateSong,
  firestoreDeleteSong,
} from '../lib/firestore';

export function useSongs() {
  const { user, authState } = useAuth();
  const [songs, setSongs] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const createSong = useCallback((input: SongInput): Song => {
    if (isGuest) {
      const song = storage.createSong(input);
      setSongs(storage.getSongs());
      return song;
    }
    // For Firestore, create optimistically with a temp song
    const tempId = crypto.randomUUID();
    const now = new Date().toISOString();
    const tempSong: Song = { ...input, id: tempId, createdAt: now, updatedAt: now };
    setSongs(prev => [...prev, tempSong]);

    if (userId) {
      firestoreCreateSong(userId, input).then((song) => {
        setSongs(prev => prev.map(s => s.id === tempId ? song : s));
      }).catch(() => {
        setSongs(prev => prev.filter(s => s.id !== tempId));
        setError("Can't save — check your internet connection.");
      });
    }
    return tempSong;
  }, [isGuest, userId]);

  const updateSong = useCallback((id: string, update: SongUpdate): Song | null => {
    if (isGuest) {
      const song = storage.updateSong(id, update);
      if (song) setSongs(storage.getSongs());
      return song;
    }

    // Optimistic update
    let updated: Song | null = null;
    setSongs(prev => prev.map(s => {
      if (s.id === id) {
        updated = { ...s, ...update, updatedAt: new Date().toISOString() };
        return updated;
      }
      return s;
    }));

    if (userId) {
      firestoreUpdateSong(userId, id, update).catch(() => {
        // Revert on failure — refresh from Firestore
        setError("Can't save — check your internet connection.");
        firestoreGetSongs(userId).then(setSongs).catch(() => {});
      });
    }
    return updated;
  }, [isGuest, userId]);

  const deleteSong = useCallback((id: string): boolean => {
    if (isGuest) {
      const result = storage.deleteSong(id);
      if (result) setSongs(storage.getSongs());
      return result;
    }

    // Optimistic delete
    setSongs(prev => prev.filter(s => s.id !== id));

    if (userId) {
      firestoreDeleteSong(userId, id).catch(() => {
        setError("Can't save — check your internet connection.");
        firestoreGetSongs(userId).then(setSongs).catch(() => {});
      });
    }
    return true;
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
