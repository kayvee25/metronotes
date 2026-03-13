import { Attachment, Asset, AssetInput, Song } from '../types';
import {
  firestoreGetAttachments,
  firestoreGetAssets,
  firestoreCreateAsset,
  firestoreUpdateAsset,
  firestoreUpdateAttachment,
} from './firestore';
import { storage } from './storage';
import { generateId } from './utils';
import { getStoragePath } from './storage-firebase';

/** Legacy attachment fields that may exist in Firestore but are no longer in the TS type */
interface LegacyAttachmentFields {
  storagePath?: string;
}

/**
 * Creates an AssetInput from an existing Attachment.
 * Used during migration to extract assets from attachments.
 */
export function assetFromAttachment(attachment: Attachment & LegacyAttachmentFields): AssetInput {
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
        storagePath: null,
        content: attachment.content,
      };
    case 'drawing':
      return {
        name,
        type: 'drawing',
        mimeType: null,
        size: null,
        storageUrl: null,
        storagePath: null,
        drawingData: attachment.drawingData,
      };
    case 'image':
      return {
        name,
        type: 'image',
        mimeType: attachment.cloudMimeType || 'image/jpeg',
        size: attachment.fileSize || attachment.cloudFileSize || null,
        storageUrl: attachment.storageUrl || null,
        storagePath: attachment.storagePath || null,
      };
    case 'pdf':
      return {
        name,
        type: 'pdf',
        mimeType: 'application/pdf',
        size: attachment.fileSize || attachment.cloudFileSize || null,
        storageUrl: attachment.storageUrl || null,
        storagePath: attachment.storagePath || null,
      };
    case 'audio':
      return {
        name,
        type: 'audio',
        mimeType: attachment.cloudMimeType || 'audio/mpeg',
        size: attachment.fileSize || attachment.cloudFileSize || null,
        storageUrl: attachment.storageUrl || null,
        storagePath: attachment.storagePath || null,
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
      // Derive storagePath if missing (for binary assets uploaded before migration)
      if (!assetInput.storagePath && ['image', 'pdf', 'audio'].includes(assetInput.type)) {
        assetInput.storagePath = getStoragePath(userId, songId, attachment.id);
      }
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

/**
 * Patch existing assets that have storageUrl but no storagePath.
 * Derives storagePath from the linked attachment's userId/songId/attachmentId.
 * Idempotent — skips assets that already have storagePath.
 */
export async function migrateAssetStoragePaths(
  userId: string,
  songs: Song[],
): Promise<void> {
  const assets = await firestoreGetAssets(userId);
  const needsPatch = assets.filter(
    a => a.storageUrl && !a.storagePath && ['image', 'pdf', 'audio'].includes(a.type)
  );
  if (needsPatch.length === 0) return;

  // Build assetId → { songId, attachmentId } lookup
  const assetToAttachment = new Map<string, { songId: string; attachmentId: string }>();
  const allAttachments = await Promise.all(
    songs.map(song =>
      firestoreGetAttachments(userId, song.id).then(atts => ({ songId: song.id, atts }))
    )
  );
  for (const { songId, atts } of allAttachments) {
    for (const att of atts) {
      if (att.assetId) {
        assetToAttachment.set(att.assetId, { songId, attachmentId: att.id });
      }
    }
  }

  for (const asset of needsPatch) {
    const link = assetToAttachment.get(asset.id);
    if (!link) continue;
    const storagePath = getStoragePath(userId, link.songId, link.attachmentId);
    try {
      await firestoreUpdateAsset(userId, asset.id, { storagePath });
    } catch {
      // Non-critical — will retry next load
    }
  }
}
