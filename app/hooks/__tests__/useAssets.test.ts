import { renderHook, act, waitFor } from '@testing-library/react';
import { makeAsset, resetIdCounter } from '../../test-utils';

const { mockAuthValue, mockFirestore, mockStorage } = vi.hoisted(() => ({
  mockAuthValue: {
    user: { uid: 'test-user' } as import('firebase/auth').User,
    authState: 'authenticated' as const,
    signInWithGoogle: vi.fn(),
    signInWithEmail: vi.fn(),
    signUpWithEmail: vi.fn(),
    resendVerificationEmail: vi.fn(),
    resetPassword: vi.fn(),
    signOut: vi.fn(),
    enterGuestMode: vi.fn(),
    deleteAccount: vi.fn(),
  },
  mockFirestore: {
    firestoreGetAssets: vi.fn(),
    firestoreCreateAsset: vi.fn(),
    firestoreUpdateAsset: vi.fn(),
    firestoreDeleteAsset: vi.fn(),
  },
  mockStorage: {
    getAssets: vi.fn(() => []),
    createAsset: vi.fn(),
    updateAsset: vi.fn(),
    deleteAsset: vi.fn(),
  },
}));

vi.mock('../useAuth', () => ({
  useAuth: () => mockAuthValue,
}));

vi.mock('../../lib/firestore', () => mockFirestore);

vi.mock('../../lib/storage', () => ({
  storage: mockStorage,
}));

vi.mock('firebase/auth', () => ({}));
vi.mock('../../lib/firebase', () => ({ auth: {} }));

import { useAssets } from '../useAssets';

function setAuth(state: 'authenticated' | 'guest', uid?: string) {
  if (state === 'guest') {
    mockAuthValue.authState = 'guest' as const;
    mockAuthValue.user = null as unknown as import('firebase/auth').User;
  } else {
    mockAuthValue.authState = 'authenticated' as const;
    mockAuthValue.user = { uid: uid || 'test-user' } as import('firebase/auth').User;
  }
}

describe('useAssets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetIdCounter();
    setAuth('authenticated');
    mockFirestore.firestoreGetAssets.mockResolvedValue([]);
    mockFirestore.firestoreCreateAsset.mockImplementation(async (_uid: string, input: unknown) => ({
      ...input,
      id: 'new-asset-id',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }));
    mockFirestore.firestoreDeleteAsset.mockResolvedValue(undefined);
    mockFirestore.firestoreUpdateAsset.mockResolvedValue(undefined);
  });

  describe('loading', () => {
    it('loads assets from Firestore in authenticated mode', async () => {
      const assets = [makeAsset({ id: 'a1', name: 'Asset 1' })];
      mockFirestore.firestoreGetAssets.mockResolvedValue(assets);

      const { result } = renderHook(() => useAssets());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.assets).toEqual(assets);
      expect(mockFirestore.firestoreGetAssets).toHaveBeenCalledWith('test-user');
    });

    it('loads assets from localStorage in guest mode', async () => {
      setAuth('guest');
      const assets = [makeAsset({ id: 'a1' })];
      mockStorage.getAssets.mockReturnValue(assets);

      const { result } = renderHook(() => useAssets());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.assets).toEqual(assets);
      expect(mockStorage.getAssets).toHaveBeenCalled();
    });
  });

  describe('createAsset', () => {
    it('creates asset via Firestore', async () => {
      const { result } = renderHook(() => useAssets());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let created: unknown;
      await act(async () => {
        created = await result.current.createAsset({
          name: 'New Asset',
          type: 'image',
          mimeType: 'image/jpeg',
          size: 1024,
          storageUrl: null,
          storagePath: null,
        });
      });

      expect(created).toBeTruthy();
      expect(mockFirestore.firestoreCreateAsset).toHaveBeenCalledWith(
        'test-user',
        expect.objectContaining({ name: 'New Asset' })
      );
      expect(result.current.assets).toHaveLength(1);
    });

    it('creates asset via localStorage in guest mode', async () => {
      setAuth('guest');
      mockStorage.getAssets.mockReturnValue([]);

      // Mock crypto.randomUUID
      const origRandomUUID = crypto.randomUUID;
      crypto.randomUUID = vi.fn(() => 'guest-uuid');

      const { result } = renderHook(() => useAssets());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const newAsset = makeAsset({ id: 'guest-uuid' });
      mockStorage.getAssets.mockReturnValue([newAsset]);

      await act(async () => {
        await result.current.createAsset({
          name: 'Guest Asset',
          type: 'image',
          mimeType: 'image/jpeg',
          size: 512,
          storageUrl: null,
          storagePath: null,
        });
      });

      expect(mockStorage.createAsset).toHaveBeenCalled();

      crypto.randomUUID = origRandomUUID;
    });

    it('calls onError when Firestore create fails', async () => {
      mockFirestore.firestoreCreateAsset.mockRejectedValue(new Error('fail'));

      const onError = vi.fn();
      const { result } = renderHook(() => useAssets(onError));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        const created = await result.current.createAsset({
          name: 'Fail',
          type: 'image',
          mimeType: 'image/jpeg',
          size: 100,
          storageUrl: null,
          storagePath: null,
        });
        expect(created).toBeNull();
      });

      expect(onError).toHaveBeenCalledWith(expect.stringContaining('internet'));
    });
  });

  describe('updateAsset', () => {
    it('updates asset via Firestore', async () => {
      const asset = makeAsset({ id: 'a1', name: 'Old Name' });
      mockFirestore.firestoreGetAssets.mockResolvedValue([asset]);

      const { result } = renderHook(() => useAssets());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.updateAsset('a1', { name: 'New Name' });
      });

      expect(mockFirestore.firestoreUpdateAsset).toHaveBeenCalledWith('test-user', 'a1', { name: 'New Name' });
      expect(result.current.assets[0].name).toBe('New Name');
    });
  });

  describe('deleteAsset', () => {
    it('deletes asset via Firestore', async () => {
      const asset = makeAsset({ id: 'a1' });
      mockFirestore.firestoreGetAssets.mockResolvedValue([asset]);

      const { result } = renderHook(() => useAssets());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.deleteAsset('a1');
      });

      expect(mockFirestore.firestoreDeleteAsset).toHaveBeenCalledWith('test-user', 'a1');
      expect(result.current.assets).toHaveLength(0);
    });
  });

  describe('getAssetById', () => {
    it('returns asset by id', async () => {
      const assets = [makeAsset({ id: 'a1' }), makeAsset({ id: 'a2' })];
      mockFirestore.firestoreGetAssets.mockResolvedValue(assets);

      const { result } = renderHook(() => useAssets());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.getAssetById('a1')).toEqual(assets[0]);
      expect(result.current.getAssetById('nonexistent')).toBeUndefined();
    });
  });

  describe('refresh', () => {
    it('re-fetches assets from Firestore', async () => {
      mockFirestore.firestoreGetAssets.mockResolvedValue([]);

      const { result } = renderHook(() => useAssets());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const newAssets = [makeAsset({ id: 'refreshed' })];
      mockFirestore.firestoreGetAssets.mockResolvedValue(newAssets);

      await act(async () => {
        result.current.refresh();
      });

      await waitFor(() => {
        expect(result.current.assets).toEqual(newAssets);
      });
    });
  });
});
