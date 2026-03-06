'use client';

import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { firebaseStorage } from './firebase';

function attachmentRef(userId: string, songId: string, attachmentId: string) {
  return ref(firebaseStorage, `users/${userId}/songs/${songId}/${attachmentId}`);
}

export async function uploadAttachmentFile(
  userId: string,
  songId: string,
  attachmentId: string,
  file: Blob,
  contentType = 'image/jpeg'
): Promise<string> {
  const storageRef = attachmentRef(userId, songId, attachmentId);
  await uploadBytes(storageRef, file, { contentType });
  return getDownloadURL(storageRef);
}

export async function deleteAttachmentFile(
  userId: string,
  songId: string,
  attachmentId: string
): Promise<void> {
  const storageRef = attachmentRef(userId, songId, attachmentId);
  try {
    await deleteObject(storageRef);
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === 'storage/object-not-found') return;
    throw err;
  }
}

export function getStoragePath(userId: string, songId: string, attachmentId: string): string {
  return `users/${userId}/songs/${songId}/${attachmentId}`;
}
