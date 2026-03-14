import { renderHook, waitFor } from '@testing-library/react';

const { mockGetCachedBlob, mockFetchCloudBlob } = vi.hoisted(() => ({
  mockGetCachedBlob: vi.fn(),
  mockFetchCloudBlob: vi.fn(),
}));

vi.mock('../../lib/offline-cache', () => ({
  getCachedBlob: mockGetCachedBlob,
}));

vi.mock('../../lib/cloud-providers/fetch-cloud-blob', () => ({
  fetchCloudBlob: mockFetchCloudBlob,
}));

// Mock URL.createObjectURL and revokeObjectURL
const mockCreateObjectURL = vi.fn((_blob: Blob) => `blob:mock-${Math.random()}`);
const mockRevokeObjectURL = vi.fn();
globalThis.URL.createObjectURL = mockCreateObjectURL;
globalThis.URL.revokeObjectURL = mockRevokeObjectURL;

import { useCachedUrl } from '../useCachedUrl';

describe('useCachedUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCachedBlob.mockResolvedValue(null);
  });

  it('starts in loading state', () => {
    const { result } = renderHook(() => useCachedUrl('att-1', 'https://example.com/file.png', true));
    expect(result.current.loading).toBe(true);
    expect(result.current.url).toBeNull();
  });

  it('returns null when attachmentId is undefined', async () => {
    const { result } = renderHook(() => useCachedUrl(undefined, 'https://example.com/file.png', true));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.url).toBeNull();
    expect(result.current.fromCache).toBe(false);
  });

  it('returns null when storageUrl is undefined and no cloud info', async () => {
    const { result } = renderHook(() => useCachedUrl('att-1', undefined, true));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.url).toBeNull();
  });

  it('returns cached blob URL when cache hit', async () => {
    const mockBlob = new Blob(['test'], { type: 'image/png' });
    mockGetCachedBlob.mockResolvedValue(mockBlob);
    mockCreateObjectURL.mockReturnValue('blob:cached-url');

    const { result } = renderHook(() => useCachedUrl('att-1', 'https://example.com/file.png', true));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.url).toBe('blob:cached-url');
    expect(result.current.fromCache).toBe(true);
    expect(mockCreateObjectURL).toHaveBeenCalledWith(mockBlob);
  });

  it('returns storageUrl when no cache and online', async () => {
    mockGetCachedBlob.mockResolvedValue(null);

    const { result } = renderHook(() => useCachedUrl('att-1', 'https://example.com/file.png', true));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.url).toBe('https://example.com/file.png');
    expect(result.current.fromCache).toBe(false);
  });

  it('returns null when no cache and offline with storageUrl', async () => {
    mockGetCachedBlob.mockResolvedValue(null);

    const { result } = renderHook(() => useCachedUrl('att-1', 'https://example.com/file.png', false));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.url).toBeNull();
  });

  it('fetches from cloud provider when no storageUrl but cloud info present', async () => {
    mockGetCachedBlob.mockResolvedValue(null);
    const cloudBlob = new Blob(['cloud-data'], { type: 'image/png' });
    mockFetchCloudBlob.mockResolvedValue(cloudBlob);
    mockCreateObjectURL.mockReturnValue('blob:cloud-url');

    const cloud = { provider: 'gdrive', fileId: 'file-123' };
    const { result } = renderHook(() => useCachedUrl('att-1', undefined, true, cloud));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockFetchCloudBlob).toHaveBeenCalledWith('gdrive', 'file-123', 'att-1');
    expect(result.current.url).toBe('blob:cloud-url');
    expect(result.current.needsReauth).toBe(false);
  });

  it('sets needsReauth when cloud fetch fails with auth error', async () => {
    mockGetCachedBlob.mockResolvedValue(null);
    mockFetchCloudBlob.mockRejectedValue(new Error('Not authorized'));

    const cloud = { provider: 'gdrive', fileId: 'file-123' };
    const { result } = renderHook(() => useCachedUrl('att-1', undefined, true, cloud));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.needsReauth).toBe(true);
    expect(result.current.url).toBeNull();
  });

  it('sets needsReauth for access denied error', async () => {
    mockGetCachedBlob.mockResolvedValue(null);
    mockFetchCloudBlob.mockRejectedValue(new Error('access denied'));

    const cloud = { provider: 'gdrive', fileId: 'file-123' };
    const { result } = renderHook(() => useCachedUrl('att-1', undefined, true, cloud));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.needsReauth).toBe(true);
  });

  it('does not set needsReauth for non-auth errors', async () => {
    mockGetCachedBlob.mockResolvedValue(null);
    mockFetchCloudBlob.mockRejectedValue(new Error('Network timeout'));

    const cloud = { provider: 'gdrive', fileId: 'file-123' };
    const { result } = renderHook(() => useCachedUrl('att-1', undefined, true, cloud));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.needsReauth).toBe(false);
    expect(result.current.url).toBeNull();
  });

  it('does not fetch cloud when offline', async () => {
    mockGetCachedBlob.mockResolvedValue(null);

    const cloud = { provider: 'gdrive', fileId: 'file-123' };
    const { result } = renderHook(() => useCachedUrl('att-1', undefined, false, cloud));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockFetchCloudBlob).not.toHaveBeenCalled();
    expect(result.current.url).toBeNull();
  });

  it('revokes object URL on unmount', async () => {
    const mockBlob = new Blob(['test'], { type: 'image/png' });
    mockGetCachedBlob.mockResolvedValue(mockBlob);
    mockCreateObjectURL.mockReturnValue('blob:to-revoke');

    const { result, unmount } = renderHook(() => useCachedUrl('att-1', 'https://example.com/file.png', true));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    unmount();

    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:to-revoke');
  });

  it('falls back to storageUrl on getCachedBlob rejection when online', async () => {
    mockGetCachedBlob.mockRejectedValue(new Error('IndexedDB error'));

    const { result } = renderHook(() => useCachedUrl('att-1', 'https://example.com/file.png', true));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.url).toBe('https://example.com/file.png');
    expect(result.current.fromCache).toBe(false);
  });

  it('falls back to null on getCachedBlob rejection when offline', async () => {
    mockGetCachedBlob.mockRejectedValue(new Error('IndexedDB error'));

    const { result } = renderHook(() => useCachedUrl('att-1', 'https://example.com/file.png', false));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.url).toBeNull();
  });

  it('prefers cached blob over storageUrl', async () => {
    const mockBlob = new Blob(['cached'], { type: 'image/png' });
    mockGetCachedBlob.mockResolvedValue(mockBlob);
    mockCreateObjectURL.mockReturnValue('blob:cached');

    const { result } = renderHook(() => useCachedUrl('att-1', 'https://example.com/file.png', true));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.url).toBe('blob:cached');
    expect(result.current.fromCache).toBe(true);
  });
});
