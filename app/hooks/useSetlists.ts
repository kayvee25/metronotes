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

  const createSetlist = useCallback((input: SetlistInput): Setlist => {
    if (isGuest) {
      const setlist = storage.createSetlist(input);
      setSetlists(storage.getSetlists());
      return setlist;
    }

    const tempId = crypto.randomUUID();
    const now = new Date().toISOString();
    const tempSetlist: Setlist = { ...input, id: tempId, createdAt: now, updatedAt: now };
    setSetlists(prev => [...prev, tempSetlist]);

    if (userId) {
      firestoreCreateSetlist(userId, input).then((setlist) => {
        setSetlists(prev => prev.map(s => s.id === tempId ? setlist : s));
      }).catch(() => {
        setSetlists(prev => prev.filter(s => s.id !== tempId));
        onErrorRef.current?.("Can't save — check your internet connection.");
      });
    }
    return tempSetlist;
  }, [isGuest, userId]);

  const updateSetlist = useCallback((id: string, update: SetlistUpdate): Setlist | null => {
    if (isGuest) {
      const setlist = storage.updateSetlist(id, update);
      if (setlist) setSetlists(storage.getSetlists());
      return setlist;
    }

    let updated: Setlist | null = null;
    setSetlists(prev => prev.map(s => {
      if (s.id === id) {
        updated = { ...s, ...update, updatedAt: new Date().toISOString() };
        return updated;
      }
      return s;
    }));

    if (userId) {
      firestoreUpdateSetlist(userId, id, update).catch(() => {
        onErrorRef.current?.("Can't save — check your internet connection.");
        firestoreGetSetlists(userId).then(setSetlists).catch(() => {});
      });
    }
    return updated;
  }, [isGuest, userId]);

  const deleteSetlist = useCallback((id: string): boolean => {
    if (isGuest) {
      const result = storage.deleteSetlist(id);
      if (result) setSetlists(storage.getSetlists());
      return result;
    }

    setSetlists(prev => prev.filter(s => s.id !== id));

    if (userId) {
      firestoreDeleteSetlist(userId, id).catch(() => {
        onErrorRef.current?.("Can't save — check your internet connection.");
        firestoreGetSetlists(userId).then(setSetlists).catch(() => {});
      });
    }
    return true;
  }, [isGuest, userId]);

  const getSetlist = useCallback((id: string): Setlist | null => {
    return setlists.find(s => s.id === id) || null;
  }, [setlists]);

  const addSongToSetlist = useCallback((setlistId: string, songId: string): Setlist | null => {
    const setlist = setlists.find(s => s.id === setlistId);
    if (!setlist || setlist.songIds.includes(songId)) return setlist || null;

    const update = { songIds: [...setlist.songIds, songId] };

    if (isGuest) {
      const result = storage.updateSetlist(setlistId, update);
      if (result) setSetlists(storage.getSetlists());
      return result;
    }

    const updated: Setlist = { ...setlist, ...update, updatedAt: new Date().toISOString() };
    setSetlists(prev => prev.map(s => s.id === setlistId ? updated : s));

    if (userId) {
      firestoreUpdateSetlist(userId, setlistId, update).catch(() => {
        onErrorRef.current?.("Can't save — check your internet connection.");
        firestoreGetSetlists(userId).then(setSetlists).catch(() => {});
      });
    }
    return updated;
  }, [setlists, isGuest, userId]);

  const removeSongFromSetlist = useCallback((setlistId: string, songId: string): Setlist | null => {
    const setlist = setlists.find(s => s.id === setlistId);
    if (!setlist) return null;

    const update = { songIds: setlist.songIds.filter((id) => id !== songId) };

    if (isGuest) {
      const result = storage.updateSetlist(setlistId, update);
      if (result) setSetlists(storage.getSetlists());
      return result;
    }

    const updated: Setlist = { ...setlist, ...update, updatedAt: new Date().toISOString() };
    setSetlists(prev => prev.map(s => s.id === setlistId ? updated : s));

    if (userId) {
      firestoreUpdateSetlist(userId, setlistId, update).catch(() => {
        onErrorRef.current?.("Can't save — check your internet connection.");
        firestoreGetSetlists(userId).then(setSetlists).catch(() => {});
      });
    }
    return updated;
  }, [setlists, isGuest, userId]);

  const reorderSongs = useCallback((setlistId: string, songIds: string[]): Setlist | null => {
    const update = { songIds };

    if (isGuest) {
      const result = storage.updateSetlist(setlistId, update);
      if (result) setSetlists(storage.getSetlists());
      return result;
    }

    const setlist = setlists.find(s => s.id === setlistId);
    if (!setlist) return null;

    const updated: Setlist = { ...setlist, ...update, updatedAt: new Date().toISOString() };
    setSetlists(prev => prev.map(s => s.id === setlistId ? updated : s));

    if (userId) {
      firestoreUpdateSetlist(userId, setlistId, update).catch(() => {
        onErrorRef.current?.("Can't save — check your internet connection.");
        firestoreGetSetlists(userId).then(setSetlists).catch(() => {});
      });
    }
    return updated;
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
