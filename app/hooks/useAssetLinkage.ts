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

      if (isGuest) {
        for (const song of songs) {
          const attachments = storage.getAttachments(song.id);
          for (const att of attachments) {
            if (att.assetId) {
              if (!map[att.assetId]) map[att.assetId] = [];
              if (!map[att.assetId].some(l => l.songId === song.id)) {
                map[att.assetId].push({ songId: song.id, songName: song.name });
              }
            }
          }
        }
      } else if (userId) {
        for (const song of songs) {
          const attachments = await firestoreGetAttachments(userId, song.id);
          for (const att of attachments) {
            if (att.assetId) {
              if (!map[att.assetId]) map[att.assetId] = [];
              if (!map[att.assetId].some(l => l.songId === song.id)) {
                map[att.assetId].push({ songId: song.id, songName: song.name });
              }
            }
          }
        }
      }

      if (!cancelled) setLinkage(map);
    }

    scan();
    return () => { cancelled = true; };
  }, [authState, isGuest, userId, songs, version]);

  const refresh = () => setVersion(v => v + 1);

  return { linkage, refresh };
}
