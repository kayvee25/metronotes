'use client';

import type { CloudProvider, CloudProviderId } from './types';
import { googleDriveProvider } from './google-drive';

const providers: CloudProvider[] = [
  googleDriveProvider,
];

export function getProvider(id: CloudProviderId): CloudProvider | undefined {
  return providers.find(p => p.id === id);
}

export function getAvailableProviders(): CloudProvider[] {
  return providers;
}
