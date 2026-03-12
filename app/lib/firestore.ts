'use client';

import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { Song, Setlist, SongInput, SongUpdate, SetlistInput, SetlistUpdate, Attachment, AttachmentInput, AttachmentUpdate, Asset, AssetInput, AssetUpdate, AssetType } from '../types';
import { generateId, getTimestamp } from './utils';
import { STORAGE_KEYS } from './constants';
import { getAllGuestBlobs, clearAllGuestBlobs } from './guest-blob-storage';
import { uploadAttachmentFile, getStoragePath } from './storage-firebase';

// Firestore rejects nested arrays. Stroke.points is Array<[x,y,p]> which is
// an array of arrays. Convert to/from {x,y,p} objects only on known stroke fields.

/** Convert stroke points for Firestore write: [x,y,p] → {x,y,p} */
function transformStrokesForWrite(strokes: unknown[]): unknown[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return strokes.map((stroke: any) => ({
    ...stroke,
    points: stroke.points?.map((p: number[]) => ({ x: p[0], y: p[1], p: p[2] ?? 0.5 })) ?? [],
  }));
}

/** Convert stroke points on Firestore read: {x,y,p} → [x,y,p].
 * Also handles pre-migration data that's already in [x,y,p] array format. */
function transformStrokesForRead(strokes: unknown[]): unknown[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return strokes.map((stroke: any) => ({
    ...stroke,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    points: stroke.points?.map((p: any) => {
      if (Array.isArray(p)) return p; // Already in [x,y,p] format (pre-migration data)
      return [p.x, p.y, p.p ?? 0.5];
    }) ?? [],
  }));
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Apply stroke transforms to known fields before Firestore write */
function prepareForFirestoreWrite(data: Record<string, unknown>): Record<string, unknown> {
  const result = { ...data };
  if (result.drawingData && typeof result.drawingData === 'object') {
    const dd = result.drawingData as any;
    if (dd.strokes) result.drawingData = { ...dd, strokes: transformStrokesForWrite(dd.strokes) };
  }
  if (result.annotations && typeof result.annotations === 'object') {
    const ann = result.annotations as any;
    if (ann.strokes) result.annotations = { ...ann, strokes: transformStrokesForWrite(ann.strokes) };
  }
  if (result.pageAnnotations && typeof result.pageAnnotations === 'object') {
    const pa = result.pageAnnotations as Record<string, any>;
    const transformed: Record<string, any> = {};
    for (const [page, layer] of Object.entries(pa)) {
      transformed[page] = layer.strokes ? { ...layer, strokes: transformStrokesForWrite(layer.strokes) } : layer;
    }
    result.pageAnnotations = transformed;
  }
  return result;
}

/** Restore stroke points from Firestore read data */
function restoreFromFirestoreRead(data: Record<string, unknown>): Record<string, unknown> {
  const result = { ...data };
  if (result.drawingData && typeof result.drawingData === 'object') {
    const dd = result.drawingData as any;
    if (dd.strokes) result.drawingData = { ...dd, strokes: transformStrokesForRead(dd.strokes) };
  }
  if (result.annotations && typeof result.annotations === 'object') {
    const ann = result.annotations as any;
    if (ann.strokes) result.annotations = { ...ann, strokes: transformStrokesForRead(ann.strokes) };
  }
  if (result.pageAnnotations && typeof result.pageAnnotations === 'object') {
    const pa = result.pageAnnotations as Record<string, any>;
    const transformed: Record<string, any> = {};
    for (const [page, layer] of Object.entries(pa)) {
      transformed[page] = layer.strokes ? { ...layer, strokes: transformStrokesForRead(layer.strokes) } : layer;
    }
    result.pageAnnotations = transformed;
  }
  return result;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// Deep-strip undefined values — Firestore rejects them at any depth
function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = stripUndefined(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[key] = value.map(item =>
        item !== null && typeof item === 'object' && !Array.isArray(item)
          ? stripUndefined(item as Record<string, unknown>)
          : item
      );
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

function songsCollection(userId: string) {
  return collection(db, 'users', userId, 'songs');
}

function setlistsCollection(userId: string) {
  return collection(db, 'users', userId, 'setlists');
}

// Songs

export async function firestoreGetSongs(userId: string): Promise<Song[]> {
  const snapshot = await getDocs(songsCollection(userId));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Song));
}

export async function firestoreGetSong(userId: string, songId: string): Promise<Song | null> {
  const snapshot = await getDoc(doc(db, 'users', userId, 'songs', songId));
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as Song;
}

export async function firestoreCreateSong(userId: string, input: SongInput): Promise<Song> {
  const id = generateId();
  const now = getTimestamp();
  const data = stripUndefined({ ...input, createdAt: now, updatedAt: now });
  await setDoc(doc(db, 'users', userId, 'songs', id), data);
  return { ...data, id };
}

export async function firestoreUpdateSong(userId: string, songId: string, update: SongUpdate): Promise<Song | null> {
  const ref = doc(db, 'users', userId, 'songs', songId);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return null;
  // Strip undefined values — Firestore rejects them
  const clean = stripUndefined(update);
  const updatedData = { ...clean, updatedAt: getTimestamp() };
  await updateDoc(ref, updatedData);
  return { id: songId, ...snapshot.data(), ...updatedData } as Song;
}

export async function firestoreDeleteSong(userId: string, songId: string): Promise<boolean> {
  const ref = doc(db, 'users', userId, 'songs', songId);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return false;
  await deleteDoc(ref);

  // Remove from setlists
  const setlistsSnapshot = await getDocs(setlistsCollection(userId));
  for (const setlistDoc of setlistsSnapshot.docs) {
    const data = setlistDoc.data();
    if (data.songIds && data.songIds.includes(songId)) {
      await updateDoc(setlistDoc.ref, {
        songIds: data.songIds.filter((id: string) => id !== songId),
        updatedAt: getTimestamp(),
      });
    }
  }
  return true;
}

// Setlists

export async function firestoreGetSetlists(userId: string): Promise<Setlist[]> {
  const snapshot = await getDocs(setlistsCollection(userId));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Setlist));
}

