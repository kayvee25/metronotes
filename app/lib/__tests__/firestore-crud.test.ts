/**
 * Tests for Firestore CRUD operations.
 *
 * Covers songs, setlists, attachments, assets, and cascade deletion.
 * Serialization is tested separately in firestore-serializers.test.ts.
 */

// --- Mocks (vi.hoisted so they're available in vi.mock factories) ---

const {
  mockCollection,
  mockDoc,
  mockGetDocs,
  mockGetDoc,
  mockSetDoc,
  mockUpdateDoc,
  mockDeleteDoc,
  mockQuery,
  mockOrderBy,
  mockWriteBatch,
  mockDb,
  mockGenerateId,
  mockGetTimestamp,
} = vi.hoisted(() => {
  const batchOps = {
    delete: vi.fn(),
    update: vi.fn(),
    commit: vi.fn(),
  };

  return {
    mockCollection: vi.fn((...args: string[]) => args.join('/')),
    mockDoc: vi.fn((...args: string[]) => args.join('/')),
    mockGetDocs: vi.fn(),
    mockGetDoc: vi.fn(),
    mockSetDoc: vi.fn(),
    mockUpdateDoc: vi.fn(),
    mockDeleteDoc: vi.fn(),
    mockQuery: vi.fn((...args: unknown[]) => args[0]),
    mockOrderBy: vi.fn((...args: unknown[]) => `orderBy(${args[0]})`),
    mockWriteBatch: vi.fn(() => batchOps),
    mockDb: { __mock: true },
    mockGenerateId: vi.fn(() => 'generated-id'),
    mockGetTimestamp: vi.fn(() => '2026-01-01T00:00:00.000Z'),
  };
});

vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  doc: mockDoc,
  getDocs: mockGetDocs,
  getDoc: mockGetDoc,
  setDoc: mockSetDoc,
  updateDoc: mockUpdateDoc,
  deleteDoc: mockDeleteDoc,
  query: mockQuery,
  orderBy: mockOrderBy,
  writeBatch: mockWriteBatch,
}));

vi.mock('../firebase', () => ({
  db: mockDb,
}));

vi.mock('../utils', () => ({
  generateId: mockGenerateId,
  getTimestamp: mockGetTimestamp,
}));

vi.mock('../constants', () => ({
  STORAGE_KEYS: {
    SONGS: 'metronotes_songs',
    SETLISTS: 'metronotes_setlists',
    ASSETS: 'metronotes_assets',
    attachments: (id: string) => `metronotes_attachments_${id}`,
  },
}));

vi.mock('../guest-blob-storage', () => ({
  getAllGuestBlobs: vi.fn(),
  clearAllGuestBlobs: vi.fn(),
}));

vi.mock('../storage-firebase', () => ({
  uploadAttachmentFile: vi.fn(),
  getStoragePath: vi.fn(),
}));

import {
  firestoreGetSongs,
  firestoreGetSong,
  firestoreCreateSong,
  firestoreUpdateSong,
  firestoreDeleteSong,
  firestoreGetSetlists,
  firestoreGetSetlist,
  firestoreCreateSetlist,
  firestoreUpdateSetlist,
  firestoreDeleteSetlist,
  firestoreGetAttachments,
  firestoreCreateAttachment,
  firestoreUpdateAttachment,
  firestoreDeleteAttachment,
  firestoreDeleteAllAttachments,
  firestoreReorderAttachments,
  firestoreGetAssets,
  firestoreCreateAsset,
  firestoreUpdateAsset,
  firestoreDeleteAsset,
} from '../firestore';

// Helpers

const USER_ID = 'user-123';
const SONG_ID = 'song-456';
const SETLIST_ID = 'setlist-789';
const ATTACHMENT_ID = 'att-abc';
const ASSET_ID = 'asset-def';
const NOW = '2026-01-01T00:00:00.000Z';

function makeDocSnapshot(id: string, data: Record<string, unknown>, exists = true) {
  return {
    id,
    exists: () => exists,
    data: () => data,
    ref: `ref-${id}`,
  };
}

