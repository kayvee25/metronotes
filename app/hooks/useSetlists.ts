'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Setlist, SetlistInput, SetlistUpdate } from '../types';
import { storage } from '../lib/storage';
import { useAuth } from './useAuth';
import {
  firestoreGetSetlists,
  firestoreCreateSetlist,
  firestoreUpdateSetlist,
  firestoreDeleteSetlist,
} from '../lib/firestore';

export function useSetlists(onError?: (message: string) => void) {
  const { user, authState } = useAuth();
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const isGuest = authState === 'guest';
  const userId = user?.uid;

  // Load setlists on mount and when auth changes
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        if (isGuest) {
          setSetlists(storage.getSetlists());
        } else if (userId) {
          const data = await firestoreGetSetlists(userId);
          if (!cancelled) setSetlists(data);
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
        setSetlists(storage.getSetlists());
      } else if (userId) {
        const data = await firestoreGetSetlists(userId);
        setSetlists(data);
      }
    } catch {
      setError("Could not load data. Tap refresh to retry.");
    }
  }, [isGuest, userId]);

  const createSetlist = useCallback(async (input: SetlistInput): Promise<Setlist | null> => {
    if (isGuest) {
      const setlist = storage.createSetlist(input);
      setSetlists(storage.getSetlists());
      return setlist;
    }

    if (!userId) return null;

    try {
      const setlist = await firestoreCreateSetlist(userId, input);
      setSetlists(prev => [...prev, setlist]);
      return setlist;
    } catch {
      onErrorRef.current?.("Can't save — check your internet connection.");
      return null;
    }
  }, [isGuest, userId]);

  const updateSetlist = useCallback(async (id: string, update: SetlistUpdate): Promise<Setlist | null> => {
    if (isGuest) {
      const setlist = storage.updateSetlist(id, update);
      if (setlist) setSetlists(storage.getSetlists());
      return setlist;
    }

    if (!userId) return null;

    try {
      await firestoreUpdateSetlist(userId, id, update);
      let updated: Setlist | null = null;
      setSetlists(prev => prev.map(s => {
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

  const deleteSetlist = useCallback(async (id: string): Promise<boolean> => {
    if (isGuest) {
      const result = storage.deleteSetlist(id);
      if (result) setSetlists(storage.getSetlists());
      return result;
    }

    if (!userId) return false;

    try {
      await firestoreDeleteSetlist(userId, id);
      setSetlists(prev => prev.filter(s => s.id !== id));
      return true;
    } catch {
      onErrorRef.current?.("Can't delete — check your internet connection.");
      return false;
    }
  }, [isGuest, userId]);

  const getSetlist = useCallback((id: string): Setlist | null => {
    return setlists.find(s => s.id === id) || null;
  }, [setlists]);

  const addSongToSetlist = useCallback(async (setlistId: string, songId: string): Promise<Setlist | null> => {
    const setlist = setlists.find(s => s.id === setlistId);
    if (!setlist || setlist.songIds.includes(songId)) return setlist || null;

    const update = { songIds: [...setlist.songIds, songId] };

    if (isGuest) {
      const result = storage.updateSetlist(setlistId, update);
      if (result) setSetlists(storage.getSetlists());
      return result;
    }

    if (!userId) return null;

    try {
      await firestoreUpdateSetlist(userId, setlistId, update);
      const updated: Setlist = { ...setlist, ...update, updatedAt: new Date().toISOString() };
      setSetlists(prev => prev.map(s => s.id === setlistId ? updated : s));
      return updated;
    } catch {
      onErrorRef.current?.("Can't save — check your internet connection.");
      return null;
    }
  }, [setlists, isGuest, userId]);

  const removeSongFromSetlist = useCallback(async (setlistId: string, songId: string): Promise<Setlist | null> => {
    const setlist = setlists.find(s => s.id === setlistId);
    if (!setlist) return null;

    const update = { songIds: setlist.songIds.filter((id) => id !== songId) };

    if (isGuest) {
      const result = storage.updateSetlist(setlistId, update);
      if (result) setSetlists(storage.getSetlists());
      return result;
    }

    if (!userId) return null;

    try {
      await firestoreUpdateSetlist(userId, setlistId, update);
      const updated: Setlist = { ...setlist, ...update, updatedAt: new Date().toISOString() };
      setSetlists(prev => prev.map(s => s.id === setlistId ? updated : s));
      return updated;
    } catch {
      onErrorRef.current?.("Can't save — check your internet connection.");
      return null;
    }
  }, [setlists, isGuest, userId]);

  const reorderSongs = useCallback(async (setlistId: string, songIds: string[]): Promise<Setlist | null> => {
    const update = { songIds };

    if (isGuest) {
      const result = storage.updateSetlist(setlistId, update);
      if (result) setSetlists(storage.getSetlists());
      return result;
    }

    if (!userId) return null;

    const setlist = setlists.find(s => s.id === setlistId);
    if (!setlist) return null;

    try {
      await firestoreUpdateSetlist(userId, setlistId, update);
      const updated: Setlist = { ...setlist, ...update, updatedAt: new Date().toISOString() };
      setSetlists(prev => prev.map(s => s.id === setlistId ? updated : s));
      return updated;
    } catch {
      onErrorRef.current?.("Can't save — check your internet connection.");
      return null;
    }
  }, [setlists, isGuest, userId]);

  return {
    setlists,
    isLoading,
    error,
    createSetlist,
    updateSetlist,
    deleteSetlist,
    getSetlist,
    addSongToSetlist,
    removeSongFromSetlist,
    reorderSongs,
    refresh,
  };
}
