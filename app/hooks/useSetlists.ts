'use client';

import { useState, useEffect, useCallback } from 'react';
import { Setlist, SetlistInput, SetlistUpdate } from '../types';
import { storage } from '../lib/storage';

export function useSetlists() {
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load setlists on mount
  useEffect(() => {
    setSetlists(storage.getSetlists());
    setIsLoading(false);
  }, []);

  const createSetlist = useCallback((input: SetlistInput): Setlist => {
    const setlist = storage.createSetlist(input);
    setSetlists(storage.getSetlists());
    return setlist;
  }, []);

  const updateSetlist = useCallback((id: string, update: SetlistUpdate): Setlist | null => {
    const setlist = storage.updateSetlist(id, update);
    if (setlist) {
      setSetlists(storage.getSetlists());
    }
    return setlist;
  }, []);

  const deleteSetlist = useCallback((id: string): boolean => {
    const result = storage.deleteSetlist(id);
    if (result) {
      setSetlists(storage.getSetlists());
    }
    return result;
  }, []);

  const getSetlist = useCallback((id: string): Setlist | null => {
    return storage.getSetlist(id);
  }, []);

  const addSongToSetlist = useCallback((setlistId: string, songId: string): Setlist | null => {
    const setlist = storage.getSetlist(setlistId);
    if (!setlist) return null;

    if (setlist.songIds.includes(songId)) {
      return setlist; // Already in setlist
    }

    return storage.updateSetlist(setlistId, {
      songIds: [...setlist.songIds, songId]
    });
  }, []);

  const removeSongFromSetlist = useCallback((setlistId: string, songId: string): Setlist | null => {
    const setlist = storage.getSetlist(setlistId);
    if (!setlist) return null;

    const updated = storage.updateSetlist(setlistId, {
      songIds: setlist.songIds.filter((id) => id !== songId)
    });

    if (updated) {
      setSetlists(storage.getSetlists());
    }
    return updated;
  }, []);

  const reorderSongs = useCallback((setlistId: string, songIds: string[]): Setlist | null => {
    const updated = storage.updateSetlist(setlistId, { songIds });
    if (updated) {
      setSetlists(storage.getSetlists());
    }
    return updated;
  }, []);

  return {
    setlists,
    isLoading,
    createSetlist,
    updateSetlist,
    deleteSetlist,
    getSetlist,
    addSongToSetlist,
    removeSongFromSetlist,
    reorderSongs
  };
}
