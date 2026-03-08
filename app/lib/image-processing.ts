'use client';

const MAX_DIMENSION = 2048;
const COMPRESS_QUALITY = 0.8;
const MAX_IMAGE_SIZE = 3 * 1024 * 1024; // 3MB
const MAX_PDF_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_SONG_SIZE = 20 * 1024 * 1024; // 20MB per song

export interface ProcessedImage {
  blob: Blob;
  width: number;
  height: number;
}

export function validateFileSize(size: number, type: 'image' | 'pdf' = 'image'): string | null {
  if (type === 'pdf') {
    if (size > MAX_PDF_SIZE) {
      return 'File too large (max 5MB)';
    }
  } else {
    if (size > MAX_IMAGE_SIZE) {
      return 'File too large (max 3MB)';
    }
  }
  return null;
}

export function validateSongStorage(currentTotal: number, newFileSize: number): string | null {
  if (currentTotal + newFileSize > MAX_SONG_SIZE) {
    return 'Song storage limit reached (20MB)';
  }
  return null;
}

export async function compressImage(file: File): Promise<ProcessedImage> {
  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;

  // Scale down if needed
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    const scale = MAX_DIMENSION / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  // Use OffscreenCanvas if available, fall back to regular canvas
  let blob: Blob;
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0, width, height);
    blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: COMPRESS_QUALITY });
  } else {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0, width, height);
    blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Canvas toBlob failed'))),
        'image/jpeg',
        COMPRESS_QUALITY
      );
    });
  }

  bitmap.close();

  // Check compressed size
  const error = validateFileSize(blob.size);
  if (error) {
    throw new Error(error);
  }

  return { blob, width, height };
}
