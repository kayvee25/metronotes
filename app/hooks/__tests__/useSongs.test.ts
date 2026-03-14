import { renderHook, act, waitFor } from '@testing-library/react';
import { makeSong, resetIdCounter } from '../../test-utils';

// --- Mocks (vi.hoisted so they're available in vi.mock factories) ---

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
    firestoreGetSongs: vi.fn(),
    firestoreCreateSong: vi.fn(),
    firestoreUpdateSong: vi.fn(),
    firestoreDeleteSong: vi.fn(),
    firestoreDeleteAllAttachments: vi.fn(),
    firestoreGetAttachments: vi.fn(),
    firestoreDeleteAsset: vi.fn(),
  },
  mockStorage: {
    getSongs: vi.fn(() => []),
    createSong: vi.fn(),
    updateSong: vi.fn(),
    deleteSong: vi.fn(),
    getAttachments: vi.fn(() => []),
    deleteAllAttachments: vi.fn(),
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

vi.mock('../../lib/constants', () => ({
  GUEST: { MAX_SONGS: 3 },
}));

vi.mock('../../lib/guest-blob-storage', () => ({
  deleteAllGuestBlobs: vi.fn(),
}));

vi.mock('firebase/auth', () => ({}));
vi.mock('../../lib/firebase', () => ({ auth: {} }));

import { useSongs } from '../useSongs';

function setAuth(state: 'authenticated' | 'guest', uid?: string) {
  if (state === 'guest') {
    mockAuthValue.authState = 'guest' as const;
    mockAuthValue.user = null as unknown as import('firebase/auth').User;
  } else {
    mockAuthValue.authState = 'authenticated' as const;
    mockAuthValue.user = { uid: uid || 'test-user' } as import('firebase/auth').User;
  }
}

describe('useSongs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetIdCounter();
    setAuth('authenticated');
    mockFirestore.firestoreGetSongs.mockResolvedValue([]);
    mockFirestore.firestoreCreateSong.mockImplementation(async (_uid: string, input: unknown) => ({
      ...input,
      id: 'new-song-id',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }));
    mockFirestore.firestoreDeleteSong.mockResolvedValue(true);
    mockFirestore.firestoreDeleteAllAttachments.mockResolvedValue(undefined);
    mockFirestore.firestoreGetAttachments.mockResolvedValue([]);
  });

  describe('loading', () => {
    it('loads songs from Firestore in authenticated mode', async () => {
      const songs = [makeSong({ id: 's1', name: 'Song 1' })];
      mockFirestore.firestoreGetSongs.mockResolvedValue(songs);

      const { result } = renderHook(() => useSongs());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.songs).toEqual(songs);
      expect(mockFirestore.firestoreGetSongs).toHaveBeenCalledWith('test-user');
    });

    it('loads songs from localStorage in guest mode', async () => {
      setAuth('guest');
      const songs = [makeSong({ id: 's1' })];
      mockStorage.getSongs.mockReturnValue(songs);

      const { result } = renderHook(() => useSongs());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.songs).toEqual(songs);
      expect(mockStorage.getSongs).toHaveBeenCalled();
    });

    it('sets error state when Firestore load fails', async () => {
      mockFirestore.firestoreGetSongs.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useSongs());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
    });
  });

  describe('createSong', () => {
    it('creates song via Firestore in authenticated mode', async () => {
      mockFirestore.firestoreGetSongs.mockResolvedValue([]);

      const { result } = renderHook(() => useSongs());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let created: unknown;
      await act(async () => {
        created = await result.current.createSong({ name: 'New Song', bpm: 120, timeSignature: '4/4' });
      });

      expect(created).toBeTruthy();
      expect(mockFirestore.firestoreCreateSong).toHaveBeenCalledWith('test-user', expect.objectContaining({ name: 'New Song' }));
      expect(result.current.songs).toHaveLength(1);
    });

    it('creates song via localStorage in guest mode', async () => {
      setAuth('guest');
      const newSong = makeSong({ id: 'guest-song' });
      mockStorage.getSongs.mockReturnValue([]);
      mockStorage.createSong.mockReturnValue(newSong);

      const { result } = renderHook(() => useSongs());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      mockStorage.getSongs.mockReturnValue([newSong]);

      await act(async () => {
        await result.current.createSong({ name: 'Guest Song', bpm: 120, timeSignature: '4/4' });
      });

      expect(mockStorage.createSong).toHaveBeenCalled();
    });

    it('enforces guest song limit', async () => {
      setAuth('guest');
      const existingSongs = [makeSong(), makeSong(), makeSong()];
      mockStorage.getSongs.mockReturnValue(existingSongs);

      const onError = vi.fn();
      const { result } = renderHook(() => useSongs(onError));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        const created = await result.current.createSong({ name: 'Over Limit', bpm: 120, timeSignature: '4/4' });
        expect(created).toBeNull();
      });

      expect(onError).toHaveBeenCalledWith(expect.stringContaining('Guest mode'));
    });

    it('calls onError when Firestore create fails', async () => {
      mockFirestore.firestoreGetSongs.mockResolvedValue([]);
      mockFirestore.firestoreCreateSong.mockRejectedValue(new Error('fail'));

      const onError = vi.fn();
      const { result } = renderHook(() => useSongs(onError));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        const created = await result.current.createSong({ name: 'Fail', bpm: 120, timeSignature: '4/4' });
        expect(created).toBeNull();
      });

      expect(onError).toHaveBeenCalledWith(expect.stringContaining('internet'));
    });
  });

  describe('updateSong', () => {
    it('updates song via Firestore', async () => {
      const song = makeSong({ id: 's1', name: 'Old Name' });
      mockFirestore.firestoreGetSongs.mockResolvedValue([song]);
      mockFirestore.firestoreUpdateSong.mockResolvedValue(undefined);

      const { result } = renderHook(() => useSongs());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.updateSong('s1', { name: 'New Name' });
      });

      expect(mockFirestore.firestoreUpdateSong).toHaveBeenCalledWith('test-user', 's1', { name: 'New Name' });
      expect(result.current.songs[0].name).toBe('New Name');
    });
  });

  describe('deleteSong', () => {
    it('deletes song and cascading attachments via Firestore', async () => {
      const song = makeSong({ id: 's1' });
      mockFirestore.firestoreGetSongs.mockResolvedValue([song]);

      const { result } = renderHook(() => useSongs());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        const deleted = await result.current.deleteSong('s1');
        expect(deleted).toBe(true);
      });

      expect(mockFirestore.firestoreDeleteAllAttachments).toHaveBeenCalledWith('test-user', 's1');
      expect(mockFirestore.firestoreDeleteSong).toHaveBeenCalledWith('test-user', 's1');
      expect(result.current.songs).toHaveLength(0);
    });

    it('calls onError when Firestore delete fails', async () => {
      const song = makeSong({ id: 's1' });
      mockFirestore.firestoreGetSongs.mockResolvedValue([song]);
      mockFirestore.firestoreGetAttachments.mockRejectedValue(new Error('fail'));

      const onError = vi.fn();
      const { result } = renderHook(() => useSongs(onError));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        const deleted = await result.current.deleteSong('s1');
        expect(deleted).toBe(false);
      });

      expect(onError).toHaveBeenCalledWith(expect.stringContaining('delete'));
    });
  });

  describe('refresh', () => {
    it('re-fetches songs from Firestore', async () => {
      mockFirestore.firestoreGetSongs.mockResolvedValue([]);

      const { result } = renderHook(() => useSongs());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const newSongs = [makeSong({ id: 'refreshed' })];
      mockFirestore.firestoreGetSongs.mockResolvedValue(newSongs);

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.songs).toEqual(newSongs);
    });
  });
});
