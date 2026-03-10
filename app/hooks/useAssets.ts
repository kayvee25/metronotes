'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Asset, AssetInput, AssetUpdate } from '../types';
import { storage } from '../lib/storage';
import { useAuth } from './useAuth';
import {
  firestoreGetAssets,
  firestoreCreateAsset,
  firestoreUpdateAsset,
  firestoreDeleteAsset,
} from '../lib/firestore';
import { generateId, getTimestamp } from '../lib/utils';

export interface UseAssetsReturn {
  assets: Asset[];
  isLoading: boolean;
  createAsset: (input: AssetInput) => Asset | null;
  updateAsset: (id: string, update: AssetUpdate) => void;
  deleteAsset: (id: string) => void;
  getAssetById: (id: string) => Asset | undefined;
  refresh: () => void;
}

export function useAssets(onError?: (message: string) => void): UseAssetsReturn {
  const { user, authState } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const isGuest = authState === 'guest';
  const userId = user?.uid;

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      if (isGuest) {
        setAssets(storage.getAssets());
      } else if (userId) {
        const data = await firestoreGetAssets(userId);
        setAssets(data);
      }
    } catch {
      onErrorRef.current?.('Could not load files.');
    } finally {
      setIsLoading(false);
    }
  }, [isGuest, userId]);

  useEffect(() => {
    if (authState === 'guest' || authState === 'authenticated') {
      load();
    }
  }, [authState, load]);

  const createAsset = useCallback((input: AssetInput): Asset | null => {
    const id = generateId();
    const now = getTimestamp();
    const asset: Asset = { ...input, id, createdAt: now, updatedAt: now };

    if (isGuest) {
      storage.createAsset(asset);
      setAssets(storage.getAssets());
      return asset;
    }

    // Optimistic create
    setAssets(prev => [...prev, asset]);

    if (userId) {
      firestoreCreateAsset(userId, input).then((created) => {
        setAssets(prev => prev.map(a => a.id === id ? created : a));
      }).catch(() => {
        setAssets(prev => prev.filter(a => a.id !== id));
        onErrorRef.current?.("Can't save — check your internet connection.");
      });
    }

    return asset;
  }, [isGuest, userId]);

  const updateAsset = useCallback((id: string, update: AssetUpdate) => {
    if (isGuest) {
      storage.updateAsset(id, update);
      setAssets(storage.getAssets());
      return;
    }

    // Optimistic update
    setAssets(prev => prev.map(a =>
      a.id === id ? { ...a, ...update, updatedAt: getTimestamp() } : a
    ));

    if (userId) {
      firestoreUpdateAsset(userId, id, update).catch(() => {
        onErrorRef.current?.("Can't save — check your internet connection.");
        firestoreGetAssets(userId).then(setAssets).catch(() => {});
      });
    }
  }, [isGuest, userId]);

  const deleteAsset = useCallback((id: string) => {
    const previous = assets;

    if (isGuest) {
      storage.deleteAsset(id);
      setAssets(storage.getAssets());
      return;
    }

    // Optimistic delete
    setAssets(prev => prev.filter(a => a.id !== id));

    if (userId) {
      firestoreDeleteAsset(userId, id).catch(() => {
        setAssets(previous);
        onErrorRef.current?.("Can't save — check your internet connection.");
      });
    }
  }, [assets, isGuest, userId]);

  const getAssetById = useCallback((id: string): Asset | undefined => {
    return assets.find(a => a.id === id);
  }, [assets]);

  return {
    assets,
    isLoading,
    createAsset,
    updateAsset,
    deleteAsset,
    getAssetById,
    refresh: load,
  };
}
