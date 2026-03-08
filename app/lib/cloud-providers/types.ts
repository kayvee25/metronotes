import type { Attachment } from '../../types';

export type CloudProviderId = 'google-drive' | 'dropbox' | 'onedrive';

export interface CloudFileResult {
  providerId: CloudProviderId;
  fileId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  webViewLink?: string;
  thumbnailLink?: string;
}

export interface CloudProvider {
  id: CloudProviderId;
  name: string;
  brandColor: string;

  // Auth
  isAuthorized: () => boolean;
  requestAccess: () => Promise<void>;
  getAccessToken: () => Promise<string>;
  getAccessTokenSilent: () => Promise<string | null>;

  // File picking
  openPicker: (mimeTypes: string[]) => Promise<CloudFileResult | null>;

  // File fetching
  fetchFile: (fileId: string) => Promise<Blob>;
}

export function isCloudLinked(att: Attachment): boolean {
  return !!att.cloudProvider && !!att.cloudFileId;
}

export function cloudMimeToAttachmentType(mimeType: string): 'image' | 'pdf' | 'audio' | null {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('audio/')) return 'audio';
  return null;
}
