import { Song, Setlist, SongInput, SongUpdate, SetlistInput, SetlistUpdate } from '../types';

export interface StorageAdapter {
  // Songs
  getSongs(): Song[];
  getSong(id: string): Song | null;
  createSong(input: SongInput): Song;
  updateSong(id: string, update: SongUpdate): Song | null;
  deleteSong(id: string): boolean;

  // Setlists
  getSetlists(): Setlist[];
  getSetlist(id: string): Setlist | null;
  createSetlist(input: SetlistInput): Setlist;
  updateSetlist(id: string, update: SetlistUpdate): Setlist | null;
  deleteSetlist(id: string): boolean;
}

const SONGS_KEY = 'metronotes_songs';
const SETLISTS_KEY = 'metronotes_setlists';

function generateId(): string {
  return crypto.randomUUID();
}

function getTimestamp(): string {
  return new Date().toISOString();
}

class LocalStorageAdapter implements StorageAdapter {
  private isClient = typeof window !== 'undefined';

  // Songs
  getSongs(): Song[] {
    if (!this.isClient) return [];
    const data = localStorage.getItem(SONGS_KEY);
    return data ? JSON.parse(data) : [];
  }

  getSong(id: string): Song | null {
    const songs = this.getSongs();
    return songs.find((s) => s.id === id) || null;
  }

  createSong(input: SongInput): Song {
    const songs = this.getSongs();
    const now = getTimestamp();
    const song: Song = {
      ...input,
      id: generateId(),
      createdAt: now,
      updatedAt: now
    };
    songs.push(song);
    this.saveSongs(songs);
    return song;
  }

  updateSong(id: string, update: SongUpdate): Song | null {
    const songs = this.getSongs();
    const index = songs.findIndex((s) => s.id === id);
    if (index === -1) return null;

    const updated: Song = {
      ...songs[index],
      ...update,
      updatedAt: getTimestamp()
    };
    songs[index] = updated;
    this.saveSongs(songs);
    return updated;
  }

  deleteSong(id: string): boolean {
    const songs = this.getSongs();
    const filtered = songs.filter((s) => s.id !== id);
    if (filtered.length === songs.length) return false;
    this.saveSongs(filtered);

    // Also remove from any setlists
    const setlists = this.getSetlists();
    setlists.forEach((setlist) => {
      if (setlist.songIds.includes(id)) {
        this.updateSetlist(setlist.id, {
          songIds: setlist.songIds.filter((sid) => sid !== id)
        });
      }
    });

    return true;
  }

  private saveSongs(songs: Song[]): void {
    if (!this.isClient) return;
    localStorage.setItem(SONGS_KEY, JSON.stringify(songs));
  }

  // Setlists
  getSetlists(): Setlist[] {
    if (!this.isClient) return [];
    const data = localStorage.getItem(SETLISTS_KEY);
    return data ? JSON.parse(data) : [];
  }

  getSetlist(id: string): Setlist | null {
    const setlists = this.getSetlists();
    return setlists.find((s) => s.id === id) || null;
  }

  createSetlist(input: SetlistInput): Setlist {
    const setlists = this.getSetlists();
    const now = getTimestamp();
    const setlist: Setlist = {
      ...input,
      id: generateId(),
      createdAt: now,
      updatedAt: now
    };
    setlists.push(setlist);
    this.saveSetlists(setlists);
    return setlist;
  }

  updateSetlist(id: string, update: SetlistUpdate): Setlist | null {
    const setlists = this.getSetlists();
    const index = setlists.findIndex((s) => s.id === id);
    if (index === -1) return null;

    const updated: Setlist = {
      ...setlists[index],
      ...update,
      updatedAt: getTimestamp()
    };
    setlists[index] = updated;
    this.saveSetlists(setlists);
    return updated;
  }

  deleteSetlist(id: string): boolean {
    const setlists = this.getSetlists();
    const filtered = setlists.filter((s) => s.id !== id);
    if (filtered.length === setlists.length) return false;
    this.saveSetlists(filtered);
    return true;
  }

  private saveSetlists(setlists: Setlist[]): void {
    if (!this.isClient) return;
    localStorage.setItem(SETLISTS_KEY, JSON.stringify(setlists));
  }
}

// Export singleton instance
export const storage: StorageAdapter = new LocalStorageAdapter();
