/**
 * Tests for guest-blob-storage.ts — IndexedDB-backed blob storage for guest mode.
 *
 * Mocks idb-keyval with an in-memory Map to simulate IDB objectStore.
 */

// --- In-memory IDB mock (vi.hoisted so available in vi.mock factories) ---

const { mockStore, mockGet, mockSet, mockDel, mockKeys } = vi.hoisted(() => {
  const store = new Map<string, unknown>();

  return {
    mockStore: store,
    mockGet: vi.fn(async (key: string) => store.get(key)),
    mockSet: vi.fn(async (key: string, value: unknown) => { store.set(key, value); }),
    mockDel: vi.fn(async (key: string) => { store.delete(key); }),
    mockKeys: vi.fn(async () => [...store.keys()]),
  };
});

vi.mock('idb-keyval', () => ({
  createStore: vi.fn(() => 'mock-guest-store'),
  get: mockGet,
  set: mockSet,
  del: mockDel,
  keys: mockKeys,
}));

// Must import after vi.mock
import {
  getGuestBlob,
  saveGuestBlob,
  deleteGuestBlob,
  deleteAllGuestBlobs,
  getAllGuestBlobs,
  clearAllGuestBlobs,
} from '../guest-blob-storage';

// --- Helpers ---

function makeBlob(size: number, type = 'application/octet-stream'): Blob {
  return new Blob([new Uint8Array(size)], { type });
}

// --- Tests ---