export async function firestoreGetSetlist(userId: string, setlistId: string): Promise<Setlist | null> {
  const snapshot = await getDoc(doc(db, 'users', userId, 'setlists', setlistId));
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as Setlist;
}

export async function firestoreCreateSetlist(userId: string, input: SetlistInput): Promise<Setlist> {
  const id = generateId();
  const now = getTimestamp();
  const data = stripUndefined({ ...input, createdAt: now, updatedAt: now });
  await setDoc(doc(db, 'users', userId, 'setlists', id), data);
  return { ...data, id };
}

export async function firestoreUpdateSetlist(userId: string, setlistId: string, update: SetlistUpdate): Promise<Setlist | null> {
  const ref = doc(db, 'users', userId, 'setlists', setlistId);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return null;
  const clean = stripUndefined(update);
  const updatedData = { ...clean, updatedAt: getTimestamp() };
  await updateDoc(ref, updatedData);
  return { id: setlistId, ...snapshot.data(), ...updatedData } as Setlist;
}

export async function firestoreDeleteSetlist(userId: string, setlistId: string): Promise<boolean> {
  const ref = doc(db, 'users', userId, 'setlists', setlistId);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return false;
  await deleteDoc(ref);
  return true;
}

// Attachments

function attachmentsCollection(userId: string, songId: string) {
  return collection(db, 'users', userId, 'songs', songId, 'attachments');
}

