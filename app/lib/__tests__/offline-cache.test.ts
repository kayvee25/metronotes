/**
 * Tests for offline-cache.ts — IndexedDB-backed offline media cache.
 *
 * Mocks idb-keyval with an in-memory Map to simulate IDB objectStore.
 */

// --- In-memory IDB mock (vi.hoisted so available in vi.mock factories) ---

const { mockStore, mockGet, mockSet, mockDel, mockClear, mockKeys, mockEntries } = vi.hoisted(() => {
  const store = new Map<string, unknown>();

  return {
    mockStore: store,
    mockGet: vi.fn(async (key: string) => store.get(key)),
    mockSet: vi.fn(async (key: string, value: unknown) => { store.set(key, value); }),
    mockDel: vi.fn(async (key: string) => { store.delete(key); }),
    mockClear: vi.fn(async () => { store.clear(); }),
    mockKeys: vi.fn(async () => [...store.keys()]),
    mockEntries: vi.fn(async () => [...store.entries()]),
  };
});

vi.mock('idb-keyval', () => ({
  createStore: vi.fn(() => 'mock-store'),
  get: mockGet,
  set: mockSet,
  del: mockDel,
  clear: mockClear,
  keys: mockKeys,
  entries: mockEntries,
}));

// Must import after vi.mock
import {
  getCachedBlob,
  cacheBlob,
  removeCachedBlob,
  clearAllCache,
  getCacheSize,
  isCached,
  getCachedAttachmentIds,
  downloadAndCache,
  preloadAudio,
} from '../offline-cache';

// --- Helpers ---

function makeBlob(size: number, type = 'application/octet-stream'): Blob {
  return new Blob([new Uint8Array(size)], { type });
}

// --- Tests ---

