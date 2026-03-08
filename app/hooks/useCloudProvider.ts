'use client';

import { useState, useCallback } from 'react';
import type { CloudProviderId, CloudFileResult } from '../lib/cloud-providers/types';
import { getProvider } from '../lib/cloud-providers';

export function useCloudProvider(providerId: CloudProviderId) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const provider = getProvider(providerId);
  const isAvailable = !!provider;
  const isAuthorized = provider?.isAuthorized() ?? false;

  const requestAccess = useCallback(async () => {
    if (!provider) return;
    setIsLoading(true);
    setError(null);
    try {
      await provider.requestAccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to connect';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [provider]);

  const openPicker = useCallback(async (mimeTypes: string[]): Promise<CloudFileResult | null> => {
    if (!provider) return null;
    setIsLoading(true);
    setError(null);
    try {
      const result = await provider.openPicker(mimeTypes);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to open file picker';
      setError(msg);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [provider]);

  return {
    provider,
    isAvailable,
    isAuthorized,
    isLoading,
    requestAccess,
    openPicker,
    error,
  };
}
