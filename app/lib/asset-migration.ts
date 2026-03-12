import { Attachment, Asset, AssetInput, Song } from '../types';
import {
  firestoreGetAttachments,
  firestoreCreateAsset,
  firestoreUpdateAttachment,
} from './firestore';
import { storage } from './storage';
import { generateId } from './utils';

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
    default: {
      const _exhaustive: never = attachment.type;
      throw new Error(`Unknown attachment type: ${_exhaustive}`);
    }
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
  // Collect all attachments that need migration (parallel fetch)
  const allAttachments = await Promise.all(
    songs.map(song =>
      firestoreGetAttachments(userId, song.id).then(atts => ({ songId: song.id, atts }))
    )
  );
  const toMigrate = allAttachments.flatMap(({ songId, atts }) =>
    atts.filter(att => !att.assetId && !att.cloudProvider).map(att => ({ songId, attachment: att }))
  );

  if (toMigrate.length === 0) return;

  const total = toMigrate.length;
  let current = 0;

  for (const { songId, attachment } of toMigrate) {
    try {
      const assetInput = assetFromAttachment(attachment);
      const asset = await firestoreCreateAsset(userId, assetInput);
      await firestoreUpdateAttachment(userId, songId, attachment.id, { assetId: asset.id });
    } catch {
      // Skip failed items — migration is idempotent, will retry next load
    }
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
        const assetId = generateId();
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