describe('guest-blob-storage', () => {
  beforeEach(() => {
    mockStore.clear();
    vi.clearAllMocks();
    // Re-bind default implementations after clearAllMocks
    mockGet.mockImplementation(async (key: string) => mockStore.get(key));
    mockSet.mockImplementation(async (key: string, value: unknown) => { mockStore.set(key, value); });
    mockDel.mockImplementation(async (key: string) => { mockStore.delete(key); });
    mockKeys.mockImplementation(async () => [...mockStore.keys()]);
  });

  // ---------- saveGuestBlob ----------

  describe('saveGuestBlob', () => {
    it('stores a blob keyed by songId and attachmentId', async () => {
      const blob = makeBlob(100);
      await saveGuestBlob('song-1', 'att-1', blob);

      expect(mockStore.get('guest:song-1:att-1')).toBe(blob);
      expect(mockSet).toHaveBeenCalledWith('guest:song-1:att-1', blob, 'mock-guest-store');
    });

    it('throws a user-friendly error on QuotaExceededError', async () => {
      const quotaErr = new DOMException('Quota exceeded', 'QuotaExceededError');
      mockSet.mockRejectedValueOnce(quotaErr);

      await expect(saveGuestBlob('s1', 'a1', makeBlob(10))).rejects.toThrow(
        'Storage full',
      );
    });

    it('throws a user-friendly error on legacy quota code 22', async () => {
      // Some older browsers use code 22 instead of the named error
      const legacyErr = new DOMException('quota');
      Object.defineProperty(legacyErr, 'code', { value: 22, writable: false });
      mockSet.mockRejectedValueOnce(legacyErr);

      await expect(saveGuestBlob('s1', 'a1', makeBlob(10))).rejects.toThrow(
        'Storage full',
      );
    });

    it('re-throws non-quota errors', async () => {
      mockSet.mockRejectedValueOnce(new Error('Disk I/O'));

      await expect(saveGuestBlob('s1', 'a1', makeBlob(10))).rejects.toThrow('Disk I/O');
    });
  });

  // ---------- getGuestBlob ----------

  describe('getGuestBlob', () => {
    it('returns null when blob is not stored', async () => {
      const result = await getGuestBlob('song-1', 'att-missing');
      expect(result).toBeNull();
    });

    it('returns the blob when present', async () => {
      const blob = makeBlob(200);
      mockStore.set('guest:song-2:att-2', blob);

      const result = await getGuestBlob('song-2', 'att-2');
      expect(result).toBe(blob);
    });

    it('returns null on IDB error', async () => {
      mockGet.mockRejectedValueOnce(new Error('IDB fail'));

      const result = await getGuestBlob('song-1', 'att-1');
      expect(result).toBeNull();
    });
  });

  // ---------- deleteGuestBlob ----------

  describe('deleteGuestBlob', () => {
    it('deletes the specified blob', async () => {
      mockStore.set('guest:song-3:att-3', makeBlob(50));

      await deleteGuestBlob('song-3', 'att-3');
      expect(mockStore.has('guest:song-3:att-3')).toBe(false);
    });

    it('does not throw when key does not exist', async () => {
      await expect(deleteGuestBlob('no-song', 'no-att')).resolves.toBeUndefined();
    });

    it('silently ignores IDB errors', async () => {
      mockDel.mockRejectedValueOnce(new Error('delete fail'));

      await expect(deleteGuestBlob('s1', 'a1')).resolves.toBeUndefined();
    });
  });

  // ---------- deleteAllGuestBlobs ----------

  describe('deleteAllGuestBlobs', () => {
    it('deletes all blobs for a given songId', async () => {
      mockStore.set('guest:song-A:att-1', makeBlob(10));
      mockStore.set('guest:song-A:att-2', makeBlob(20));
      mockStore.set('guest:song-B:att-3', makeBlob(30));

      await deleteAllGuestBlobs('song-A');

      expect(mockStore.has('guest:song-A:att-1')).toBe(false);
      expect(mockStore.has('guest:song-A:att-2')).toBe(false);
      // song-B blob should remain
      expect(mockStore.has('guest:song-B:att-3')).toBe(true);
    });

    it('does nothing when no blobs match the songId', async () => {
      mockStore.set('guest:other:att-1', makeBlob(10));

      await deleteAllGuestBlobs('no-match');

      expect(mockStore.size).toBe(1);
    });

    it('silently ignores IDB errors', async () => {
      mockKeys.mockRejectedValueOnce(new Error('keys fail'));

      await expect(deleteAllGuestBlobs('song-1')).resolves.toBeUndefined();
    });
  });

  // ---------- getAllGuestBlobs ----------

  describe('getAllGuestBlobs', () => {
    it('returns empty array when no guest blobs exist', async () => {
      const result = await getAllGuestBlobs();
      expect(result).toEqual([]);
    });

    it('returns all guest blobs with parsed songId and attachmentId', async () => {
      const blob1 = makeBlob(100);
      const blob2 = makeBlob(200);
      mockStore.set('guest:song-X:att-1', blob1);
      mockStore.set('guest:song-Y:att-2', blob2);

      const result = await getAllGuestBlobs();

      expect(result).toHaveLength(2);
      expect(result).toContainEqual({ songId: 'song-X', attachmentId: 'att-1', blob: blob1 });
      expect(result).toContainEqual({ songId: 'song-Y', attachmentId: 'att-2', blob: blob2 });
    });

    it('ignores keys that do not start with "guest:"', async () => {
      mockStore.set('other-prefix:data', makeBlob(10));
      mockStore.set('guest:s1:a1', makeBlob(10));

      const result = await getAllGuestBlobs();
      expect(result).toHaveLength(1);
      expect(result[0].songId).toBe('s1');
    });

    it('ignores keys that do not have exactly 3 parts', async () => {
      mockStore.set('guest:only-two', makeBlob(10));
      mockStore.set('guest:too:many:parts', makeBlob(10));
      mockStore.set('guest:valid:key', makeBlob(10));

      const result = await getAllGuestBlobs();
      expect(result).toHaveLength(1);
      expect(result[0].songId).toBe('valid');
    });

    it('skips entries where the blob is null/undefined', async () => {
      mockStore.set('guest:s1:a1', null);
      mockStore.set('guest:s2:a2', makeBlob(10));

      const result = await getAllGuestBlobs();
      expect(result).toHaveLength(1);
      expect(result[0].songId).toBe('s2');
    });

    it('returns empty array on IDB error', async () => {
      mockKeys.mockRejectedValueOnce(new Error('IDB fail'));

      const result = await getAllGuestBlobs();
      expect(result).toEqual([]);
    });
  });

  // ---------- clearAllGuestBlobs ----------

  describe('clearAllGuestBlobs', () => {
    it('deletes all keys starting with "guest:"', async () => {
      mockStore.set('guest:s1:a1', makeBlob(10));
      mockStore.set('guest:s2:a2', makeBlob(20));
      mockStore.set('non-guest-key', 'other data');

      await clearAllGuestBlobs();

      expect(mockStore.has('guest:s1:a1')).toBe(false);
      expect(mockStore.has('guest:s2:a2')).toBe(false);
      // Non-guest keys should remain
      expect(mockStore.has('non-guest-key')).toBe(true);
    });

    it('does nothing when store has no guest keys', async () => {
      mockStore.set('other-key', 'value');

      await clearAllGuestBlobs();

      expect(mockStore.size).toBe(1);
    });

    it('silently ignores IDB errors', async () => {
      mockKeys.mockRejectedValueOnce(new Error('keys fail'));

      await expect(clearAllGuestBlobs()).resolves.toBeUndefined();
    });
  });
});
