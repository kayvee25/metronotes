'use client';

import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { Song, Setlist, SongInput, SongUpdate, SetlistInput, SetlistUpdate } from '../types';

function generateId(): string {
  return crypto.randomUUID();
}

function getTimestamp(): string {
  return new Date().toISOString();
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

// Migration: upload localStorage data to Firestore

export async function migrateLocalToFirestore(userId: string): Promise<void> {
  const SONGS_KEY = 'metronotes_songs';
  const SETLISTS_KEY = 'metronotes_setlists';

  const songsData = localStorage.getItem(SONGS_KEY);
  const setlistsData = localStorage.getItem(SETLISTS_KEY);

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

  // Clear localStorage
  localStorage.removeItem(SONGS_KEY);
  localStorage.removeItem(SETLISTS_KEY);
}
