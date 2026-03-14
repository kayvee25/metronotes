import { renderHook, act, waitFor } from '@testing-library/react';
import { makeAttachment, resetIdCounter } from '../../test-utils';

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
    firestoreGetAttachments: vi.fn(),
    firestoreCreateAttachment: vi.fn(),
    firestoreUpdateAttachment: vi.fn(),
    firestoreDeleteAttachment: vi.fn(),
    firestoreDeleteAllAttachments: vi.fn(),
    firestoreReorderAttachments: vi.fn(),
    firestoreCreateAsset: vi.fn(),
    firestoreUpdateAsset: vi.fn(),
    firestoreDeleteAsset: vi.fn(),
  },
  mockStorage: {
    getAttachments: vi.fn(() => []),
    createAttachment: vi.fn(),
    updateAttachment: vi.fn(),
    deleteAttachment: vi.fn(),
    deleteAllAttachments: vi.fn(),
    reorderAttachments: vi.fn(),
    createAsset: vi.fn(),
    updateAsset: vi.fn(),
  },
}));

vi.mock('../useAuth', () => ({
  useAuth: () => mockAuthValue,
}));

vi.mock('../../lib/firestore', () => mockFirestore);

vi.mock('../../lib/storage', () => ({
  storage: mockStorage,
}));

vi.mock('../../lib/storage-firebase', () => ({
  deleteAttachmentFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../lib/offline-cache', () => ({
  removeCachedBlob: vi.fn().mockResolvedValue(undefined),
  downloadAndCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../lib/guest-blob-storage', () => ({
  getGuestBlob: vi.fn().mockResolvedValue(null),
  deleteGuestBlob: vi.fn(),
}));

vi.mock('../../lib/utils', () => ({
  generateId: () => 'gen-id',
  getTimestamp: () => '2026-01-01T00:00:00.000Z',
}));

vi.mock('firebase/auth', () => ({}));
vi.mock('../../lib/firebase', () => ({ auth: {} }));

import { useAttachments } from '../useAttachments';

function setAuth(state: 'authenticated' | 'guest', uid?: string) {
  if (state === 'guest') {
    mockAuthValue.authState = 'guest' as const;
    mockAuthValue.user = null as unknown as import('firebase/auth').User;
  } else {
    mockAuthValue.authState = 'authenticated' as const;
    mockAuthValue.user = { uid: uid || 'test-user' } as import('firebase/auth').User;
  }
}

