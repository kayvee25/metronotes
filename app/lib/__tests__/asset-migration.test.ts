/**
 * Tests for asset-migration.ts — assetFromAttachment, migrateAttachmentsToAssets,
 * migrateGuestAttachmentsToAssets, and migrateAssetStoragePaths.
 */

import { Attachment, Asset, Song } from '../../types';

// --- Mocks (vi.hoisted so they're available in vi.mock factories) ---

const {
  mockFirestoreGetAttachments,
  mockFirestoreGetAssets,
  mockFirestoreCreateAsset,
  mockFirestoreUpdateAsset,
  mockFirestoreUpdateAttachment,
  mockStorageGetAttachments,
  mockStorageCreateAsset,
  mockStorageUpdateAttachment,
  mockGenerateId,
  mockGetStoragePath,
} = vi.hoisted(() => ({
  mockFirestoreGetAttachments: vi.fn(),
  mockFirestoreGetAssets: vi.fn(),
  mockFirestoreCreateAsset: vi.fn(),
  mockFirestoreUpdateAsset: vi.fn(),
  mockFirestoreUpdateAttachment: vi.fn(),
  mockStorageGetAttachments: vi.fn(),
  mockStorageCreateAsset: vi.fn(),
  mockStorageUpdateAttachment: vi.fn(),
  mockGenerateId: vi.fn(() => 'generated-id'),
  mockGetStoragePath: vi.fn(
    (userId: string, songId: string, attachmentId: string) =>
      `users/${userId}/songs/${songId}/${attachmentId}`
  ),
}));

vi.mock('../firestore', () => ({
  firestoreGetAttachments: mockFirestoreGetAttachments,
  firestoreGetAssets: mockFirestoreGetAssets,
  firestoreCreateAsset: mockFirestoreCreateAsset,
  firestoreUpdateAsset: mockFirestoreUpdateAsset,
  firestoreUpdateAttachment: mockFirestoreUpdateAttachment,
}));

vi.mock('../storage', () => ({
  storage: {
    getAttachments: mockStorageGetAttachments,
    createAsset: mockStorageCreateAsset,
    updateAttachment: mockStorageUpdateAttachment,
  },
}));

vi.mock('../utils', () => ({
  generateId: mockGenerateId,
}));

vi.mock('../storage-firebase', () => ({
  getStoragePath: mockGetStoragePath,
}));

import {
  assetFromAttachment,
  migrateAttachmentsToAssets,
  migrateGuestAttachmentsToAssets,
  migrateAssetStoragePaths,
} from '../asset-migration';

// --- Test helpers ---

