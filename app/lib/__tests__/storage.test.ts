import { describe, it, expect, beforeEach, vi } from 'vitest';
import { STORAGE_KEYS } from '../constants';

// Mock generateId and getTimestamp so tests are deterministic
let idCounter = 0;
vi.mock('../utils', () => ({
  generateId: () => `test-id-${++idCounter}`,
  getTimestamp: () => '2026-03-14T00:00:00.000Z',
}));

// Import after mocks are set up
import { storage } from '../storage';
import type { SongInput, SetlistInput, AttachmentInput, Asset } from '../../types';

// ── Helpers ──────────────────────────────────────────────────────────────

function makeSongInput(overrides: Partial<SongInput> = {}): SongInput {
  return {
    name: 'Test Song',
    bpm: 120,
    timeSignature: '4/4',
    ...overrides,
  };
}

function makeSetlistInput(overrides: Partial<SetlistInput> = {}): SetlistInput {
  return {
    name: 'Test Setlist',
    songIds: [],
    ...overrides,
  };
}

function makeAttachmentInput(overrides: Partial<AttachmentInput> = {}): AttachmentInput {
  return {
    type: 'richtext',
    order: 0,
    isDefault: true,
    ...overrides,
  };
}

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: `asset-${++idCounter}`,
    name: 'test-image.png',
    type: 'image',
    mimeType: 'image/png',
    size: 1024,
    storageUrl: 'https://example.com/image.png',
    storagePath: 'users/u1/assets/img.png',
    createdAt: '2026-03-14T00:00:00.000Z',
    updatedAt: '2026-03-14T00:00:00.000Z',
    ...overrides,
  };
}

// ── Setup ────────────────────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear();
  idCounter = 0;
});

// ═════════════════════════════════════════════════════════════════════════
// Songs
// ═════════════════════════════════════════════════════════════════════════

describe('LocalStorageAdapter — Songs', () => {
  it('getSongs returns empty array when localStorage has no data', () => {
    expect(storage.getSongs()).toEqual([]);
  });

  it('createSong persists a song and returns it with id and timestamps', () => {
    const song = storage.createSong(makeSongInput({ name: 'Autumn Leaves' }));

    expect(song.id).toBe('test-id-1');
    expect(song.name).toBe('Autumn Leaves');
    expect(song.bpm).toBe(120);
    expect(song.timeSignature).toBe('4/4');
    expect(song.createdAt).toBe('2026-03-14T00:00:00.000Z');
    expect(song.updatedAt).toBe('2026-03-14T00:00:00.000Z');

    // Verify persisted to localStorage
    const raw = localStorage.getItem(STORAGE_KEYS.SONGS);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].name).toBe('Autumn Leaves');
  });

  it('createSong appends to existing songs', () => {
    storage.createSong(makeSongInput({ name: 'Song A' }));
    storage.createSong(makeSongInput({ name: 'Song B' }));

    const songs = storage.getSongs();
    expect(songs).toHaveLength(2);
    expect(songs[0].name).toBe('Song A');
    expect(songs[1].name).toBe('Song B');
  });

  it('getSong returns the correct song by id', () => {
    const created = storage.createSong(makeSongInput({ name: 'Fly Me' }));
    const found = storage.getSong(created.id);
    expect(found).not.toBeNull();
    expect(found!.name).toBe('Fly Me');
  });

  it('getSong returns null for non-existent id', () => {
    expect(storage.getSong('nonexistent')).toBeNull();
  });

  it('updateSong updates fields and updatedAt', () => {
    const song = storage.createSong(makeSongInput({ name: 'Original', bpm: 100 }));
    const updated = storage.updateSong(song.id, { bpm: 140, key: 'Am' });

    expect(updated).not.toBeNull();
    expect(updated!.bpm).toBe(140);
    expect(updated!.key).toBe('Am');
    expect(updated!.name).toBe('Original'); // unchanged field preserved
    expect(updated!.updatedAt).toBe('2026-03-14T00:00:00.000Z');

    // Verify persisted
    const persisted = storage.getSong(song.id);
    expect(persisted!.bpm).toBe(140);
  });

  it('updateSong returns null for non-existent id', () => {
    expect(storage.updateSong('nonexistent', { bpm: 200 })).toBeNull();
  });

  it('updateSong with empty update still sets updatedAt', () => {
    const song = storage.createSong(makeSongInput());
    const updated = storage.updateSong(song.id, {});
    expect(updated).not.toBeNull();
    expect(updated!.updatedAt).toBe('2026-03-14T00:00:00.000Z');
  });

  it('deleteSong removes the song and returns true', () => {
    const song = storage.createSong(makeSongInput({ name: 'To Delete' }));
    const result = storage.deleteSong(song.id);
    expect(result).toBe(true);
    expect(storage.getSongs()).toHaveLength(0);
    expect(storage.getSong(song.id)).toBeNull();
  });

  it('deleteSong returns false for non-existent id', () => {
    expect(storage.deleteSong('nonexistent')).toBe(false);
  });

  it('deleteSong does not affect other songs', () => {
    const a = storage.createSong(makeSongInput({ name: 'A' }));
    const b = storage.createSong(makeSongInput({ name: 'B' }));
    storage.deleteSong(a.id);
    const songs = storage.getSongs();
    expect(songs).toHaveLength(1);
    expect(songs[0].id).toBe(b.id);
  });

  it('createSong includes optional fields when provided', () => {
    const song = storage.createSong(
      makeSongInput({ artist: 'Coltrane', key: 'Bb', notes: 'fast tempo', audioMode: 'metronome' })
    );
    expect(song.artist).toBe('Coltrane');
    expect(song.key).toBe('Bb');
    expect(song.notes).toBe('fast tempo');
    expect(song.audioMode).toBe('metronome');
  });
});