function makeQuerySnapshot(docs: ReturnType<typeof makeDocSnapshot>[]) {
  return { docs };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGenerateId.mockReturnValue('generated-id');
  mockGetTimestamp.mockReturnValue(NOW);
});

// ============================================================
// Songs CRUD
// ============================================================

describe('firestoreGetSongs', () => {
  it('returns songs from Firestore with id merged', async () => {
    const songData = { name: 'Test Song', bpm: 120, timeSignature: '4/4', createdAt: NOW, updatedAt: NOW };
    mockGetDocs.mockResolvedValue(makeQuerySnapshot([
      makeDocSnapshot('s1', songData),
      makeDocSnapshot('s2', { ...songData, name: 'Song 2' }),
    ]));

    const songs = await firestoreGetSongs(USER_ID);

    expect(songs).toHaveLength(2);
    expect(songs[0]).toEqual({ id: 's1', ...songData });
    expect(songs[1]).toEqual({ id: 's2', ...songData, name: 'Song 2' });
  });

  it('calls collection with correct path', async () => {
    mockGetDocs.mockResolvedValue(makeQuerySnapshot([]));

    await firestoreGetSongs(USER_ID);

    expect(mockCollection).toHaveBeenCalledWith(mockDb, 'users', USER_ID, 'songs');
  });

  it('returns empty array when no songs exist', async () => {
    mockGetDocs.mockResolvedValue(makeQuerySnapshot([]));

    const songs = await firestoreGetSongs(USER_ID);
    expect(songs).toEqual([]);
  });
});

describe('firestoreGetSong', () => {
  it('returns a single song by id', async () => {
    const songData = { name: 'My Song', bpm: 90, timeSignature: '3/4', createdAt: NOW, updatedAt: NOW };
    mockGetDoc.mockResolvedValue(makeDocSnapshot(SONG_ID, songData));

    const song = await firestoreGetSong(USER_ID, SONG_ID);

    expect(song).toEqual({ id: SONG_ID, ...songData });
    expect(mockDoc).toHaveBeenCalledWith(mockDb, 'users', USER_ID, 'songs', SONG_ID);
  });

  it('returns null when song does not exist', async () => {
    mockGetDoc.mockResolvedValue(makeDocSnapshot(SONG_ID, {}, false));

    const song = await firestoreGetSong(USER_ID, SONG_ID);
    expect(song).toBeNull();
  });
});

describe('firestoreCreateSong', () => {
  it('creates a song with generated id and timestamps', async () => {
    mockSetDoc.mockResolvedValue(undefined);

    const input = { name: 'New Song', bpm: 140, timeSignature: '4/4' };
    const result = await firestoreCreateSong(USER_ID, input);

    expect(result).toEqual({
      ...input,
      id: 'generated-id',
      createdAt: NOW,
      updatedAt: NOW,
    });
  });

  it('calls setDoc with correct Firestore path', async () => {
    mockSetDoc.mockResolvedValue(undefined);

    await firestoreCreateSong(USER_ID, { name: 'X', bpm: 100, timeSignature: '4/4' });

    expect(mockDoc).toHaveBeenCalledWith(mockDb, 'users', USER_ID, 'songs', 'generated-id');
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
  });

  it('strips undefined values before writing', async () => {
    mockSetDoc.mockResolvedValue(undefined);

    await firestoreCreateSong(USER_ID, { name: 'X', bpm: 100, timeSignature: '4/4', artist: undefined });

    const writtenData = mockSetDoc.mock.calls[0][1];
    expect(writtenData).not.toHaveProperty('artist');
  });
});

