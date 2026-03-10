import { Attachment, AssetInput } from '../types';

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