// ═════════════════════════════════════════════════════════════════════════
// Setlists
// ═════════════════════════════════════════════════════════════════════════

describe('LocalStorageAdapter — Setlists', () => {
  it('getSetlists returns empty array when no data', () => {
    expect(storage.getSetlists()).toEqual([]);
  });

  it('createSetlist persists and returns a setlist with id and timestamps', () => {
    const setlist = storage.createSetlist(makeSetlistInput({ name: 'Gig Night' }));
    expect(setlist.id).toBeTruthy();
    expect(setlist.name).toBe('Gig Night');
    expect(setlist.songIds).toEqual([]);
    expect(setlist.createdAt).toBe('2026-03-14T00:00:00.000Z');
  });

  it('createSetlist preserves songIds', () => {
    const setlist = storage.createSetlist(makeSetlistInput({ songIds: ['s1', 's2', 's3'] }));
    expect(setlist.songIds).toEqual(['s1', 's2', 's3']);
  });

  it('getSetlist returns the correct setlist by id', () => {
    const created = storage.createSetlist(makeSetlistInput({ name: 'Jazz Set' }));
    const found = storage.getSetlist(created.id);
    expect(found).not.toBeNull();
    expect(found!.name).toBe('Jazz Set');
  });

  it('getSetlist returns null for non-existent id', () => {
    expect(storage.getSetlist('nonexistent')).toBeNull();
  });

  it('updateSetlist updates fields and updatedAt', () => {
    const setlist = storage.createSetlist(makeSetlistInput({ name: 'Old Name', songIds: [] }));
    const updated = storage.updateSetlist(setlist.id, { name: 'New Name', songIds: ['s1'] });

    expect(updated).not.toBeNull();
    expect(updated!.name).toBe('New Name');
    expect(updated!.songIds).toEqual(['s1']);
  });

  it('updateSetlist returns null for non-existent id', () => {
    expect(storage.updateSetlist('nonexistent', { name: 'X' })).toBeNull();
  });

  it('deleteSetlist removes the setlist and returns true', () => {
    const setlist = storage.createSetlist(makeSetlistInput());
    expect(storage.deleteSetlist(setlist.id)).toBe(true);
    expect(storage.getSetlists()).toHaveLength(0);
  });

  it('deleteSetlist returns false for non-existent id', () => {
    expect(storage.deleteSetlist('nonexistent')).toBe(false);
  });

  it('deleteSetlist does not affect other setlists', () => {
    const a = storage.createSetlist(makeSetlistInput({ name: 'A' }));
    const b = storage.createSetlist(makeSetlistInput({ name: 'B' }));
    storage.deleteSetlist(a.id);
    expect(storage.getSetlists()).toHaveLength(1);
    expect(storage.getSetlists()[0].id).toBe(b.id);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// Cascade deletion — song removed from setlists
// ═════════════════════════════════════════════════════════════════════════

describe('LocalStorageAdapter — Cascade deletion', () => {
  it('deleteSong removes the song id from all setlists that reference it', () => {
    const song = storage.createSong(makeSongInput({ name: 'Cascade Me' }));
    storage.createSetlist(makeSetlistInput({ name: 'Set A', songIds: [song.id, 'other-id'] }));
    storage.createSetlist(makeSetlistInput({ name: 'Set B', songIds: [song.id] }));
    storage.createSetlist(makeSetlistInput({ name: 'Set C', songIds: ['other-id'] }));

    storage.deleteSong(song.id);

    const setlists = storage.getSetlists();
    const setA = setlists.find((s) => s.name === 'Set A')!;
    const setB = setlists.find((s) => s.name === 'Set B')!;
    const setC = setlists.find((s) => s.name === 'Set C')!;

    expect(setA.songIds).toEqual(['other-id']);
    expect(setB.songIds).toEqual([]);
    expect(setC.songIds).toEqual(['other-id']); // unchanged
  });

  it('deleteSong cascade works when no setlists exist', () => {
    const song = storage.createSong(makeSongInput());
    // Should not throw
    expect(storage.deleteSong(song.id)).toBe(true);
  });

  it('deleteSong cascade works when setlists do not reference the song', () => {
    const song = storage.createSong(makeSongInput());
    storage.createSetlist(makeSetlistInput({ songIds: ['unrelated-id'] }));

    storage.deleteSong(song.id);

    const setlists = storage.getSetlists();
    expect(setlists[0].songIds).toEqual(['unrelated-id']);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// Attachments
// ═════════════════════════════════════════════════════════════════════════

describe('LocalStorageAdapter — Attachments', () => {
  const songId = 'song-abc';

  it('getAttachments returns empty array when no data', () => {
    expect(storage.getAttachments(songId)).toEqual([]);
  });

  it('createAttachment persists and returns attachment with id and timestamps', () => {
    const att = storage.createAttachment(songId, makeAttachmentInput({ name: 'Notes' }));
    expect(att.id).toBeTruthy();
    expect(att.type).toBe('richtext');
    expect(att.name).toBe('Notes');
    expect(att.order).toBe(0);
    expect(att.isDefault).toBe(true);
    expect(att.createdAt).toBe('2026-03-14T00:00:00.000Z');
  });

  it('createAttachment appends to existing attachments', () => {
    storage.createAttachment(songId, makeAttachmentInput({ name: 'First', order: 0 }));
    storage.createAttachment(songId, makeAttachmentInput({ name: 'Second', order: 1, isDefault: false }));

    const atts = storage.getAttachments(songId);
    expect(atts).toHaveLength(2);
  });

  it('getAttachments returns attachments sorted by order', () => {
    storage.createAttachment(songId, makeAttachmentInput({ name: 'C', order: 2, isDefault: false }));
    storage.createAttachment(songId, makeAttachmentInput({ name: 'A', order: 0 }));
    storage.createAttachment(songId, makeAttachmentInput({ name: 'B', order: 1, isDefault: false }));

    const atts = storage.getAttachments(songId);
    expect(atts[0].name).toBe('A');
    expect(atts[1].name).toBe('B');
    expect(atts[2].name).toBe('C');
  });

  it('attachments are scoped per song', () => {
    storage.createAttachment('song-1', makeAttachmentInput({ name: 'Song 1 Notes' }));
    storage.createAttachment('song-2', makeAttachmentInput({ name: 'Song 2 Notes' }));

    expect(storage.getAttachments('song-1')).toHaveLength(1);
    expect(storage.getAttachments('song-2')).toHaveLength(1);
    expect(storage.getAttachments('song-1')[0].name).toBe('Song 1 Notes');
  });

  it('updateAttachment updates fields and updatedAt', () => {
    const att = storage.createAttachment(songId, makeAttachmentInput({ name: 'Old' }));
    const updated = storage.updateAttachment(songId, att.id, { name: 'New', order: 5 });

    expect(updated).not.toBeNull();
    expect(updated!.name).toBe('New');
    expect(updated!.order).toBe(5);
    expect(updated!.type).toBe('richtext'); // unchanged
  });

  it('updateAttachment returns null for non-existent attachment id', () => {
    expect(storage.updateAttachment(songId, 'nonexistent', { name: 'X' })).toBeNull();
  });

  it('deleteAttachment removes the attachment and returns true', () => {
    const att = storage.createAttachment(songId, makeAttachmentInput());
    expect(storage.deleteAttachment(songId, att.id)).toBe(true);
    expect(storage.getAttachments(songId)).toHaveLength(0);
  });

  it('deleteAttachment returns false for non-existent id', () => {
    expect(storage.deleteAttachment(songId, 'nonexistent')).toBe(false);
  });

  it('deleteAttachment does not affect other attachments', () => {
    const a = storage.createAttachment(songId, makeAttachmentInput({ name: 'A', order: 0 }));
    const b = storage.createAttachment(songId, makeAttachmentInput({ name: 'B', order: 1, isDefault: false }));
    storage.deleteAttachment(songId, a.id);

    const atts = storage.getAttachments(songId);
    expect(atts).toHaveLength(1);
    expect(atts[0].id).toBe(b.id);
  });

  it('deleteAllAttachments removes the entire key from localStorage', () => {
    storage.createAttachment(songId, makeAttachmentInput({ name: 'A' }));
    storage.createAttachment(songId, makeAttachmentInput({ name: 'B', order: 1, isDefault: false }));

    storage.deleteAllAttachments(songId);

    expect(storage.getAttachments(songId)).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEYS.attachments(songId))).toBeNull();
  });

  it('deleteAllAttachments is safe when no attachments exist', () => {
    // Should not throw
    storage.deleteAllAttachments(songId);
    expect(storage.getAttachments(songId)).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// Attachment reordering
// ═════════════════════════════════════════════════════════════════════════

describe('LocalStorageAdapter — Attachment reordering', () => {
  const songId = 'song-reorder';

  it('reorderAttachments updates order fields to match the provided id order', () => {
    const a = storage.createAttachment(songId, makeAttachmentInput({ name: 'A', order: 0 }));
    const b = storage.createAttachment(songId, makeAttachmentInput({ name: 'B', order: 1, isDefault: false }));
    const c = storage.createAttachment(songId, makeAttachmentInput({ name: 'C', order: 2, isDefault: false }));

    // Reverse the order
    storage.reorderAttachments(songId, [c.id, b.id, a.id]);

    const atts = storage.getAttachments(songId);
    expect(atts[0].name).toBe('C');
    expect(atts[0].order).toBe(0);
    expect(atts[1].name).toBe('B');
    expect(atts[1].order).toBe(1);
    expect(atts[2].name).toBe('A');
    expect(atts[2].order).toBe(2);
  });

  it('reorderAttachments filters out non-existent ids', () => {
    const a = storage.createAttachment(songId, makeAttachmentInput({ name: 'A', order: 0 }));
    storage.createAttachment(songId, makeAttachmentInput({ name: 'B', order: 1, isDefault: false }));

    // Only include A and a non-existent id
    storage.reorderAttachments(songId, [a.id, 'nonexistent']);

    const atts = storage.getAttachments(songId);
    // B is dropped because it was not in orderedIds
    expect(atts).toHaveLength(1);
    expect(atts[0].id).toBe(a.id);
    expect(atts[0].order).toBe(0);
  });

  it('reorderAttachments with empty array clears all attachments', () => {
    storage.createAttachment(songId, makeAttachmentInput({ name: 'A', order: 0 }));

    storage.reorderAttachments(songId, []);

    expect(storage.getAttachments(songId)).toEqual([]);
  });

  it('reorderAttachments updates updatedAt on each attachment', () => {
    const a = storage.createAttachment(songId, makeAttachmentInput({ name: 'A', order: 0 }));

    storage.reorderAttachments(songId, [a.id]);

    const atts = storage.getAttachments(songId);
    expect(atts[0].updatedAt).toBe('2026-03-14T00:00:00.000Z');
  });
});

// ═════════════════════════════════════════════════════════════════════════
// Assets
// ═════════════════════════════════════════════════════════════════════════

describe('LocalStorageAdapter — Assets', () => {
  it('getAssets returns empty array when no data', () => {
    expect(storage.getAssets()).toEqual([]);
  });

  it('createAsset persists the asset', () => {
    const asset = makeAsset({ id: 'a1', name: 'photo.jpg' });
    storage.createAsset(asset);

    const assets = storage.getAssets();
    expect(assets).toHaveLength(1);
    expect(assets[0].id).toBe('a1');
    expect(assets[0].name).toBe('photo.jpg');
  });

  it('createAsset appends to existing assets', () => {
    storage.createAsset(makeAsset({ id: 'a1' }));
    storage.createAsset(makeAsset({ id: 'a2' }));

    expect(storage.getAssets()).toHaveLength(2);
  });

  it('updateAsset updates fields and updatedAt', () => {
    storage.createAsset(makeAsset({ id: 'a1', name: 'old.png', size: 100 }));
    storage.updateAsset('a1', { name: 'new.png', size: 200 });

    const assets = storage.getAssets();
    expect(assets[0].name).toBe('new.png');
    expect(assets[0].size).toBe(200);
    expect(assets[0].updatedAt).toBe('2026-03-14T00:00:00.000Z');
  });

  it('updateAsset does nothing for non-existent id', () => {
    storage.createAsset(makeAsset({ id: 'a1' }));
    storage.updateAsset('nonexistent', { name: 'X' });

    // Original unchanged
    expect(storage.getAssets()).toHaveLength(1);
    expect(storage.getAssets()[0].id).toBe('a1');
  });

  it('deleteAsset removes the asset', () => {
    storage.createAsset(makeAsset({ id: 'a1' }));
    storage.createAsset(makeAsset({ id: 'a2' }));

    storage.deleteAsset('a1');

    const assets = storage.getAssets();
    expect(assets).toHaveLength(1);
    expect(assets[0].id).toBe('a2');
  });

  it('deleteAsset is safe when id does not exist', () => {
    storage.createAsset(makeAsset({ id: 'a1' }));
    // Should not throw, and the existing asset stays
    storage.deleteAsset('nonexistent');
    expect(storage.getAssets()).toHaveLength(1);
  });

  it('createAsset preserves all fields including content and drawingData', () => {
    const drawingData = {
      strokes: [{ id: 's1', points: [[0, 0, 1] as [number, number, number]], color: '#000', tool: 'pen' as const }],
      canvasWidth: 300,
      canvasHeight: 400,
    };
    const asset = makeAsset({ id: 'a1', type: 'drawing', drawingData, content: { type: 'doc' } });
    storage.createAsset(asset);

    const persisted = storage.getAssets()[0];
    expect(persisted.drawingData).toEqual(drawingData);
    expect(persisted.content).toEqual({ type: 'doc' });
  });
});

// ═════════════════════════════════════════════════════════════════════════
// localStorage persistence details
// ═════════════════════════════════════════════════════════════════════════

describe('LocalStorageAdapter — localStorage persistence', () => {
  it('songs are stored under the correct key', () => {
    storage.createSong(makeSongInput());
    expect(localStorage.getItem(STORAGE_KEYS.SONGS)).not.toBeNull();
  });

  it('setlists are stored under the correct key', () => {
    storage.createSetlist(makeSetlistInput());
    expect(localStorage.getItem(STORAGE_KEYS.SETLISTS)).not.toBeNull();
  });

  it('attachments are stored under per-song key', () => {
    const songId = 'my-song';
    storage.createAttachment(songId, makeAttachmentInput());
    expect(localStorage.getItem(STORAGE_KEYS.attachments(songId))).not.toBeNull();
  });

  it('assets are stored under the correct key', () => {
    storage.createAsset(makeAsset({ id: 'a1' }));
    expect(localStorage.getItem(STORAGE_KEYS.ASSETS)).not.toBeNull();
  });

  it('data survives across multiple reads (round-trip)', () => {
    const song = storage.createSong(makeSongInput({ name: 'Round Trip' }));
    // Read twice to ensure consistency
    const first = storage.getSong(song.id);
    const second = storage.getSong(song.id);
    expect(first).toEqual(second);
  });

  it('getSongs handles corrupted localStorage gracefully by throwing', () => {
    localStorage.setItem(STORAGE_KEYS.SONGS, 'not-valid-json');
    expect(() => storage.getSongs()).toThrow();
  });
});

// ═════════════════════════════════════════════════════════════════════════
// Edge cases
// ═════════════════════════════════════════════════════════════════════════

describe('LocalStorageAdapter — Edge cases', () => {
  it('creating multiple songs generates unique ids', () => {
    const a = storage.createSong(makeSongInput());
    const b = storage.createSong(makeSongInput());
    expect(a.id).not.toBe(b.id);
  });

  it('updateSong does not create a song if id does not exist', () => {
    storage.updateSong('ghost', { name: 'Ghost Song' });
    expect(storage.getSongs()).toHaveLength(0);
  });

  it('deleting a song that was already deleted returns false', () => {
    const song = storage.createSong(makeSongInput());
    storage.deleteSong(song.id);
    expect(storage.deleteSong(song.id)).toBe(false);
  });

  it('setlist with empty songIds array works correctly', () => {
    const setlist = storage.createSetlist(makeSetlistInput({ songIds: [] }));
    expect(setlist.songIds).toEqual([]);

    const updated = storage.updateSetlist(setlist.id, { songIds: ['s1'] });
    expect(updated!.songIds).toEqual(['s1']);
  });

  it('song with all optional fields undefined is persisted correctly', () => {
    const song = storage.createSong({ name: 'Minimal', bpm: 60, timeSignature: '3/4' });
    const retrieved = storage.getSong(song.id)!;
    expect(retrieved.artist).toBeUndefined();
    expect(retrieved.key).toBeUndefined();
    expect(retrieved.notes).toBeUndefined();
    expect(retrieved.audioMode).toBeUndefined();
  });

  it('attachment with richtext content persists the content object', () => {
    const content = { type: 'doc', content: [{ type: 'paragraph' }] };
    storage.createAttachment('song-1', makeAttachmentInput({ content }));
    const retrieved = storage.getAttachments('song-1');
    expect(retrieved[0].content).toEqual(content);
  });

  it('multiple operations on same entity maintain consistency', () => {
    const song = storage.createSong(makeSongInput({ name: 'Step 1', bpm: 100 }));
    storage.updateSong(song.id, { name: 'Step 2' });
    storage.updateSong(song.id, { bpm: 200 });

    const final = storage.getSong(song.id)!;
    expect(final.name).toBe('Step 2');
    expect(final.bpm).toBe(200);
  });

  it('deleteSong cascade with song appearing multiple times in same setlist', () => {
    const song = storage.createSong(makeSongInput());
    // A setlist that references the same song id twice
    storage.createSetlist(makeSetlistInput({ songIds: [song.id, 'other', song.id] }));

    storage.deleteSong(song.id);

    const setlists = storage.getSetlists();
    // All occurrences of the song should be removed
    expect(setlists[0].songIds).toEqual(['other']);
  });

  it('attachment types other than richtext are supported', () => {
    const imageAtt = storage.createAttachment('s1', makeAttachmentInput({
      type: 'image',
      order: 0,
      isDefault: false,
      fileName: 'photo.jpg',
      fileSize: 2048,
      width: 800,
      height: 600,
    }));
    expect(imageAtt.type).toBe('image');
    expect(imageAtt.fileName).toBe('photo.jpg');

    const pdfAtt = storage.createAttachment('s1', makeAttachmentInput({
      type: 'pdf',
      order: 1,
      isDefault: false,
      pageCount: 5,
    }));
    expect(pdfAtt.type).toBe('pdf');
    expect(pdfAtt.pageCount).toBe(5);
  });

  it('updateSetlist partial update preserves other fields', () => {
    const setlist = storage.createSetlist(makeSetlistInput({ name: 'Original', songIds: ['s1', 's2'] }));
    const updated = storage.updateSetlist(setlist.id, { name: 'Updated' });

    expect(updated!.name).toBe('Updated');
    expect(updated!.songIds).toEqual(['s1', 's2']); // preserved
  });
});

// ═════════════════════════════════════════════════════════════════════════
// Storage size calculation (verifying JSON serialization behavior)
// ═════════════════════════════════════════════════════════════════════════

describe('LocalStorageAdapter — Storage size', () => {
  it('stores songs as JSON string in localStorage', () => {
    storage.createSong(makeSongInput({ name: 'Size Test' }));
    const raw = localStorage.getItem(STORAGE_KEYS.SONGS)!;
    const parsed = JSON.parse(raw);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].name).toBe('Size Test');
  });

  it('storage grows with each added song', () => {
    storage.createSong(makeSongInput({ name: 'A' }));
    const sizeAfterOne = localStorage.getItem(STORAGE_KEYS.SONGS)!.length;

    storage.createSong(makeSongInput({ name: 'B' }));
    const sizeAfterTwo = localStorage.getItem(STORAGE_KEYS.SONGS)!.length;

    expect(sizeAfterTwo).toBeGreaterThan(sizeAfterOne);
  });
});
