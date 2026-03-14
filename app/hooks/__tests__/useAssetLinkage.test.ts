import { renderHook, act, waitFor } from '@testing-library/react';

const { mockUseAuth, mockStorageGetAttachments, mockFirestoreGetAttachments } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockStorageGetAttachments: vi.fn(),
  mockFirestoreGetAttachments: vi.fn(),
}));

vi.mock('../useAuth', () => ({
  useAuth: mockUseAuth,
}));

vi.mock('../../lib/storage', () => ({
  storage: {
    getAttachments: mockStorageGetAttachments,
  },
}));

vi.mock('../../lib/firestore', () => ({
  firestoreGetAttachments: mockFirestoreGetAttachments,
}));

import { useAssetLinkage } from '../useAssetLinkage';
import type { Song } from '../../types';

function makeSong(id: string, name: string): Song {
  return {
    id,
    name,
    bpm: 120,
    timeSignature: '4/4',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };
}

describe('useAssetLinkage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: null, authState: 'loading' });
    mockStorageGetAttachments.mockReturnValue([]);
    mockFirestoreGetAttachments.mockResolvedValue([]);
  });

  it('returns empty linkage map initially', () => {
    mockUseAuth.mockReturnValue({ user: null, authState: 'loading' });
    const songs: Song[] = [];
    const { result } = renderHook(() => useAssetLinkage(songs));
    expect(result.current.linkage).toEqual({});
  });

  it('does not scan when authState is loading', async () => {
    mockUseAuth.mockReturnValue({ user: null, authState: 'loading' });
    const songs = [makeSong('s1', 'Song 1')];
    renderHook(() => useAssetLinkage(songs));

    // Give time for effect to run
    await new Promise(r => setTimeout(r, 10));

    expect(mockStorageGetAttachments).not.toHaveBeenCalled();
    expect(mockFirestoreGetAttachments).not.toHaveBeenCalled();
  });

  it('does not scan when authState is unauthenticated', async () => {
    mockUseAuth.mockReturnValue({ user: null, authState: 'unauthenticated' });
    const songs = [makeSong('s1', 'Song 1')];
    renderHook(() => useAssetLinkage(songs));

    await new Promise(r => setTimeout(r, 10));

    expect(mockStorageGetAttachments).not.toHaveBeenCalled();
    expect(mockFirestoreGetAttachments).not.toHaveBeenCalled();
  });

  describe('guest mode', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({ user: null, authState: 'guest' });
    });

    it('scans localStorage attachments for guest users', async () => {
      const songs = [makeSong('s1', 'Song 1')];
      mockStorageGetAttachments.mockReturnValue([
        { id: 'att-1', assetId: 'asset-1', type: 'image', order: 0, isDefault: false, createdAt: '', updatedAt: '' },
      ]);

      const { result } = renderHook(() => useAssetLinkage(songs));

      await waitFor(() => {
        expect(result.current.linkage['asset-1']).toBeDefined();
      });

      expect(result.current.linkage['asset-1']).toEqual([{ songId: 's1', songName: 'Song 1' }]);
    });

    it('maps multiple songs to the same asset', async () => {
      const songs = [makeSong('s1', 'Song 1'), makeSong('s2', 'Song 2')];
      mockStorageGetAttachments.mockImplementation((songId: string) => [
        { id: `att-${songId}`, assetId: 'shared-asset', type: 'image', order: 0, isDefault: false, createdAt: '', updatedAt: '' },
      ]);

      const { result } = renderHook(() => useAssetLinkage(songs));

      await waitFor(() => {
        expect(result.current.linkage['shared-asset']).toHaveLength(2);
      });

      const linked = result.current.linkage['shared-asset'];
      expect(linked).toContainEqual({ songId: 's1', songName: 'Song 1' });
      expect(linked).toContainEqual({ songId: 's2', songName: 'Song 2' });
    });

    it('skips attachments without assetId', async () => {
      const songs = [makeSong('s1', 'Song 1')];
      mockStorageGetAttachments.mockReturnValue([
        { id: 'att-1', type: 'richtext', order: 0, isDefault: true, createdAt: '', updatedAt: '' },
      ]);

      const { result } = renderHook(() => useAssetLinkage(songs));

      // Wait for effect
      await new Promise(r => setTimeout(r, 10));

      expect(result.current.linkage).toEqual({});
    });

    it('deduplicates same song linking same asset', async () => {
      const songs = [makeSong('s1', 'Song 1')];
      mockStorageGetAttachments.mockReturnValue([
        { id: 'att-1', assetId: 'asset-1', type: 'image', order: 0, isDefault: false, createdAt: '', updatedAt: '' },
        { id: 'att-2', assetId: 'asset-1', type: 'image', order: 1, isDefault: false, createdAt: '', updatedAt: '' },
      ]);

      const { result } = renderHook(() => useAssetLinkage(songs));

      await waitFor(() => {
        expect(result.current.linkage['asset-1']).toBeDefined();
      });

      // Should only have one entry for the song even though two attachments reference the same asset
      expect(result.current.linkage['asset-1']).toHaveLength(1);
    });
  });

  describe('authenticated mode', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({ user: { uid: 'user-1' }, authState: 'authenticated' });
    });

    it('scans Firestore attachments for authenticated users', async () => {
      const songs = [makeSong('s1', 'Song 1')];
      mockFirestoreGetAttachments.mockResolvedValue([
        { id: 'att-1', assetId: 'asset-1', type: 'image', order: 0, isDefault: false, createdAt: '', updatedAt: '' },
      ]);

      const { result } = renderHook(() => useAssetLinkage(songs));

      await waitFor(() => {
        expect(result.current.linkage['asset-1']).toBeDefined();
      });

      expect(mockFirestoreGetAttachments).toHaveBeenCalledWith('user-1', 's1');
      expect(result.current.linkage['asset-1']).toEqual([{ songId: 's1', songName: 'Song 1' }]);
    });

    it('handles Firestore fetch failures gracefully via allSettled', async () => {
      const songs = [makeSong('s1', 'Song 1'), makeSong('s2', 'Song 2')];
      mockFirestoreGetAttachments.mockImplementation((userId: string, songId: string) => {
        if (songId === 's1') return Promise.reject(new Error('Network error'));
        return Promise.resolve([
          { id: 'att-2', assetId: 'asset-2', type: 'image', order: 0, isDefault: false, createdAt: '', updatedAt: '' },
        ]);
      });

      const { result } = renderHook(() => useAssetLinkage(songs));

      await waitFor(() => {
        expect(result.current.linkage['asset-2']).toBeDefined();
      });

      // s1 failed but s2 succeeded
      expect(result.current.linkage['asset-2']).toEqual([{ songId: 's2', songName: 'Song 2' }]);
    });
  });

  describe('refresh', () => {
    it('triggers a rescan when refresh is called', async () => {
      mockUseAuth.mockReturnValue({ user: null, authState: 'guest' });
      const songs = [makeSong('s1', 'Song 1')];

      let callCount = 0;
      mockStorageGetAttachments.mockImplementation(() => {
        callCount++;
        return callCount === 1
          ? []
          : [{ id: 'att-1', assetId: 'asset-1', type: 'image', order: 0, isDefault: false, createdAt: '', updatedAt: '' }];
      });

      const { result } = renderHook(() => useAssetLinkage(songs));

      // Wait for first scan
      await waitFor(() => {
        expect(mockStorageGetAttachments).toHaveBeenCalled();
      });

      expect(result.current.linkage).toEqual({});

      // Trigger refresh
      act(() => {
        result.current.refresh();
      });

      await waitFor(() => {
        expect(result.current.linkage['asset-1']).toBeDefined();
      });
    });
  });

  it('returns a refresh function', () => {
    mockUseAuth.mockReturnValue({ user: null, authState: 'guest' });
    const { result } = renderHook(() => useAssetLinkage([]));
    expect(typeof result.current.refresh).toBe('function');
  });
});