export async function firestoreGetAttachments(userId: string, songId: string): Promise<Attachment[]> {
  const q = query(attachmentsCollection(userId, songId), orderBy('order'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => restoreFromFirestoreRead({ id: d.id, ...d.data() }) as unknown as Attachment);
}

export async function firestoreCreateAttachment(userId: string, songId: string, input: AttachmentInput): Promise<Attachment> {
  const id = generateId();
  const now = getTimestamp();
  const raw = stripUndefined({ ...input, createdAt: now, updatedAt: now });
  const data = prepareForFirestoreWrite(raw);
  await setDoc(doc(db, 'users', userId, 'songs', songId, 'attachments', id), data);
  return { ...raw, id };
}

export async function firestoreUpdateAttachment(userId: string, songId: string, attachmentId: string, update: AttachmentUpdate): Promise<void> {
  const ref = doc(db, 'users', userId, 'songs', songId, 'attachments', attachmentId);
  const clean = stripUndefined(update);
  const payload = prepareForFirestoreWrite({ ...clean, updatedAt: getTimestamp() });
  await updateDoc(ref, payload);
}

/** Remove assetId field from an attachment doc using Firestore's deleteField() */
export async function firestoreClearAttachmentAssetId(userId: string, songId: string, attachmentId: string): Promise<void> {
  const { deleteField } = await import('firebase/firestore');
  const ref = doc(db, 'users', userId, 'songs', songId, 'attachments', attachmentId);
  await updateDoc(ref, { assetId: deleteField(), updatedAt: getTimestamp() });
}

export async function firestoreDeleteAttachment(userId: string, songId: string, attachmentId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', userId, 'songs', songId, 'attachments', attachmentId));
}

export async function firestoreDeleteAllAttachments(userId: string, songId: string): Promise<void> {
  const snapshot = await getDocs(attachmentsCollection(userId, songId));
  const batch = writeBatch(db);
  snapshot.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

export async function firestoreReorderAttachments(userId: string, songId: string, orderedIds: string[]): Promise<void> {
  const batch = writeBatch(db);
  const now = getTimestamp();
  orderedIds.forEach((id, index) => {
    const ref = doc(db, 'users', userId, 'songs', songId, 'attachments', id);
    batch.update(ref, { order: index, updatedAt: now });
  });
  await batch.commit();
}

// Assets

function assetsCollection(userId: string) {
  return collection(db, 'users', userId, 'assets');
}

export async function firestoreGetAssets(userId: string): Promise<Asset[]> {
  const snapshot = await getDocs(assetsCollection(userId));
  return snapshot.docs.map((d) => restoreFromFirestoreRead({ id: d.id, ...d.data() }) as unknown as Asset);
}

const VALID_ASSET_TYPES: AssetType[] = ['image', 'pdf', 'audio', 'drawing', 'richtext'];

export async function firestoreCreateAsset(userId: string, input: AssetInput): Promise<Asset> {
  if (!input.name || !input.type) {
    throw new Error('AssetInput requires name and type');
  }
  if (!VALID_ASSET_TYPES.includes(input.type)) {
    throw new Error(`Invalid asset type: ${input.type}`);
  }
  const id = generateId();
  const now = getTimestamp();
  const raw = stripUndefined({
    name: input.name,
    type: input.type,
    mimeType: input.mimeType ?? null,
    size: input.size ?? null,
    storageUrl: input.storageUrl ?? null,
    content: input.content ?? null,
    drawingData: input.drawingData ?? null,
    createdAt: now,
    updatedAt: now,
  });
  const data = prepareForFirestoreWrite(raw);
  await setDoc(doc(db, 'users', userId, 'assets', id), data);
  return { ...raw, id } as Asset;
}

export async function firestoreUpdateAsset(userId: string, assetId: string, update: AssetUpdate): Promise<void> {
  const ref = doc(db, 'users', userId, 'assets', assetId);
  const clean = stripUndefined(update);
  const payload = prepareForFirestoreWrite({ ...clean, updatedAt: getTimestamp() });
  await updateDoc(ref, payload);
}

export async function firestoreDeleteAsset(userId: string, assetId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', userId, 'assets', assetId));
}

// Migration: upload localStorage data to Firestore

export async function migrateLocalToFirestore(
  userId: string,
  onProgress?: (current: number, total: number) => void,
): Promise<void> {
  const songsData = localStorage.getItem(STORAGE_KEYS.SONGS);
  const setlistsData = localStorage.getItem(STORAGE_KEYS.SETLISTS);

  const localSongs: Song[] = songsData ? JSON.parse(songsData) : [];
  const localSetlists: Setlist[] = setlistsData ? JSON.parse(setlistsData) : [];

  // Collect all guest blobs for upload
  const guestBlobs = await getAllGuestBlobs();

  // Count total items for progress
  const totalAttachments = localSongs.reduce((sum, song) => {
    const attData = localStorage.getItem(STORAGE_KEYS.attachments(song.id));
    return sum + (attData ? JSON.parse(attData).length : 0);
  }, 0);
  const assetsForCount = localStorage.getItem(STORAGE_KEYS.ASSETS);
  const localAssetsCount = assetsForCount ? JSON.parse(assetsForCount).length : 0;
  const total = localSongs.length + localSetlists.length + totalAttachments + localAssetsCount + guestBlobs.length;
  let current = 0;

  // Upload songs preserving IDs
  for (const song of localSongs) {
    const { id, ...data } = song;
    await setDoc(doc(db, 'users', userId, 'songs', id), data);
    current++;
    onProgress?.(current, total);
  }

  // Upload setlists preserving IDs
  for (const setlist of localSetlists) {
    const { id, ...data } = setlist;
    await setDoc(doc(db, 'users', userId, 'setlists', id), data);
    current++;
    onProgress?.(current, total);
  }

  // Upload attachments metadata for each song
  for (const song of localSongs) {
    const attKey = STORAGE_KEYS.attachments(song.id);
    const attData = localStorage.getItem(attKey);
    if (attData) {
      const attachments: Attachment[] = JSON.parse(attData);
      for (const att of attachments) {
        const { id, ...data } = att;
        await setDoc(doc(db, 'users', userId, 'songs', song.id, 'attachments', id), prepareForFirestoreWrite(stripUndefined(data)));
        current++;
        onProgress?.(current, total);
      }
      localStorage.removeItem(attKey);
    }
  }

  // Upload assets preserving IDs
  const assetsData = localStorage.getItem(STORAGE_KEYS.ASSETS);
  const localAssets: Asset[] = assetsData ? JSON.parse(assetsData) : [];
  for (const asset of localAssets) {
    const { id, ...data } = asset;
    await setDoc(doc(db, 'users', userId, 'assets', id), prepareForFirestoreWrite(stripUndefined(data)));
    current++;
    onProgress?.(current, total);
  }

  // Upload guest blobs to Firebase Storage and update attachment docs
  for (const { songId, attachmentId, blob } of guestBlobs) {
    try {
      const contentType = blob.type || 'application/octet-stream';
      const downloadUrl = await uploadAttachmentFile(userId, songId, attachmentId, blob, contentType);
      const storagePath = getStoragePath(userId, songId, attachmentId);
      // Update the attachment doc with the storage URL
      const attRef = doc(db, 'users', userId, 'songs', songId, 'attachments', attachmentId);
      await updateDoc(attRef, { storageUrl: downloadUrl, storagePath });
    } catch {
      // Skip failed blob uploads — user can re-upload later
    }
    current++;
    onProgress?.(current, total);
  }

  // Clear all local data
  localStorage.removeItem(STORAGE_KEYS.SONGS);
  localStorage.removeItem(STORAGE_KEYS.SETLISTS);
  localStorage.removeItem(STORAGE_KEYS.ASSETS);
  await clearAllGuestBlobs();
}