function makeSong(overrides: Partial<Song> = {}): Song {
  return {
    id: 'song-1',
    name: 'Test Song',
    bpm: 120,
    timeSignature: '4/4',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeAttachment(overrides: Partial<Attachment> = {}): Attachment {
  return {
    id: 'att-1',
    type: 'richtext',
    order: 0,
    isDefault: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// --- Tests ---

describe('assetFromAttachment', () => {
  it('converts richtext attachment to asset input', () => {
    const tiptapContent = { type: 'doc', content: [{ type: 'paragraph' }] };
    const att = makeAttachment({
      type: 'richtext',
      name: 'My Notes',
      content: tiptapContent,
    });

    const result = assetFromAttachment(att);

    expect(result).toEqual({
      name: 'My Notes',
      type: 'richtext',
      mimeType: 'application/json',
      size: null,
      storageUrl: null,
      storagePath: null,
      content: tiptapContent,
    });
  });

  it('converts drawing attachment to asset input', () => {
    const drawingData = { strokes: [], canvasWidth: 300, canvasHeight: 400 };
    const att = makeAttachment({
      type: 'drawing',
      name: 'My Drawing',
      drawingData,
    });

    const result = assetFromAttachment(att);

    expect(result).toEqual({
      name: 'My Drawing',
      type: 'drawing',
      mimeType: null,
      size: null,
      storageUrl: null,
      storagePath: null,
      drawingData,
    });
  });

  it('converts image attachment to asset input', () => {
    const att = makeAttachment({
      type: 'image',
      name: 'photo.jpg',
      cloudMimeType: 'image/png',
      fileSize: 12345,
      storageUrl: 'https://example.com/photo.png',
    });
    // Add legacy storagePath field
    const attWithLegacy = att as Attachment & { storagePath?: string };
    attWithLegacy.storagePath = 'users/u1/songs/s1/att-1';

    const result = assetFromAttachment(attWithLegacy);

    expect(result).toEqual({
      name: 'photo.jpg',
      type: 'image',
      mimeType: 'image/png',
      size: 12345,
      storageUrl: 'https://example.com/photo.png',
      storagePath: 'users/u1/songs/s1/att-1',
    });
  });

  it('defaults image mimeType to image/jpeg when cloudMimeType is missing', () => {
    const att = makeAttachment({ type: 'image', name: 'img' });
    const result = assetFromAttachment(att);
    expect(result.mimeType).toBe('image/jpeg');
  });

  it('converts pdf attachment to asset input', () => {
    const att = makeAttachment({
      type: 'pdf',
      name: 'score.pdf',
      cloudFileSize: 99999,
      storageUrl: 'https://example.com/score.pdf',
    });

    const result = assetFromAttachment(att);

    expect(result).toEqual({
      name: 'score.pdf',
      type: 'pdf',
      mimeType: 'application/pdf',
      size: 99999,
      storageUrl: 'https://example.com/score.pdf',
      storagePath: null,
    });
  });

  it('converts audio attachment to asset input', () => {
    const att = makeAttachment({
      type: 'audio',
      name: 'track.mp3',
      cloudMimeType: 'audio/wav',
      fileSize: 500000,
      storageUrl: 'https://example.com/track.wav',
    });

    const result = assetFromAttachment(att);

    expect(result).toEqual({
      name: 'track.mp3',
      type: 'audio',
      mimeType: 'audio/wav',
      size: 500000,
      storageUrl: 'https://example.com/track.wav',
      storagePath: null,
    });
  });

  it('defaults audio mimeType to audio/mpeg when cloudMimeType is missing', () => {
    const att = makeAttachment({ type: 'audio', name: 'track' });
    const result = assetFromAttachment(att);
    expect(result.mimeType).toBe('audio/mpeg');
  });

  it('falls back to cloudFileName for name', () => {
    const att = makeAttachment({
      type: 'image',
      name: undefined,
      cloudFileName: 'cloud-photo.jpg',
    });
    const result = assetFromAttachment(att);
    expect(result.name).toBe('cloud-photo.jpg');
  });

  it('falls back to fileName for name', () => {
    const att = makeAttachment({
      type: 'pdf',
      name: undefined,
      cloudFileName: undefined,
      fileName: 'local-file.pdf',
    });
    const result = assetFromAttachment(att);
    expect(result.name).toBe('local-file.pdf');
  });

  it('falls back to type-based name as last resort', () => {
    const att = makeAttachment({
      type: 'audio',
      name: undefined,
      cloudFileName: undefined,
      fileName: undefined,
    });
    const result = assetFromAttachment(att);
    expect(result.name).toBe('audio attachment');
  });

  it('prefers fileSize over cloudFileSize for size', () => {
    const att = makeAttachment({
      type: 'image',
      name: 'img',
      fileSize: 100,
      cloudFileSize: 200,
    });
    const result = assetFromAttachment(att);
    expect(result.size).toBe(100);
  });

  it('falls back to cloudFileSize when fileSize is missing', () => {
    const att = makeAttachment({
      type: 'image',
      name: 'img',
      fileSize: undefined,
      cloudFileSize: 200,
    });
    const result = assetFromAttachment(att);
    expect(result.size).toBe(200);
  });
});

describe('migrateAttachmentsToAssets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does nothing when no attachments need migration', async () => {
    const songs = [makeSong()];
    mockFirestoreGetAttachments.mockResolvedValue([
      makeAttachment({ assetId: 'existing-asset' }),
    ]);

    await migrateAttachmentsToAssets('user-1', songs);

    expect(mockFirestoreCreateAsset).not.toHaveBeenCalled();
    expect(mockFirestoreUpdateAttachment).not.toHaveBeenCalled();
  });

  it('skips attachments with cloudProvider set', async () => {
    const songs = [makeSong()];
    mockFirestoreGetAttachments.mockResolvedValue([
      makeAttachment({ cloudProvider: 'google-drive' }),
    ]);

    await migrateAttachmentsToAssets('user-1', songs);

    expect(mockFirestoreCreateAsset).not.toHaveBeenCalled();
  });

  it('creates asset and links it to attachment', async () => {
    const songs = [makeSong({ id: 'song-1' })];
    const att = makeAttachment({
      id: 'att-1',
      type: 'richtext',
      name: 'Notes',
      content: { type: 'doc', content: [] },
    });
    mockFirestoreGetAttachments.mockResolvedValue([att]);
    mockFirestoreCreateAsset.mockResolvedValue({ id: 'asset-1' } as Asset);

    await migrateAttachmentsToAssets('user-1', songs);

    expect(mockFirestoreCreateAsset).toHaveBeenCalledTimes(1);
    expect(mockFirestoreCreateAsset).toHaveBeenCalledWith('user-1', expect.objectContaining({
      type: 'richtext',
      name: 'Notes',
    }));
    expect(mockFirestoreUpdateAttachment).toHaveBeenCalledWith(
      'user-1', 'song-1', 'att-1', { assetId: 'asset-1' }
    );
  });

  it('derives storagePath for binary assets when missing', async () => {
    const songs = [makeSong({ id: 'song-1' })];
    const att = makeAttachment({
      id: 'att-1',
      type: 'image',
      name: 'photo.jpg',
      storageUrl: 'https://example.com/photo.jpg',
    });
    mockFirestoreGetAttachments.mockResolvedValue([att]);
    mockFirestoreCreateAsset.mockResolvedValue({ id: 'asset-1' } as Asset);

    await migrateAttachmentsToAssets('user-1', songs);

    expect(mockGetStoragePath).toHaveBeenCalledWith('user-1', 'song-1', 'att-1');
    expect(mockFirestoreCreateAsset).toHaveBeenCalledWith('user-1', expect.objectContaining({
      storagePath: 'users/user-1/songs/song-1/att-1',
    }));
  });

  it('does not derive storagePath for richtext/drawing types', async () => {
    const songs = [makeSong()];
    const att = makeAttachment({
      type: 'richtext',
      name: 'Notes',
      content: { type: 'doc', content: [] },
    });
    mockFirestoreGetAttachments.mockResolvedValue([att]);
    mockFirestoreCreateAsset.mockResolvedValue({ id: 'asset-1' } as Asset);

    await migrateAttachmentsToAssets('user-1', songs);

    expect(mockGetStoragePath).not.toHaveBeenCalled();
  });

  it('reports progress via callback', async () => {
    const songs = [makeSong({ id: 'song-1' }), makeSong({ id: 'song-2' })];
    mockFirestoreGetAttachments
      .mockResolvedValueOnce([makeAttachment({ id: 'att-1', type: 'richtext', name: 'A' })])
      .mockResolvedValueOnce([makeAttachment({ id: 'att-2', type: 'richtext', name: 'B' })]);
    mockFirestoreCreateAsset.mockResolvedValue({ id: 'asset-1' } as Asset);

    const onProgress = vi.fn();
    await migrateAttachmentsToAssets('user-1', songs, onProgress);

    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenCalledWith(1, 2);
    expect(onProgress).toHaveBeenCalledWith(2, 2);
  });

  it('continues on individual item failure', async () => {
    const songs = [makeSong({ id: 'song-1' })];
    const att1 = makeAttachment({ id: 'att-1', type: 'richtext', name: 'A' });
    const att2 = makeAttachment({ id: 'att-2', type: 'richtext', name: 'B' });
    mockFirestoreGetAttachments.mockResolvedValue([att1, att2]);
    mockFirestoreCreateAsset
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ id: 'asset-2' } as Asset);

    await migrateAttachmentsToAssets('user-1', songs);

    // Second item should still be processed
    expect(mockFirestoreCreateAsset).toHaveBeenCalledTimes(2);
    expect(mockFirestoreUpdateAttachment).toHaveBeenCalledTimes(1);
    expect(mockFirestoreUpdateAttachment).toHaveBeenCalledWith(
      'user-1', 'song-1', 'att-2', { assetId: 'asset-2' }
    );
  });

  it('processes multiple songs', async () => {
    const songs = [makeSong({ id: 'song-1' }), makeSong({ id: 'song-2' })];
    mockFirestoreGetAttachments
      .mockResolvedValueOnce([makeAttachment({ id: 'att-1', name: 'A' })])
      .mockResolvedValueOnce([makeAttachment({ id: 'att-2', name: 'B' })]);
    mockFirestoreCreateAsset.mockResolvedValue({ id: 'asset-new' } as Asset);

    await migrateAttachmentsToAssets('user-1', songs);

    expect(mockFirestoreGetAttachments).toHaveBeenCalledWith('user-1', 'song-1');
    expect(mockFirestoreGetAttachments).toHaveBeenCalledWith('user-1', 'song-2');
    expect(mockFirestoreCreateAsset).toHaveBeenCalledTimes(2);
  });
});

