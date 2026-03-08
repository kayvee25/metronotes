'use client';

import { AUDIO } from './constants';

export function validateAudioFile(file: File): string | null {
  if (!AUDIO.ACCEPTED_AUDIO_TYPES.includes(file.type)) {
    return 'Only MP3 files are supported';
  }
  if (file.size > AUDIO.MAX_AUDIO_SIZE) {
    return 'File too large (max 10MB)';
  }
  return null;
}

export async function extractAudioDuration(file: File): Promise<number> {
  const arrayBuffer = await file.arrayBuffer();
  const ctx = new AudioContext();
  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    return audioBuffer.duration;
  } finally {
    await ctx.close();
  }
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