describe('firestoreUpdateSong', () => {
  it('updates a song and returns merged data', async () => {
    const existing = { name: 'Old', bpm: 100, timeSignature: '4/4', createdAt: NOW, updatedAt: NOW };
    mockGetDoc.mockResolvedValue(makeDocSnapshot(SONG_ID, existing));
    mockUpdateDoc.mockResolvedValue(undefined);

    const result = await firestoreUpdateSong(USER_ID, SONG_ID, { name: 'Updated' });

    expect(result).toEqual({
      id: SONG_ID,
      ...existing,
      name: 'Updated',
      updatedAt: NOW,
    });
  });

  it('calls updateDoc with correct path and stripped data', async () => {
    mockGetDoc.mockResolvedValue(makeDocSnapshot(SONG_ID, { name: 'Old', bpm: 100 }));
    mockUpdateDoc.mockResolvedValue(undefined);

    await firestoreUpdateSong(USER_ID, SONG_ID, { name: 'New', artist: undefined });

    expect(mockDoc).toHaveBeenCalledWith(mockDb, 'users', USER_ID, 'songs', SONG_ID);
    const updatePayload = mockUpdateDoc.mock.calls[0][1];
    expect(updatePayload).not.toHaveProperty('artist');
    expect(updatePayload.updatedAt).toBe(NOW);
  });

  it('returns null when song does not exist', async () => {
    mockGetDoc.mockResolvedValue(makeDocSnapshot(SONG_ID, {}, false));

    const result = await firestoreUpdateSong(USER_ID, SONG_ID, { name: 'X' });
    expect(result).toBeNull();
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });
});

describe('firestoreDeleteSong', () => {
  it('deletes the song and returns true', async () => {
    mockGetDoc.mockResolvedValue(makeDocSnapshot(SONG_ID, { name: 'Doomed' }));
    mockDeleteDoc.mockResolvedValue(undefined);
    // No setlists contain this song
    mockGetDocs.mockResolvedValue(makeQuerySnapshot([]));

    const result = await firestoreDeleteSong(USER_ID, SONG_ID);

    expect(result).toBe(true);
    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
  });

  it('returns false when song does not exist', async () => {
    mockGetDoc.mockResolvedValue(makeDocSnapshot(SONG_ID, {}, false));

    const result = await firestoreDeleteSong(USER_ID, SONG_ID);

    expect(result).toBe(false);
    expect(mockDeleteDoc).not.toHaveBeenCalled();
  });

  it('cascades removal from setlists containing the song', async () => {
    mockGetDoc.mockResolvedValue(makeDocSnapshot(SONG_ID, { name: 'Song' }));
    mockDeleteDoc.mockResolvedValue(undefined);

    // Two setlists: one contains the deleted song, one does not
    const setlistWithSong = makeDocSnapshot('sl1', { songIds: [SONG_ID, 'other-song'] });
    const setlistWithoutSong = makeDocSnapshot('sl2', { songIds: ['another-song'] });
    mockGetDocs.mockResolvedValue(makeQuerySnapshot([setlistWithSong, setlistWithoutSong]));
    mockUpdateDoc.mockResolvedValue(undefined);

    await firestoreDeleteSong(USER_ID, SONG_ID);

    // Only the setlist containing the song should be updated
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    expect(mockUpdateDoc).toHaveBeenCalledWith('ref-sl1', {
      songIds: ['other-song'],
      updatedAt: NOW,
    });
  });

  it('removes song from all setlists that contain it', async () => {
    mockGetDoc.mockResolvedValue(makeDocSnapshot(SONG_ID, { name: 'Song' }));
    mockDeleteDoc.mockResolvedValue(undefined);

    // Both setlists contain the deleted song
    const sl1 = makeDocSnapshot('sl1', { songIds: [SONG_ID] });
    const sl2 = makeDocSnapshot('sl2', { songIds: ['x', SONG_ID, 'y'] });
    mockGetDocs.mockResolvedValue(makeQuerySnapshot([sl1, sl2]));
    mockUpdateDoc.mockResolvedValue(undefined);

    await firestoreDeleteSong(USER_ID, SONG_ID);

    expect(mockUpdateDoc).toHaveBeenCalledTimes(2);
    expect(mockUpdateDoc).toHaveBeenCalledWith('ref-sl1', { songIds: [], updatedAt: NOW });
    expect(mockUpdateDoc).toHaveBeenCalledWith('ref-sl2', { songIds: ['x', 'y'], updatedAt: NOW });
  });
});

// ============================================================
// Setlists CRUD
// ============================================================

