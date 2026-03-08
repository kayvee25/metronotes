'use client';

import type { CloudProvider, CloudFileResult } from './types';
import { loadGoogleIdentityServices, loadGooglePickerApi } from './google-drive-scripts';

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_PICKER_API_KEY || '';
const APP_ID = CLIENT_ID.split('-')[0]; // GCP project number
const SCOPE = 'https://www.googleapis.com/auth/drive.file';

// Token state — persisted in sessionStorage to survive page reloads
const TOKEN_KEY = 'gdrive_token';
const TOKEN_EXPIRY_KEY = 'gdrive_token_expires';

let accessToken: string | null = null;
let tokenExpiresAt = 0;

// Restore from sessionStorage on module load
try {
  const stored = sessionStorage.getItem(TOKEN_KEY);
  const storedExpiry = sessionStorage.getItem(TOKEN_EXPIRY_KEY);
  if (stored && storedExpiry) {
    const expiry = parseInt(storedExpiry, 10);
    if (Date.now() < expiry) {
      accessToken = stored;
      tokenExpiresAt = expiry;
    } else {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(TOKEN_EXPIRY_KEY);
    }
  }
} catch {
  // sessionStorage not available (SSR, private browsing)
}

function persistToken(token: string, expiresAt: number): void {
  accessToken = token;
  tokenExpiresAt = expiresAt;
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(TOKEN_EXPIRY_KEY, String(expiresAt));
  } catch {
    // Ignore storage errors
  }
}

function isTokenValid(): boolean {
  return !!accessToken && Date.now() < tokenExpiresAt;
}

async function requestToken(prompt: '' | 'consent' = ''): Promise<string> {
  await loadGoogleIdentityServices();

  return new Promise<string>((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error));
          return;
        }
        // Expire 5 minutes early to avoid edge cases
        const expiresAt = Date.now() + (response.expires_in - 300) * 1000;
        persistToken(response.access_token, expiresAt);
        resolve(response.access_token);
      },
      error_callback: (error) => {
        reject(new Error(error.message || 'Google auth failed'));
      },
    });

    client.requestAccessToken({ prompt });
  });
}

export const googleDriveProvider: CloudProvider = {
  id: 'google-drive',
  name: 'Google Drive',
  brandColor: '#4285F4',

  isAuthorized(): boolean {
    return isTokenValid();
  },

  async requestAccess(): Promise<void> {
    await requestToken('consent');
  },

  async getAccessToken(): Promise<string> {
    if (isTokenValid()) return accessToken!;
    // Try silent refresh first, fall back to consent
    try {
      return await requestToken('');
    } catch {
      return await requestToken('consent');
    }
  },

  async getAccessTokenSilent(): Promise<string | null> {
    if (isTokenValid()) return accessToken!;
    return null;
  },

  async openPicker(mimeTypes: string[]): Promise<CloudFileResult | null> {
    const token = await this.getAccessToken();
    await loadGooglePickerApi();

    return new Promise<CloudFileResult | null>((resolve) => {
      const view = new google.picker.DocsView()
        .setIncludeFolders(true)
        .setSelectFolderEnabled(false);

      if (mimeTypes.length > 0) {
        view.setMimeTypes(mimeTypes.join(','));
      }

      const picker = new google.picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(token)
        .setDeveloperKey(API_KEY)
        .setAppId(APP_ID)
        .setOrigin(window.location.origin)
        .setCallback((data: google.picker.PickerCallbackData) => {
          if (data.action === google.picker.Action.PICKED && data.docs[0]) {
            const doc = data.docs[0];
            resolve({
              providerId: 'google-drive',
              fileId: doc.id,
              fileName: doc.name,
              mimeType: doc.mimeType,
              fileSize: doc.sizeBytes || 0,
              webViewLink: doc.url,
              thumbnailLink: doc.thumbnails?.[0]?.url,
            });
          } else if (data.action === google.picker.Action.CANCEL) {
            resolve(null);
          }
        })
        .build();

      picker.setVisible(true);
    });
  },

  async fetchFile(fileId: string): Promise<Blob> {
    const token = await this.getAccessToken();
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!response.ok) {
      // Try to get error details from response body
      let detail = '';
      try {
        const body = await response.json();
        detail = body?.error?.message || '';
      } catch { /* ignore */ }
      console.warn(`[Google Drive] fetchFile ${fileId} failed: ${response.status} ${detail}`);
      if (response.status === 404) throw new Error('File not found in Drive');
      if (response.status === 401 || response.status === 403) throw new Error('Drive access denied — re-connect your account');
      throw new Error(`Drive download failed (${response.status})`);
    }
    return response.blob();
  },
};
