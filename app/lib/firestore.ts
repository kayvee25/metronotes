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
import { Song, Setlist, SongInput, SongUpdate, SetlistInput, SetlistUpdate, Attachment, AttachmentInput, AttachmentUpdate } from '../types';
import { generateId, getTimestamp } from './utils';
import { STORAGE_KEYS } from './constants';

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
  const data = { ...input, createdAt: now, updatedAt: now };
  await setDoc(doc(db, 'users', userId, 'songs', id), data);
  return { ...data, id };
}

export async function firestoreUpdateSong(userId: string, songId: string, update: SongUpdate): Promise<Song | null> {
  const ref = doc(db, 'users', userId, 'songs', songId);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return null;
  const updatedData = { ...update, updatedAt: getTimestamp() };
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
  const data = { ...input, createdAt: now, updatedAt: now };
  await setDoc(doc(db, 'users', userId, 'setlists', id), data);
  return { ...data, id };
}

export async function firestoreUpdateSetlist(userId: string, setlistId: string, update: SetlistUpdate): Promise<Setlist | null> {
  const ref = doc(db, 'users', userId, 'setlists', setlistId);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return null;
  const updatedData = { ...update, updatedAt: getTimestamp() };
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
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Attachment));
}

export async function firestoreCreateAttachment(userId: string, songId: string, input: AttachmentInput): Promise<Attachment> {
  const id = generateId();
  const now = getTimestamp();
  const data = { ...input, createdAt: now, updatedAt: now };
  await setDoc(doc(db, 'users', userId, 'songs', songId, 'attachments', id), data);
  return { ...data, id };
}

export async function firestoreUpdateAttachment(userId: string, songId: string, attachmentId: string, update: AttachmentUpdate): Promise<void> {
  const ref = doc(db, 'users', userId, 'songs', songId, 'attachments', attachmentId);
  await updateDoc(ref, { ...update, updatedAt: getTimestamp() });
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

// Migration: upload localStorage data to Firestore

export async function migrateLocalToFirestore(userId: string): Promise<void> {
  const songsData = localStorage.getItem(STORAGE_KEYS.SONGS);
  const setlistsData = localStorage.getItem(STORAGE_KEYS.SETLISTS);

  const localSongs: Song[] = songsData ? JSON.parse(songsData) : [];
  const localSetlists: Setlist[] = setlistsData ? JSON.parse(setlistsData) : [];

  // Upload songs preserving IDs
  for (const song of localSongs) {
    const { id, ...data } = song;
    await setDoc(doc(db, 'users', userId, 'songs', id), data);
  }

  // Upload setlists preserving IDs
  for (const setlist of localSetlists) {
    const { id, ...data } = setlist;
    await setDoc(doc(db, 'users', userId, 'setlists', id), data);
  }

  // Upload attachments for each song
  for (const song of localSongs) {
    const attKey = STORAGE_KEYS.attachments(song.id);
    const attData = localStorage.getItem(attKey);
    if (attData) {
      const attachments: Attachment[] = JSON.parse(attData);
      for (const att of attachments) {
        const { id, ...data } = att;
        await setDoc(doc(db, 'users', userId, 'songs', song.id, 'attachments', id), data);
      }
      localStorage.removeItem(attKey);
    }
  }

  // Clear localStorage
  localStorage.removeItem(STORAGE_KEYS.SONGS);
  localStorage.removeItem(STORAGE_KEYS.SETLISTS);
}