describe('firestoreGetSetlists', () => {
  it('returns setlists from Firestore with id merged', async () => {
    const data = { name: 'My Set', songIds: ['s1', 's2'], createdAt: NOW, updatedAt: NOW };
    mockGetDocs.mockResolvedValue(makeQuerySnapshot([
      makeDocSnapshot('sl1', data),
    ]));

    const setlists = await firestoreGetSetlists(USER_ID);

    expect(setlists).toEqual([{ id: 'sl1', ...data }]);
  });

  it('calls collection with correct path', async () => {
    mockGetDocs.mockResolvedValue(makeQuerySnapshot([]));

    await firestoreGetSetlists(USER_ID);

    expect(mockCollection).toHaveBeenCalledWith(mockDb, 'users', USER_ID, 'setlists');
  });
});

describe('firestoreGetSetlist', () => {
  it('returns a single setlist by id', async () => {
    const data = { name: 'Gig', songIds: [], createdAt: NOW, updatedAt: NOW };
    mockGetDoc.mockResolvedValue(makeDocSnapshot(SETLIST_ID, data));

    const setlist = await firestoreGetSetlist(USER_ID, SETLIST_ID);

    expect(setlist).toEqual({ id: SETLIST_ID, ...data });
    expect(mockDoc).toHaveBeenCalledWith(mockDb, 'users', USER_ID, 'setlists', SETLIST_ID);
  });

  it('returns null when setlist does not exist', async () => {
    mockGetDoc.mockResolvedValue(makeDocSnapshot(SETLIST_ID, {}, false));

    const setlist = await firestoreGetSetlist(USER_ID, SETLIST_ID);
    expect(setlist).toBeNull();
  });
});

describe('firestoreCreateSetlist', () => {
  it('creates a setlist with generated id and timestamps', async () => {
    mockSetDoc.mockResolvedValue(undefined);

    const input = { name: 'New Set', songIds: ['s1'] };
    const result = await firestoreCreateSetlist(USER_ID, input);

    expect(result).toEqual({
      ...input,
      id: 'generated-id',
      createdAt: NOW,
      updatedAt: NOW,
    });
  });

  it('calls setDoc with correct Firestore path', async () => {
    mockSetDoc.mockResolvedValue(undefined);

    await firestoreCreateSetlist(USER_ID, { name: 'Set', songIds: [] });

    expect(mockDoc).toHaveBeenCalledWith(mockDb, 'users', USER_ID, 'setlists', 'generated-id');
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
  });
});

describe('firestoreUpdateSetlist', () => {
  it('updates a setlist and returns merged data', async () => {
    const existing = { name: 'Old Set', songIds: ['s1'], createdAt: NOW, updatedAt: NOW };
    mockGetDoc.mockResolvedValue(makeDocSnapshot(SETLIST_ID, existing));
    mockUpdateDoc.mockResolvedValue(undefined);

    const result = await firestoreUpdateSetlist(USER_ID, SETLIST_ID, { name: 'Renamed' });

    expect(result).toEqual({
      id: SETLIST_ID,
      ...existing,
      name: 'Renamed',
      updatedAt: NOW,
    });
  });

  it('returns null when setlist does not exist', async () => {
    mockGetDoc.mockResolvedValue(makeDocSnapshot(SETLIST_ID, {}, false));

    const result = await firestoreUpdateSetlist(USER_ID, SETLIST_ID, { name: 'X' });
    expect(result).toBeNull();
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });
});

describe('firestoreDeleteSetlist', () => {
  it('deletes the setlist and returns true', async () => {
    mockGetDoc.mockResolvedValue(makeDocSnapshot(SETLIST_ID, { name: 'Set' }));
    mockDeleteDoc.mockResolvedValue(undefined);

    const result = await firestoreDeleteSetlist(USER_ID, SETLIST_ID);

    expect(result).toBe(true);
    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
  });

  it('returns false when setlist does not exist', async () => {
    mockGetDoc.mockResolvedValue(makeDocSnapshot(SETLIST_ID, {}, false));

    const result = await firestoreDeleteSetlist(USER_ID, SETLIST_ID);
    expect(result).toBe(false);
    expect(mockDeleteDoc).not.toHaveBeenCalled();
  });
});