describe('migrateGuestAttachmentsToAssets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does nothing when no attachments need migration', () => {
    const songs = [makeSong()];
    mockStorageGetAttachments.mockReturnValue([
      makeAttachment({ assetId: 'existing-asset' }),
    ]);

    migrateGuestAttachmentsToAssets(songs);

    expect(mockStorageCreateAsset).not.toHaveBeenCalled();
    expect(mockStorageUpdateAttachment).not.toHaveBeenCalled();
  });

  it('skips attachments with cloudProvider set', () => {
    const songs = [makeSong()];
    mockStorageGetAttachments.mockReturnValue([
      makeAttachment({ cloudProvider: 'google-drive' }),
    ]);

    migrateGuestAttachmentsToAssets(songs);

    expect(mockStorageCreateAsset).not.toHaveBeenCalled();
  });

  it('creates asset in localStorage and links to attachment', () => {
    const songs = [makeSong({ id: 'song-1' })];
    const att = makeAttachment({
      id: 'att-1',
      type: 'drawing',
      name: 'Sketch',
      drawingData: { strokes: [], canvasWidth: 300, canvasHeight: 400 },
    });
    mockStorageGetAttachments.mockReturnValue([att]);
    mockGenerateId.mockReturnValue('new-asset-id');

    migrateGuestAttachmentsToAssets(songs);

    expect(mockStorageCreateAsset).toHaveBeenCalledTimes(1);
    expect(mockStorageCreateAsset).toHaveBeenCalledWith(expect.objectContaining({
      id: 'new-asset-id',
      type: 'drawing',
      name: 'Sketch',
      createdAt: '2026-06-15T12:00:00.000Z',
      updatedAt: '2026-06-15T12:00:00.000Z',
    }));
    expect(mockStorageUpdateAttachment).toHaveBeenCalledWith(
      'song-1', 'att-1', { assetId: 'new-asset-id' }
    );
  });

  it('processes multiple songs and attachments', () => {
    const songs = [makeSong({ id: 'song-1' }), makeSong({ id: 'song-2' })];
    mockStorageGetAttachments
      .mockReturnValueOnce([makeAttachment({ id: 'att-1', name: 'A' })])
      .mockReturnValueOnce([
        makeAttachment({ id: 'att-2', name: 'B' }),
        makeAttachment({ id: 'att-3', name: 'C' }),
      ]);
    mockGenerateId
      .mockReturnValueOnce('asset-1')
      .mockReturnValueOnce('asset-2')
      .mockReturnValueOnce('asset-3');

    migrateGuestAttachmentsToAssets(songs);

    expect(mockStorageCreateAsset).toHaveBeenCalledTimes(3);
    expect(mockStorageUpdateAttachment).toHaveBeenCalledTimes(3);
  });

  it('is idempotent — skips already-migrated attachments', () => {
    const songs = [makeSong()];
    mockStorageGetAttachments.mockReturnValue([
      makeAttachment({ id: 'att-1', assetId: 'already-done' }),
      makeAttachment({ id: 'att-2', name: 'Needs migration' }),
    ]);

    migrateGuestAttachmentsToAssets(songs);

    expect(mockStorageCreateAsset).toHaveBeenCalledTimes(1);
  });
});

