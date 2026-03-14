import { renderHook, act, waitFor } from '@testing-library/react';
import { makeSetlist, resetIdCounter } from '../../test-utils';

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
    firestoreGetSetlists: vi.fn(),
    firestoreCreateSetlist: vi.fn(),
    firestoreUpdateSetlist: vi.fn(),
    firestoreDeleteSetlist: vi.fn(),
  },
  mockStorage: {
    getSetlists: vi.fn(() => []),
    createSetlist: vi.fn(),
    updateSetlist: vi.fn(),
    deleteSetlist: vi.fn(),
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

import { useSetlists } from '../useSetlists';

function setAuth(state: 'authenticated' | 'guest', uid?: string) {
  if (state === 'guest') {
    mockAuthValue.authState = 'guest' as const;
    mockAuthValue.user = null as unknown as import('firebase/auth').User;
  } else {
    mockAuthValue.authState = 'authenticated' as const;
    mockAuthValue.user = { uid: uid || 'test-user' } as import('firebase/auth').User;
  }
}

describe('useSetlists', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetIdCounter();
    setAuth('authenticated');
    mockFirestore.firestoreGetSetlists.mockResolvedValue([]);
    mockFirestore.firestoreCreateSetlist.mockImplementation(async (_uid: string, input: unknown) => ({
      ...input,
      id: 'new-setlist-id',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }));
    mockFirestore.firestoreDeleteSetlist.mockResolvedValue(true);
  });

  describe('loading', () => {
    it('loads setlists from Firestore in authenticated mode', async () => {
      const setlists = [makeSetlist({ id: 'sl1', name: 'Set 1' })];
      mockFirestore.firestoreGetSetlists.mockResolvedValue(setlists);

      const { result } = renderHook(() => useSetlists());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.setlists).toEqual(setlists);
      expect(mockFirestore.firestoreGetSetlists).toHaveBeenCalledWith('test-user');
    });

    it('loads setlists from localStorage in guest mode', async () => {
      setAuth('guest');
      const setlists = [makeSetlist({ id: 'sl1' })];
      mockStorage.getSetlists.mockReturnValue(setlists);

      const { result } = renderHook(() => useSetlists());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.setlists).toEqual(setlists);
      expect(mockStorage.getSetlists).toHaveBeenCalled();
    });

    it('sets error state when Firestore load fails', async () => {
      mockFirestore.firestoreGetSetlists.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useSetlists());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });
  });

  describe('createSetlist', () => {
    it('creates setlist via Firestore', async () => {
      const { result } = renderHook(() => useSetlists());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let created: unknown;
      await act(async () => {
        created = await result.current.createSetlist({ name: 'New Setlist', songIds: [] });
      });

      expect(created).toBeTruthy();
      expect(mockFirestore.firestoreCreateSetlist).toHaveBeenCalledWith(
        'test-user',
        expect.objectContaining({ name: 'New Setlist' })
      );
      expect(result.current.setlists).toHaveLength(1);
    });

    it('creates setlist via localStorage in guest mode', async () => {
      setAuth('guest');
      const newSetlist = makeSetlist({ id: 'guest-setlist' });
      mockStorage.getSetlists.mockReturnValue([]);
      mockStorage.createSetlist.mockReturnValue(newSetlist);

      const { result } = renderHook(() => useSetlists());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      mockStorage.getSetlists.mockReturnValue([newSetlist]);

      await act(async () => {
        await result.current.createSetlist({ name: 'Guest Setlist', songIds: [] });
      });

      expect(mockStorage.createSetlist).toHaveBeenCalled();
    });

    it('calls onError when Firestore create fails', async () => {
      mockFirestore.firestoreCreateSetlist.mockRejectedValue(new Error('fail'));

      const onError = vi.fn();
      const { result } = renderHook(() => useSetlists(onError));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        const created = await result.current.createSetlist({ name: 'Fail', songIds: [] });
        expect(created).toBeNull();
      });

      expect(onError).toHaveBeenCalledWith(expect.stringContaining('internet'));
    });
  });

  describe('updateSetlist', () => {
    it('updates setlist via Firestore', async () => {
      const setlist = makeSetlist({ id: 'sl1', name: 'Old Name' });
      mockFirestore.firestoreGetSetlists.mockResolvedValue([setlist]);
      mockFirestore.firestoreUpdateSetlist.mockResolvedValue(undefined);

      const { result } = renderHook(() => useSetlists());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.updateSetlist('sl1', { name: 'New Name' });
      });

      expect(mockFirestore.firestoreUpdateSetlist).toHaveBeenCalledWith('test-user', 'sl1', { name: 'New Name' });
      expect(result.current.setlists[0].name).toBe('New Name');
    });
  });

  describe('deleteSetlist', () => {
    it('deletes setlist via Firestore', async () => {
      const setlist = makeSetlist({ id: 'sl1' });
      mockFirestore.firestoreGetSetlists.mockResolvedValue([setlist]);

      const { result } = renderHook(() => useSetlists());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        const deleted = await result.current.deleteSetlist('sl1');
        expect(deleted).toBe(true);
      });

      expect(mockFirestore.firestoreDeleteSetlist).toHaveBeenCalledWith('test-user', 'sl1');
      expect(result.current.setlists).toHaveLength(0);
    });

    it('calls onError when Firestore delete fails', async () => {
      const setlist = makeSetlist({ id: 'sl1' });
      mockFirestore.firestoreGetSetlists.mockResolvedValue([setlist]);
      mockFirestore.firestoreDeleteSetlist.mockRejectedValue(new Error('fail'));

      const onError = vi.fn();
      const { result } = renderHook(() => useSetlists(onError));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        const deleted = await result.current.deleteSetlist('sl1');
        expect(deleted).toBe(false);
      });

      expect(onError).toHaveBeenCalledWith(expect.stringContaining('delete'));
    });
  });

  describe('addSongToSetlist', () => {
    it('adds song to setlist via Firestore', async () => {
      const setlist = makeSetlist({ id: 'sl1', songIds: ['song1'] });
      mockFirestore.firestoreGetSetlists.mockResolvedValue([setlist]);
      mockFirestore.firestoreUpdateSetlist.mockResolvedValue(undefined);

      const { result } = renderHook(() => useSetlists());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        const updated = await result.current.addSongToSetlist('sl1', 'song2');
        expect(updated).toBeTruthy();
      });

      expect(mockFirestore.firestoreUpdateSetlist).toHaveBeenCalledWith(
        'test-user', 'sl1',
        { songIds: ['song1', 'song2'] }
      );
    });

    it('does not add duplicate song', async () => {
      const setlist = makeSetlist({ id: 'sl1', songIds: ['song1'] });
      mockFirestore.firestoreGetSetlists.mockResolvedValue([setlist]);

      const { result } = renderHook(() => useSetlists());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.addSongToSetlist('sl1', 'song1');
      });

      expect(mockFirestore.firestoreUpdateSetlist).not.toHaveBeenCalled();
    });
  });

  describe('removeSongFromSetlist', () => {
    it('removes song from setlist via Firestore', async () => {
      const setlist = makeSetlist({ id: 'sl1', songIds: ['song1', 'song2'] });
      mockFirestore.firestoreGetSetlists.mockResolvedValue([setlist]);
      mockFirestore.firestoreUpdateSetlist.mockResolvedValue(undefined);

      const { result } = renderHook(() => useSetlists());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.removeSongFromSetlist('sl1', 'song1');
      });

      expect(mockFirestore.firestoreUpdateSetlist).toHaveBeenCalledWith(
        'test-user', 'sl1',
        { songIds: ['song2'] }
      );
    });
  });

  describe('reorderSongs', () => {
    it('reorders songs via Firestore', async () => {
      const setlist = makeSetlist({ id: 'sl1', songIds: ['s1', 's2', 's3'] });
      mockFirestore.firestoreGetSetlists.mockResolvedValue([setlist]);
      mockFirestore.firestoreUpdateSetlist.mockResolvedValue(undefined);

      const { result } = renderHook(() => useSetlists());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.reorderSongs('sl1', ['s3', 's1', 's2']);
      });

      expect(mockFirestore.firestoreUpdateSetlist).toHaveBeenCalledWith(
        'test-user', 'sl1',
        { songIds: ['s3', 's1', 's2'] }
      );
    });
  });

  describe('refresh', () => {
    it('re-fetches setlists from Firestore', async () => {
      mockFirestore.firestoreGetSetlists.mockResolvedValue([]);

      const { result } = renderHook(() => useSetlists());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const newSetlists = [makeSetlist({ id: 'refreshed' })];
      mockFirestore.firestoreGetSetlists.mockResolvedValue(newSetlists);

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.setlists).toEqual(newSetlists);
    });
  });
});