// ============================================================
// Attachments CRUD
// ============================================================

describe('firestoreGetAttachments', () => {
  it('returns attachments ordered by order field with restoreFromFirestoreRead applied', async () => {
    const attData = {
      type: 'richtext',
      name: 'Notes',
      order: 0,
      isDefault: true,
      createdAt: NOW,
      updatedAt: NOW,
    };
    mockGetDocs.mockResolvedValue(makeQuerySnapshot([
      makeDocSnapshot('a1', attData),
    ]));

    const attachments = await firestoreGetAttachments(USER_ID, SONG_ID);

    expect(attachments).toHaveLength(1);
    expect(attachments[0].id).toBe('a1');
    expect(attachments[0].type).toBe('richtext');
  });

  it('calls query with attachments subcollection and orderBy', async () => {
    mockGetDocs.mockResolvedValue(makeQuerySnapshot([]));

    await firestoreGetAttachments(USER_ID, SONG_ID);

    expect(mockCollection).toHaveBeenCalledWith(mockDb, 'users', USER_ID, 'songs', SONG_ID, 'attachments');
    expect(mockOrderBy).toHaveBeenCalledWith('order');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('applies restoreFromFirestoreRead to convert stroke objects back to arrays', async () => {
    const attData = {
      type: 'drawing',
      name: 'Sketch',
      order: 0,
      isDefault: false,
      drawingData: {
        strokes: [{ id: 'st1', points: [{ x: 1, y: 2, p: 0.5 }], color: '#000', tool: 'pen' }],
        canvasWidth: 100,
        canvasHeight: 100,
      },
      createdAt: NOW,
      updatedAt: NOW,
    };
    mockGetDocs.mockResolvedValue(makeQuerySnapshot([makeDocSnapshot('a1', attData)]));

    const attachments = await firestoreGetAttachments(USER_ID, SONG_ID);

    // restoreFromFirestoreRead should convert {x,y,p} back to [x,y,p]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const points = (attachments[0] as any).drawingData.strokes[0].points;
    expect(points[0]).toEqual([1, 2, 0.5]);
  });
});

describe('firestoreCreateAttachment', () => {
  it('creates an attachment with generated id and timestamps', async () => {
    mockSetDoc.mockResolvedValue(undefined);

    const input = { type: 'richtext' as const, name: 'Notes', order: 0, isDefault: true };
    const result = await firestoreCreateAttachment(USER_ID, SONG_ID, input);

    expect(result.id).toBe('generated-id');
    expect(result.type).toBe('richtext');
    expect(result.createdAt).toBe(NOW);
    expect(result.updatedAt).toBe(NOW);
  });

  it('calls setDoc with correct Firestore path including songId', async () => {
    mockSetDoc.mockResolvedValue(undefined);

    await firestoreCreateAttachment(USER_ID, SONG_ID, { type: 'image' as const, order: 1, isDefault: false });

    expect(mockDoc).toHaveBeenCalledWith(mockDb, 'users', USER_ID, 'songs', SONG_ID, 'attachments', 'generated-id');
  });

  it('applies prepareForFirestoreWrite to convert stroke arrays for storage', async () => {
    mockSetDoc.mockResolvedValue(undefined);

    const input = {
      type: 'drawing' as const,
      name: 'Sketch',
      order: 0,
      isDefault: false,
      drawingData: {
        strokes: [{ id: 'st1', points: [[1, 2, 0.5] as [number, number, number]], color: '#000', tool: 'pen' as const }],
        canvasWidth: 100,
        canvasHeight: 100,
      },
    };
    await firestoreCreateAttachment(USER_ID, SONG_ID, input);

    // The data written to Firestore should have points as {x,y,p} objects
    const writtenData = mockSetDoc.mock.calls[0][1];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const points = (writtenData as any).drawingData.strokes[0].points;
    expect(points[0]).toEqual({ x: 1, y: 2, p: 0.5 });
  });
});

describe('firestoreUpdateAttachment', () => {
  it('calls updateDoc with correct path and prepareForFirestoreWrite applied', async () => {
    mockUpdateDoc.mockResolvedValue(undefined);

    await firestoreUpdateAttachment(USER_ID, SONG_ID, ATTACHMENT_ID, { name: 'Renamed' });

    expect(mockDoc).toHaveBeenCalledWith(mockDb, 'users', USER_ID, 'songs', SONG_ID, 'attachments', ATTACHMENT_ID);
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);

    const payload = mockUpdateDoc.mock.calls[0][1];
    expect(payload.name).toBe('Renamed');
    expect(payload.updatedAt).toBe(NOW);
  });

  it('strips undefined values before writing', async () => {
    mockUpdateDoc.mockResolvedValue(undefined);

    await firestoreUpdateAttachment(USER_ID, SONG_ID, ATTACHMENT_ID, { name: 'X', fileName: undefined });

    const payload = mockUpdateDoc.mock.calls[0][1];
    expect(payload).not.toHaveProperty('fileName');
  });
});

describe('firestoreDeleteAttachment', () => {
  it('deletes the attachment at correct path', async () => {
    mockDeleteDoc.mockResolvedValue(undefined);

    await firestoreDeleteAttachment(USER_ID, SONG_ID, ATTACHMENT_ID);

    expect(mockDoc).toHaveBeenCalledWith(mockDb, 'users', USER_ID, 'songs', SONG_ID, 'attachments', ATTACHMENT_ID);
    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
  });
});

describe('firestoreDeleteAllAttachments', () => {
  it('batch-deletes all attachments for a song', async () => {
    const d1 = makeDocSnapshot('a1', {});
    const d2 = makeDocSnapshot('a2', {});
    mockGetDocs.mockResolvedValue(makeQuerySnapshot([d1, d2]));

    const batchOps = mockWriteBatch();

    await firestoreDeleteAllAttachments(USER_ID, SONG_ID);

    expect(mockWriteBatch).toHaveBeenCalledWith(mockDb);
    expect(batchOps.delete).toHaveBeenCalledTimes(2);
    expect(batchOps.commit).toHaveBeenCalledTimes(1);
  });

  it('handles empty attachments collection', async () => {
    mockGetDocs.mockResolvedValue(makeQuerySnapshot([]));

    const batchOps = mockWriteBatch();

    await firestoreDeleteAllAttachments(USER_ID, SONG_ID);

    expect(batchOps.delete).not.toHaveBeenCalled();
    expect(batchOps.commit).toHaveBeenCalledTimes(1);
  });
});

describe('firestoreReorderAttachments', () => {
  it('batch-updates order on all provided ids', async () => {
    const batchOps = mockWriteBatch();

    await firestoreReorderAttachments(USER_ID, SONG_ID, ['a2', 'a1', 'a3']);

    expect(batchOps.update).toHaveBeenCalledTimes(3);
    expect(batchOps.commit).toHaveBeenCalledTimes(1);

    // Verify order values
    const calls = batchOps.update.mock.calls;
    expect(calls[0][1]).toEqual({ order: 0, updatedAt: NOW });
    expect(calls[1][1]).toEqual({ order: 1, updatedAt: NOW });
    expect(calls[2][1]).toEqual({ order: 2, updatedAt: NOW });
  });
});

// ============================================================
// Assets CRUD
// ============================================================

describe('firestoreGetAssets', () => {
  it('returns assets from Firestore with id merged and restoreFromFirestoreRead applied', async () => {
    const assetData = { name: 'Photo', type: 'image', mimeType: 'image/png', createdAt: NOW, updatedAt: NOW };
    mockGetDocs.mockResolvedValue(makeQuerySnapshot([
      makeDocSnapshot('as1', assetData),
    ]));

    const assets = await firestoreGetAssets(USER_ID);

    expect(assets).toHaveLength(1);
    expect(assets[0].id).toBe('as1');
    expect(assets[0].name).toBe('Photo');
  });

  it('calls collection with correct path', async () => {
    mockGetDocs.mockResolvedValue(makeQuerySnapshot([]));

    await firestoreGetAssets(USER_ID);

    expect(mockCollection).toHaveBeenCalledWith(mockDb, 'users', USER_ID, 'assets');
  });
});

describe('firestoreCreateAsset', () => {
  it('creates an asset with generated id and timestamps', async () => {
    mockSetDoc.mockResolvedValue(undefined);

    const input = { name: 'Photo', type: 'image' as const, mimeType: 'image/png', size: 1024, storageUrl: null, storagePath: null };
    const result = await firestoreCreateAsset(USER_ID, input);

    expect(result.id).toBe('generated-id');
    expect(result.name).toBe('Photo');
    expect(result.type).toBe('image');
    expect(result.createdAt).toBe(NOW);
  });

  it('calls setDoc with correct Firestore path', async () => {
    mockSetDoc.mockResolvedValue(undefined);

    await firestoreCreateAsset(USER_ID, { name: 'X', type: 'pdf' as const, mimeType: null, size: null, storageUrl: null, storagePath: null });

    expect(mockDoc).toHaveBeenCalledWith(mockDb, 'users', USER_ID, 'assets', 'generated-id');
  });

  it('throws when name is missing', async () => {
    await expect(firestoreCreateAsset(USER_ID, { name: '', type: 'image' as const, mimeType: null, size: null, storageUrl: null, storagePath: null }))
      .rejects.toThrow('AssetInput requires name and type');
  });

  it('throws when type is invalid', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(firestoreCreateAsset(USER_ID, { name: 'X', type: 'invalid' as any, mimeType: null, size: null, storageUrl: null, storagePath: null }))
      .rejects.toThrow('Invalid asset type: invalid');
  });

  it('applies prepareForFirestoreWrite for drawingData', async () => {
    mockSetDoc.mockResolvedValue(undefined);

    const input = {
      name: 'Drawing',
      type: 'drawing' as const,
      mimeType: null,
      size: null,
      storageUrl: null,
      storagePath: null,
      drawingData: {
        strokes: [{ id: 'st1', points: [[5, 10, 0.8] as [number, number, number]], color: '#f00', tool: 'pen' as const }],
        canvasWidth: 200,
        canvasHeight: 300,
      },
    };

    await firestoreCreateAsset(USER_ID, input);

    const writtenData = mockSetDoc.mock.calls[0][1];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const points = (writtenData as any).drawingData.strokes[0].points;
    expect(points[0]).toEqual({ x: 5, y: 10, p: 0.8 });
  });

  it('defaults optional fields to null', async () => {
    mockSetDoc.mockResolvedValue(undefined);

    const input = { name: 'Minimal', type: 'richtext' as const, mimeType: null, size: null, storageUrl: null, storagePath: null };
    const result = await firestoreCreateAsset(USER_ID, input);

    expect(result.mimeType).toBeNull();
    expect(result.size).toBeNull();
    expect(result.storageUrl).toBeNull();
    expect(result.storagePath).toBeNull();
  });
});