describe('migrateAssetStoragePaths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does nothing when no assets need patching', async () => {
    mockFirestoreGetAssets.mockResolvedValue([
      { id: 'asset-1', type: 'image', storageUrl: 'https://x.com/a', storagePath: 'existing/path' },
    ]);

    await migrateAssetStoragePaths('user-1', [makeSong()]);

    expect(mockFirestoreGetAttachments).not.toHaveBeenCalled();
    expect(mockFirestoreUpdateAsset).not.toHaveBeenCalled();
  });

  it('does nothing when assets have no storageUrl', async () => {
    mockFirestoreGetAssets.mockResolvedValue([
      { id: 'asset-1', type: 'richtext', storageUrl: null, storagePath: null },
    ]);

    await migrateAssetStoragePaths('user-1', [makeSong()]);

    expect(mockFirestoreUpdateAsset).not.toHaveBeenCalled();
  });

  it('does nothing for non-binary types even with storageUrl', async () => {
    mockFirestoreGetAssets.mockResolvedValue([
      { id: 'asset-1', type: 'drawing', storageUrl: 'https://x.com/a', storagePath: null },
    ]);

    await migrateAssetStoragePaths('user-1', [makeSong()]);

    expect(mockFirestoreUpdateAsset).not.toHaveBeenCalled();
  });

  it('patches storagePath from linked attachment', async () => {
    mockFirestoreGetAssets.mockResolvedValue([
      { id: 'asset-1', type: 'image', storageUrl: 'https://x.com/photo', storagePath: null },
    ]);
    const songs = [makeSong({ id: 'song-1' })];
    mockFirestoreGetAttachments.mockResolvedValue([
      makeAttachment({ id: 'att-1', assetId: 'asset-1' }),
    ]);

    await migrateAssetStoragePaths('user-1', songs);

    expect(mockGetStoragePath).toHaveBeenCalledWith('user-1', 'song-1', 'att-1');
    expect(mockFirestoreUpdateAsset).toHaveBeenCalledWith(
      'user-1', 'asset-1', { storagePath: 'users/user-1/songs/song-1/att-1' }
    );
  });

  it('skips assets with no linked attachment found', async () => {
    mockFirestoreGetAssets.mockResolvedValue([
      { id: 'asset-orphan', type: 'pdf', storageUrl: 'https://x.com/doc', storagePath: null },
    ]);
    mockFirestoreGetAttachments.mockResolvedValue([]);

    await migrateAssetStoragePaths('user-1', [makeSong()]);

    expect(mockFirestoreUpdateAsset).not.toHaveBeenCalled();
  });

  it('continues on individual update failure', async () => {
    mockFirestoreGetAssets.mockResolvedValue([
      { id: 'asset-1', type: 'image', storageUrl: 'https://x.com/a', storagePath: null },
      { id: 'asset-2', type: 'pdf', storageUrl: 'https://x.com/b', storagePath: null },
    ]);
    const songs = [makeSong({ id: 'song-1' })];
    mockFirestoreGetAttachments.mockResolvedValue([
      makeAttachment({ id: 'att-1', assetId: 'asset-1' }),
      makeAttachment({ id: 'att-2', assetId: 'asset-2' }),
    ]);
    mockFirestoreUpdateAsset
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(undefined);

    await migrateAssetStoragePaths('user-1', songs);

    // Both should be attempted
    expect(mockFirestoreUpdateAsset).toHaveBeenCalledTimes(2);
  });

  it('handles multiple songs when building asset-to-attachment lookup', async () => {
    mockFirestoreGetAssets.mockResolvedValue([
      { id: 'asset-1', type: 'audio', storageUrl: 'https://x.com/track', storagePath: null },
    ]);
    const songs = [makeSong({ id: 'song-1' }), makeSong({ id: 'song-2' })];
    // Asset is linked to an attachment in song-2
    mockFirestoreGetAttachments
      .mockResolvedValueOnce([]) // song-1 has no matching attachment
      .mockResolvedValueOnce([makeAttachment({ id: 'att-5', assetId: 'asset-1' })]);

    await migrateAssetStoragePaths('user-1', songs);

    expect(mockGetStoragePath).toHaveBeenCalledWith('user-1', 'song-2', 'att-5');
    expect(mockFirestoreUpdateAsset).toHaveBeenCalledWith(
      'user-1', 'asset-1', { storagePath: 'users/user-1/songs/song-2/att-5' }
    );
  });
});
