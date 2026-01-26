'use client';

import { useState, useEffect, useCallback } from 'react';
import { Song, SongInput, SongUpdate } from '../types';
import { storage } from '../lib/storage';

export function useSongs() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load songs on mount
  useEffect(() => {
    setSongs(storage.getSongs());
    setIsLoading(false);
  }, []);

  const createSong = useCallback((input: SongInput): Song => {
    const song = storage.createSong(input);
    setSongs(storage.getSongs());
    return song;
  }, []);

  const updateSong = useCallback((id: string, update: SongUpdate): Song | null => {
    const song = storage.updateSong(id, update);
    if (song) {
      setSongs(storage.getSongs());
    }
    return song;
  }, []);

  const deleteSong = useCallback((id: string): boolean => {
    const result = storage.deleteSong(id);
    if (result) {
      setSongs(storage.getSongs());
    }
    return result;
  }, []);

  const getSong = useCallback((id: string): Song | null => {
    return storage.getSong(id);
  }, []);

  return {
    songs,
    isLoading,
    createSong,
    updateSong,
    deleteSong,
    getSong
  };
}
