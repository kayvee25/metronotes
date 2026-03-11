'use client';

import { useState, useEffect } from 'react';
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

  useEffect(() => {
    if (authState !== 'guest' && authState !== 'authenticated') return;

    let cancelled = false;

    async function scan() {
      const map: AssetLinkageMap = {};

      const addToMap = (assetId: string, songId: string, songName: string) => {
        if (!map[assetId]) map[assetId] = [];
        if (!map[assetId].some(l => l.songId === songId)) {
          map[assetId].push({ songId, songName });
        }
      };

      if (isGuest) {
        for (const song of songs) {
          const attachments = storage.getAttachments(song.id);
          for (const att of attachments) {
            if (att.assetId) addToMap(att.assetId, song.id, song.name);
          }
        }
      } else if (userId) {
        const results = await Promise.all(
          songs.map(song =>
            firestoreGetAttachments(userId, song.id).then(atts => ({ song, atts }))
          )
        );
        for (const { song, atts } of results) {
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
  }, [authState, isGuest, userId, songs, version]);

  const refresh = () => setVersion(v => v + 1);

  return { linkage, refresh };
}