describe('firestoreUpdateAsset', () => {
  it('calls updateDoc with correct path, stripped data, and prepareForFirestoreWrite', async () => {
    mockUpdateDoc.mockResolvedValue(undefined);

    await firestoreUpdateAsset(USER_ID, ASSET_ID, { name: 'Updated' });

    expect(mockDoc).toHaveBeenCalledWith(mockDb, 'users', USER_ID, 'assets', ASSET_ID);
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    const payload = mockUpdateDoc.mock.calls[0][1];
    expect(payload.name).toBe('Updated');
    expect(payload.updatedAt).toBe(NOW);
  });

  it('strips undefined values before writing', async () => {
    mockUpdateDoc.mockResolvedValue(undefined);

    await firestoreUpdateAsset(USER_ID, ASSET_ID, { name: 'X', mimeType: undefined });

    const payload = mockUpdateDoc.mock.calls[0][1];
    expect(payload).not.toHaveProperty('mimeType');
  });
});

describe('firestoreDeleteAsset', () => {
  it('deletes the asset at correct path', async () => {
    mockDeleteDoc.mockResolvedValue(undefined);

    await firestoreDeleteAsset(USER_ID, ASSET_ID);

    expect(mockDoc).toHaveBeenCalledWith(mockDb, 'users', USER_ID, 'assets', ASSET_ID);
    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
  });
});
