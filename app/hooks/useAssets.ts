'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Asset, AssetInput, AssetUpdate } from '../types';
import { storage } from '../lib/storage';
import { useAuth } from './useAuth';
import {
  firestoreGetAssets,
  firestoreCreateAsset,
  firestoreUpdateAsset,
  firestoreDeleteAsset,
} from '../lib/firestore';

export interface UseAssetsReturn {
  assets: Asset[];
  isLoading: boolean;
  createAsset: (input: AssetInput) => Promise<Asset | null>;
  updateAsset: (id: string, update: AssetUpdate) => Promise<void>;
  deleteAsset: (id: string) => Promise<void>;
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

  const createAsset = useCallback(async (input: AssetInput): Promise<Asset | null> => {
    if (isGuest) {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const asset: Asset = { ...input, id, createdAt: now, updatedAt: now };
      storage.createAsset(asset);
      setAssets(storage.getAssets());
      return asset;
    }

    if (!userId) return null;

    try {
      const asset = await firestoreCreateAsset(userId, input);
      setAssets(prev => [...prev, asset]);
      return asset;
    } catch {
      onErrorRef.current?.("Can't save — check your internet connection.");
      return null;
    }
  }, [isGuest, userId]);

  const updateAsset = useCallback(async (id: string, update: AssetUpdate): Promise<void> => {
    if (isGuest) {
      storage.updateAsset(id, update);
      setAssets(storage.getAssets());
      return;
    }

    if (!userId) return;

    try {
      await firestoreUpdateAsset(userId, id, update);
      setAssets(prev => prev.map(a =>
        a.id === id ? { ...a, ...update, updatedAt: new Date().toISOString() } : a
      ));
    } catch {
      onErrorRef.current?.("Can't save — check your internet connection.");
    }
  }, [isGuest, userId]);

  const deleteAsset = useCallback(async (id: string): Promise<void> => {
    if (isGuest) {
      storage.deleteAsset(id);
      setAssets(storage.getAssets());
      return;
    }

    if (!userId) return;

    try {
      await firestoreDeleteAsset(userId, id);
      setAssets(prev => prev.filter(a => a.id !== id));
    } catch {
      onErrorRef.current?.("Can't save — check your internet connection.");
    }
  }, [isGuest, userId]);

  const assetMap = useMemo(() => new Map(assets.map(a => [a.id, a])), [assets]);
  const getAssetById = useCallback((id: string): Asset | undefined => {
    return assetMap.get(id);
  }, [assetMap]);

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