describe('useAttachments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetIdCounter();
    setAuth('authenticated');
    mockFirestore.firestoreGetAttachments.mockResolvedValue([]);
    mockFirestore.firestoreCreateAttachment.mockImplementation(async (_uid: string, _songId: string, input: unknown) => ({
      ...input,
      id: 'new-att-id',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }));
    mockFirestore.firestoreCreateAsset.mockImplementation(async (_uid: string, input: unknown) => ({
      ...input,
      id: 'new-asset-id',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }));
    mockFirestore.firestoreDeleteAttachment.mockResolvedValue(undefined);
    mockFirestore.firestoreDeleteAllAttachments.mockResolvedValue(undefined);
    mockFirestore.firestoreUpdateAttachment.mockResolvedValue(undefined);
    mockFirestore.firestoreReorderAttachments.mockResolvedValue(undefined);
    mockFirestore.firestoreDeleteAsset.mockResolvedValue(undefined);
  });

  describe('loading', () => {
    it('loads attachments for a songId from Firestore', async () => {
      const atts = [makeAttachment({ id: 'att1' })];
      mockFirestore.firestoreGetAttachments.mockResolvedValue(atts);

      const { result } = renderHook(() => useAttachments('song1'));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.attachments).toEqual(atts);
      expect(mockFirestore.firestoreGetAttachments).toHaveBeenCalledWith('test-user', 'song1');
    });

    it('returns empty attachments when songId is null', async () => {
      const { result } = renderHook(() => useAttachments(null));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.attachments).toEqual([]);
      expect(mockFirestore.firestoreGetAttachments).not.toHaveBeenCalled();
    });

    it('loads attachments from localStorage in guest mode', async () => {
      setAuth('guest');
      const atts = [makeAttachment({ id: 'att1' })];
      mockStorage.getAttachments.mockReturnValue(atts);

      const { result } = renderHook(() => useAttachments('song1'));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.attachments).toEqual(atts);
      expect(mockStorage.getAttachments).toHaveBeenCalledWith('song1');
    });

    it('sets error state when Firestore load fails', async () => {
      mockFirestore.firestoreGetAttachments.mockRejectedValue(new Error('fail'));

      const { result } = renderHook(() => useAttachments('song1'));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });
  });

  describe('addRichText', () => {
    it('creates rich text attachment with linked asset via Firestore', async () => {
      const { result } = renderHook(() => useAttachments('song1'));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        const att = await result.current.addRichText();
        expect(att).toBeTruthy();
      });

      expect(mockFirestore.firestoreCreateAsset).toHaveBeenCalled();
      expect(mockFirestore.firestoreCreateAttachment).toHaveBeenCalled();
      expect(result.current.attachments).toHaveLength(1);
    });

    it('creates rich text via localStorage in guest mode', async () => {
      setAuth('guest');
      mockStorage.getAttachments.mockReturnValue([]);
      const newAtt = makeAttachment({ id: 'guest-att', type: 'richtext' });
      mockStorage.createAttachment.mockReturnValue(newAtt);

      const { result } = renderHook(() => useAttachments('song1'));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      mockStorage.getAttachments.mockReturnValue([newAtt]);

      await act(async () => {
        await result.current.addRichText();
      });

      expect(mockStorage.createAsset).toHaveBeenCalled();
      expect(mockStorage.createAttachment).toHaveBeenCalled();
    });

    it('calls onError when Firestore create fails', async () => {
      mockFirestore.firestoreCreateAsset.mockRejectedValue(new Error('fail'));

      const onError = vi.fn();
      const { result } = renderHook(() => useAttachments('song1', onError));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let threwError = false;
      await act(async () => {
        try {
          await result.current.addRichText();
        } catch {
          threwError = true;
        }
      });

      expect(threwError).toBe(true);
      expect(onError).toHaveBeenCalledWith(expect.stringContaining('internet'));
    });
  });

  describe('updateAttachment', () => {
    it('updates attachment via Firestore', async () => {
      const att = makeAttachment({ id: 'att1', name: 'Old' });
      mockFirestore.firestoreGetAttachments.mockResolvedValue([att]);

      const { result } = renderHook(() => useAttachments('song1'));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.updateAttachment('att1', { name: 'New' });
      });

      expect(mockFirestore.firestoreUpdateAttachment).toHaveBeenCalledWith('test-user', 'song1', 'att1', { name: 'New' });
    });
  });

  describe('deleteAttachment', () => {
    it('deletes attachment via Firestore', async () => {
      const att = makeAttachment({ id: 'att1', isDefault: false });
      mockFirestore.firestoreGetAttachments.mockResolvedValue([att]);

      const { result } = renderHook(() => useAttachments('song1'));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.deleteAttachment('att1');
      });

      expect(mockFirestore.firestoreDeleteAttachment).toHaveBeenCalledWith('test-user', 'song1', 'att1');
      expect(result.current.attachments).toHaveLength(0);
    });

    it('reassigns default when deleting default attachment', async () => {
      const att1 = makeAttachment({ id: 'att1', isDefault: true, order: 0 });
      const att2 = makeAttachment({ id: 'att2', isDefault: false, order: 1 });
      mockFirestore.firestoreGetAttachments.mockResolvedValue([att1, att2]);

      const { result } = renderHook(() => useAttachments('song1'));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.deleteAttachment('att1');
      });

      // Should call firestoreUpdateAttachment to set att2 as default
      expect(mockFirestore.firestoreUpdateAttachment).toHaveBeenCalledWith(
        'test-user', 'song1', 'att2', { isDefault: true }
      );
    });

    it('calls onError when Firestore delete fails', async () => {
      const att = makeAttachment({ id: 'att1' });
      mockFirestore.firestoreGetAttachments.mockResolvedValue([att]);
      mockFirestore.firestoreDeleteAttachment.mockRejectedValue(new Error('fail'));

      const onError = vi.fn();
      const { result } = renderHook(() => useAttachments('song1', onError));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.deleteAttachment('att1');
      });

      expect(onError).toHaveBeenCalledWith(expect.stringContaining('delete'));
    });
  });

  describe('deleteAllAttachments', () => {
    it('deletes all attachments via Firestore', async () => {
      const atts = [makeAttachment({ id: 'att1' }), makeAttachment({ id: 'att2' })];
      mockFirestore.firestoreGetAttachments.mockResolvedValue(atts);

      const { result } = renderHook(() => useAttachments('song1'));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.deleteAllAttachments();
      });

      expect(mockFirestore.firestoreDeleteAllAttachments).toHaveBeenCalledWith('test-user', 'song1');
      expect(result.current.attachments).toHaveLength(0);
    });
  });

  describe('reorderAttachments', () => {
    it('reorders attachments via Firestore', async () => {
      const atts = [
        makeAttachment({ id: 'att1', order: 0 }),
        makeAttachment({ id: 'att2', order: 1 }),
      ];
      mockFirestore.firestoreGetAttachments.mockResolvedValue(atts);

      const { result } = renderHook(() => useAttachments('song1'));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.reorderAttachments(['att2', 'att1']);
      });

      expect(mockFirestore.firestoreReorderAttachments).toHaveBeenCalledWith('test-user', 'song1', ['att2', 'att1']);
    });
  });

  describe('setDefault', () => {
    it('sets default attachment via Firestore', async () => {
      const atts = [
        makeAttachment({ id: 'att1', isDefault: true }),
        makeAttachment({ id: 'att2', isDefault: false }),
      ];
      mockFirestore.firestoreGetAttachments.mockResolvedValue(atts);

      const { result } = renderHook(() => useAttachments('song1'));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.setDefault('att2');
      });

      // Should update both attachments
      expect(mockFirestore.firestoreUpdateAttachment).toHaveBeenCalledTimes(2);
      // att2 should now be default
      expect(result.current.attachments.find(a => a.id === 'att2')?.isDefault).toBe(true);
      expect(result.current.attachments.find(a => a.id === 'att1')?.isDefault).toBe(false);
    });
  });
});