describe('offline-cache', () => {
  beforeEach(() => {
    mockStore.clear();
    vi.clearAllMocks();
    // Re-bind default implementations after clearAllMocks
    mockGet.mockImplementation(async (key: string) => mockStore.get(key));
    mockSet.mockImplementation(async (key: string, value: unknown) => { mockStore.set(key, value); });
    mockDel.mockImplementation(async (key: string) => { mockStore.delete(key); });
    mockClear.mockImplementation(async () => { mockStore.clear(); });
    mockKeys.mockImplementation(async () => [...mockStore.keys()]);
    mockEntries.mockImplementation(async () => [...mockStore.entries()]);
  });

  // ---------- getCachedBlob ----------

  describe('getCachedBlob', () => {
    it('returns null when attachment is not cached', async () => {
      const result = await getCachedBlob('att-1');
      expect(result).toBeNull();
    });

    it('returns the cached blob when present', async () => {
      const blob = makeBlob(100);
      mockStore.set('attachment:att-1', blob);

      const result = await getCachedBlob('att-1');
      expect(result).toBe(blob);
    });

    it('returns null on IDB error', async () => {
      mockGet.mockRejectedValueOnce(new Error('IDB read error'));

      const result = await getCachedBlob('att-1');
      expect(result).toBeNull();
    });
  });

  // ---------- cacheBlob ----------

  describe('cacheBlob', () => {
    it('stores a blob in the cache', async () => {
      const blob = makeBlob(200);
      await cacheBlob('att-2', blob);

      expect(mockStore.get('attachment:att-2')).toBe(blob);
      expect(mockSet).toHaveBeenCalledWith('attachment:att-2', blob, 'mock-store');
    });

    it('throws a user-friendly error on QuotaExceededError', async () => {
      const quotaErr = new DOMException('Quota exceeded', 'QuotaExceededError');
      mockSet.mockRejectedValueOnce(quotaErr);

      await expect(cacheBlob('att-3', makeBlob(10))).rejects.toThrow('Storage full');
    });

    it('re-throws non-quota errors', async () => {
      mockSet.mockRejectedValueOnce(new Error('Unknown IDB error'));

      await expect(cacheBlob('att-4', makeBlob(10))).rejects.toThrow('Unknown IDB error');
    });
  });

  // ---------- removeCachedBlob ----------

  describe('removeCachedBlob', () => {
    it('deletes a cached blob', async () => {
      mockStore.set('attachment:att-5', makeBlob(50));

      await removeCachedBlob('att-5');
      expect(mockStore.has('attachment:att-5')).toBe(false);
    });

    it('does not throw when deleting a non-existent key', async () => {
      await expect(removeCachedBlob('non-existent')).resolves.toBeUndefined();
    });
  });

  // ---------- clearAllCache ----------

  describe('clearAllCache', () => {
    it('clears all entries from the store', async () => {
      mockStore.set('attachment:a1', makeBlob(10));
      mockStore.set('attachment:a2', makeBlob(20));

      await clearAllCache();
      expect(mockStore.size).toBe(0);
      expect(mockClear).toHaveBeenCalledWith('mock-store');
    });
  });

  // ---------- getCacheSize ----------

  describe('getCacheSize', () => {
    it('returns 0 for empty cache', async () => {
      const size = await getCacheSize();
      expect(size).toBe(0);
    });

    it('returns the sum of all blob sizes', async () => {
      mockStore.set('attachment:a1', makeBlob(100));
      mockStore.set('attachment:a2', makeBlob(250));

      const size = await getCacheSize();
      expect(size).toBe(350);
    });

    it('returns 0 on IDB error', async () => {
      mockEntries.mockRejectedValueOnce(new Error('read fail'));

      const size = await getCacheSize();
      expect(size).toBe(0);
    });
  });

  // ---------- isCached ----------

  describe('isCached', () => {
    it('returns false when not cached', async () => {
      expect(await isCached('missing')).toBe(false);
    });

    it('returns true when cached', async () => {
      mockStore.set('attachment:present', makeBlob(10));
      expect(await isCached('present')).toBe(true);
    });

    it('returns false on IDB error', async () => {
      mockGet.mockRejectedValueOnce(new Error('fail'));
      expect(await isCached('any')).toBe(false);
    });
  });

  // ---------- getCachedAttachmentIds ----------

  describe('getCachedAttachmentIds', () => {
    it('returns empty set when cache is empty', async () => {
      const ids = await getCachedAttachmentIds();
      expect(ids.size).toBe(0);
    });

    it('returns attachment IDs stripped of the key prefix', async () => {
      mockStore.set('attachment:id-1', makeBlob(10));
      mockStore.set('attachment:id-2', makeBlob(10));

      const ids = await getCachedAttachmentIds();
      expect(ids).toEqual(new Set(['id-1', 'id-2']));
    });

    it('ignores keys that do not start with "attachment:"', async () => {
      mockStore.set('other-key', 'value');
      mockStore.set('attachment:id-3', makeBlob(10));

      const ids = await getCachedAttachmentIds();
      expect(ids).toEqual(new Set(['id-3']));
    });

    it('returns empty set on IDB error', async () => {
      mockKeys.mockRejectedValueOnce(new Error('fail'));
      const ids = await getCachedAttachmentIds();
      expect(ids.size).toBe(0);
    });
  });

  // ---------- downloadAndCache ----------

  describe('downloadAndCache', () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
      globalThis.fetch = vi.fn();
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('returns true immediately if already cached', async () => {
      mockStore.set('attachment:dl-1', makeBlob(10));

      const result = await downloadAndCache('dl-1', 'https://example.com/file.mp3');
      expect(result).toBe(true);
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('fetches and caches the blob on success', async () => {
      const blob = makeBlob(300);
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(blob),
      });

      const result = await downloadAndCache('dl-2', 'https://example.com/file.mp3');
      expect(result).toBe(true);
      expect(mockStore.get('attachment:dl-2')).toBe(blob);
    });

    it('returns false when fetch response is not ok', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await downloadAndCache('dl-3', 'https://example.com/missing');
      expect(result).toBe(false);
    });

    it('returns false when fetch throws a network error', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new TypeError('Network error'));

      const result = await downloadAndCache('dl-4', 'https://example.com/fail');
      expect(result).toBe(false);
    });

    it('re-throws storage-full errors from cacheBlob', async () => {
      const blob = makeBlob(10);
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(blob),
      });
      mockSet.mockRejectedValueOnce(new DOMException('Quota exceeded', 'QuotaExceededError'));

      await expect(downloadAndCache('dl-5', 'https://example.com/big')).rejects.toThrow('Storage full');
    });
  });

  // ---------- preloadAudio ----------

  describe('preloadAudio', () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
      globalThis.fetch = vi.fn();
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('does nothing when there are no audio attachments', async () => {
      await expect(preloadAudio([
        { id: 'img-1', type: 'image', storageUrl: 'https://example.com/img.png' },
      ])).resolves.toBeUndefined();
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('downloads the first audio attachment', async () => {
      const blob = makeBlob(500);
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(blob),
      });

      await preloadAudio([
        { id: 'audio-1', type: 'audio', storageUrl: 'https://example.com/track.mp3' },
      ]);

      expect(globalThis.fetch).toHaveBeenCalledWith('https://example.com/track.mp3');
      expect(mockStore.get('attachment:audio-1')).toBe(blob);
    });

    it('does not throw on fetch failure', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('offline'));

      await expect(preloadAudio([
        { id: 'audio-2', type: 'audio', storageUrl: 'https://example.com/track.mp3' },
      ])).resolves.toBeUndefined();
    });

    it('does not throw on quota error', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(makeBlob(10)),
      });
      mockSet.mockRejectedValueOnce(new DOMException('Quota exceeded', 'QuotaExceededError'));

      await expect(preloadAudio([
        { id: 'audio-3', type: 'audio', storageUrl: 'https://example.com/track.mp3' },
      ])).resolves.toBeUndefined();
    });

    it('skips audio without storageUrl or cloud link', async () => {
      await preloadAudio([
        { id: 'audio-4', type: 'audio' },
      ]);
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });
  });
});
