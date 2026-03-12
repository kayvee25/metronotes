import { Song, Setlist, SongInput, SongUpdate, SetlistInput, SetlistUpdate, Attachment, AttachmentInput, AttachmentUpdate, Asset, AssetUpdate } from '../types';
import { generateId, getTimestamp } from './utils';
import { STORAGE_KEYS } from './constants';

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

  // Attachments
  getAttachments(songId: string): Attachment[];
  createAttachment(songId: string, input: AttachmentInput): Attachment;
  updateAttachment(songId: string, attachmentId: string, update: AttachmentUpdate): Attachment | null;
  deleteAttachment(songId: string, attachmentId: string): boolean;
  deleteAllAttachments(songId: string): void;
  reorderAttachments(songId: string, orderedIds: string[]): void;

  // Assets
  getAssets(): Asset[];
  createAsset(asset: Asset): void;
  updateAsset(id: string, update: AssetUpdate): void;
  deleteAsset(id: string): void;
}

class LocalStorageAdapter implements StorageAdapter {
  private isClient = typeof window !== 'undefined';

  // Songs
  getSongs(): Song[] {
    if (!this.isClient) return [];
    const data = localStorage.getItem(STORAGE_KEYS.SONGS);
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
    localStorage.setItem(STORAGE_KEYS.SONGS, JSON.stringify(songs));
  }

  // Setlists
  getSetlists(): Setlist[] {
    if (!this.isClient) return [];
    const data = localStorage.getItem(STORAGE_KEYS.SETLISTS);
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
    localStorage.setItem(STORAGE_KEYS.SETLISTS, JSON.stringify(setlists));
  }

  // Attachments
  private attachmentsKey(songId: string): string {
    return STORAGE_KEYS.attachments(songId);
  }

  getAttachments(songId: string): Attachment[] {
    if (!this.isClient) return [];
    const data = localStorage.getItem(this.attachmentsKey(songId));
    const attachments: Attachment[] = data ? JSON.parse(data) : [];
    return attachments.sort((a, b) => a.order - b.order);
  }

  createAttachment(songId: string, input: AttachmentInput): Attachment {
    const attachments = this.getAttachments(songId);
    const now = getTimestamp();
    const attachment: Attachment = {
      ...input,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };
    attachments.push(attachment);
    this.saveAttachments(songId, attachments);
    return attachment;
  }

  updateAttachment(songId: string, attachmentId: string, update: AttachmentUpdate): Attachment | null {
    const attachments = this.getAttachments(songId);
    const index = attachments.findIndex((a) => a.id === attachmentId);
    if (index === -1) return null;
    const updated: Attachment = {
      ...attachments[index],
      ...update,
      updatedAt: getTimestamp(),
    };
    attachments[index] = updated;
    this.saveAttachments(songId, attachments);
    return updated;
  }

  deleteAttachment(songId: string, attachmentId: string): boolean {
    const attachments = this.getAttachments(songId);
    const filtered = attachments.filter((a) => a.id !== attachmentId);
    if (filtered.length === attachments.length) return false;
    this.saveAttachments(songId, filtered);
    return true;
  }

  deleteAllAttachments(songId: string): void {
    if (!this.isClient) return;
    localStorage.removeItem(this.attachmentsKey(songId));
  }

  reorderAttachments(songId: string, orderedIds: string[]): void {
    const attachments = this.getAttachments(songId);
    const now = getTimestamp();
    const reordered = orderedIds
      .map((id, index) => {
        const att = attachments.find((a) => a.id === id);
        if (!att) return null;
        return { ...att, order: index, updatedAt: now };
      })
      .filter((a): a is Attachment => a !== null);
    this.saveAttachments(songId, reordered);
  }

  private saveAttachments(songId: string, attachments: Attachment[]): void {
    if (!this.isClient) return;
    localStorage.setItem(this.attachmentsKey(songId), JSON.stringify(attachments));
  }

  // Assets
  getAssets(): Asset[] {
    if (!this.isClient) return [];
    const data = localStorage.getItem(STORAGE_KEYS.ASSETS);
    return data ? JSON.parse(data) : [];
  }

  createAsset(asset: Asset): void {
    const assets = this.getAssets();
    assets.push(asset);
    this.saveAssets(assets);
  }

  updateAsset(id: string, update: AssetUpdate): void {
    const assets = this.getAssets();
    const index = assets.findIndex((a) => a.id === id);
    if (index === -1) return;
    assets[index] = { ...assets[index], ...update, updatedAt: getTimestamp() };
    this.saveAssets(assets);
  }

  deleteAsset(id: string): void {
    const assets = this.getAssets();
    const filtered = assets.filter((a) => a.id !== id);
    this.saveAssets(filtered);
  }

  private saveAssets(assets: Asset[]): void {
    if (!this.isClient) return;
    localStorage.setItem(STORAGE_KEYS.ASSETS, JSON.stringify(assets));
  }
}

// Export singleton instance
export const storage: StorageAdapter = new LocalStorageAdapter();
