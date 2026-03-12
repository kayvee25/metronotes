'use client';

import { useState, useEffect, useMemo } from 'react';
import { Song } from '../types';
import { storage } from '../lib/storage';
import { useAuth } from './useAuth';
import { firestoreGetAttachments } from '../lib/firestore';

export interface LinkedSong {
  songId: string;
  songName: string;
}

/** Maps assetId → list of songs that reference it via attachments */
export type AssetLinkageMap = Record<string, LinkedSong[]>;

export function useAssetLinkage(songs: Song[]): { linkage: AssetLinkageMap; refresh: () => void } {
  const { user, authState } = useAuth();
  const isGuest = authState === 'guest';
  const userId = user?.uid;
  const [linkage, setLinkage] = useState<AssetLinkageMap>({});
  const [version, setVersion] = useState(0);

  // Stabilize songs reference — only rescan when song IDs actually change
  const songIdsKey = useMemo(() => songs.map(s => s.id).sort().join(','), [songs]);
  // Snapshot songs for the effect to use — memoized on songIdsKey
  const stableSongs = useMemo(() => songs, [songIdsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (authState !== 'guest' && authState !== 'authenticated') return;

    let cancelled = false;
    const currentSongs = stableSongs;

    async function scan() {
      const map: AssetLinkageMap = {};

      const addToMap = (assetId: string, songId: string, songName: string) => {
        if (!map[assetId]) map[assetId] = [];
        if (!map[assetId].some(l => l.songId === songId)) {
          map[assetId].push({ songId, songName });
        }
      };

      if (isGuest) {
        for (const song of currentSongs) {
          const attachments = storage.getAttachments(song.id);
          for (const att of attachments) {
            if (att.assetId) addToMap(att.assetId, song.id, song.name);
          }
        }
      } else if (userId) {
        const results = await Promise.allSettled(
          currentSongs.map(song =>
            firestoreGetAttachments(userId, song.id).then(atts => ({ song, atts }))
          )
        );
        for (const result of results) {
          if (result.status !== 'fulfilled') continue;
          const { song, atts } = result.value;
          for (const att of atts) {
            if (att.assetId) addToMap(att.assetId, song.id, song.name);
          }
        }
      }

      if (!cancelled) setLinkage(map);
    }

    scan().catch(() => {
      // Linkage is supplementary info — silently fail
    });
    return () => { cancelled = true; };
  }, [authState, isGuest, userId, stableSongs, version]);

  const refresh = () => setVersion(v => v + 1);

  return { linkage, refresh };
}
