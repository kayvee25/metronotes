import { Attachment, Asset, AssetInput, Song } from '../types';
import {
  firestoreGetAttachments,
  firestoreCreateAsset,
  firestoreUpdateAttachment,
} from './firestore';
import { storage } from './storage';

/**
 * Creates an AssetInput from an existing Attachment.
 * Used during migration to extract assets from attachments.
 */
export function assetFromAttachment(attachment: Attachment): AssetInput {
  const name = attachment.name
    || attachment.cloudFileName
    || attachment.fileName
    || `${attachment.type} attachment`;

  switch (attachment.type) {
    case 'richtext':
      return {
        name,
        type: 'richtext',
        mimeType: 'application/json',
        size: null,
        storageUrl: null,
        content: attachment.content,
      };
    case 'drawing':
      return {
        name,
        type: 'drawing',
        mimeType: null,
        size: null,
        storageUrl: null,
        drawingData: attachment.drawingData,
      };
    case 'image':
      return {
        name,
        type: 'image',
        mimeType: attachment.cloudMimeType || 'image/jpeg',
        size: attachment.fileSize || attachment.cloudFileSize || null,
        storageUrl: attachment.storageUrl || null,
      };
    case 'pdf':
      return {
        name,
        type: 'pdf',
        mimeType: 'application/pdf',
        size: attachment.fileSize || attachment.cloudFileSize || null,
        storageUrl: attachment.storageUrl || null,
      };
    case 'audio':
      return {
        name,
        type: 'audio',
        mimeType: attachment.cloudMimeType || 'audio/mpeg',
        size: attachment.fileSize || attachment.cloudFileSize || null,
        storageUrl: attachment.storageUrl || null,
      };
  }
}

/**
 * Migrate existing attachments to assets for authenticated users.
 * Idempotent — skips attachments that already have an assetId.
 */
export async function migrateAttachmentsToAssets(
  userId: string,
  songs: Song[],
  onProgress?: (current: number, total: number) => void,
): Promise<void> {
  // Collect all attachments that need migration
  const toMigrate: { songId: string; attachment: Attachment }[] = [];

  for (const song of songs) {
    const attachments = await firestoreGetAttachments(userId, song.id);
    for (const att of attachments) {
      if (!att.assetId && !att.cloudProvider) {
        toMigrate.push({ songId: song.id, attachment: att });
      }
    }
  }

  if (toMigrate.length === 0) return;

  const total = toMigrate.length;
  let current = 0;

  for (const { songId, attachment } of toMigrate) {
    const assetInput = assetFromAttachment(attachment);
    const asset = await firestoreCreateAsset(userId, assetInput);
    await firestoreUpdateAttachment(userId, songId, attachment.id, { assetId: asset.id });
    current++;
    onProgress?.(current, total);
  }
}

/**
 * Migrate existing guest attachments to assets (localStorage).
 * Idempotent — skips attachments that already have an assetId.
 */
export function migrateGuestAttachmentsToAssets(songs: Song[]): void {
  for (const song of songs) {
    const attachments = storage.getAttachments(song.id);
    for (const att of attachments) {
      if (!att.assetId && !att.cloudProvider) {
        const assetInput = assetFromAttachment(att);
        const now = new Date().toISOString();
        const assetId = crypto.randomUUID();
        const asset: Asset = {
          ...assetInput,
          id: assetId,
          createdAt: now,
          updatedAt: now,
        };
        storage.createAsset(asset);
        storage.updateAttachment(song.id, att.id, { assetId });
      }
    }
  }
}
