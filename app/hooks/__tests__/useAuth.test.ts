import { renderHook, act } from '@testing-library/react';

// We need to test useAuthProvider directly (it's the actual logic hook).
// useAuth is just a context consumer.

const { mockOnAuthStateChanged, mockSignInWithPopup, mockSignInWithEmailAndPassword, mockCreateUserWithEmailAndPassword, mockSendEmailVerification, mockSendPasswordResetEmail, mockFirebaseSignOut, mockUpdateProfile, mockAuth } = vi.hoisted(() => ({
  mockOnAuthStateChanged: vi.fn(),
  mockSignInWithPopup: vi.fn(),
  mockSignInWithEmailAndPassword: vi.fn(),
  mockCreateUserWithEmailAndPassword: vi.fn(),
  mockSendEmailVerification: vi.fn(),
  mockSendPasswordResetEmail: vi.fn(),
  mockFirebaseSignOut: vi.fn(),
  mockUpdateProfile: vi.fn(),
  mockAuth: { currentUser: null as unknown },
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: mockOnAuthStateChanged,
  signInWithPopup: mockSignInWithPopup,
  signInWithEmailAndPassword: mockSignInWithEmailAndPassword,
  createUserWithEmailAndPassword: mockCreateUserWithEmailAndPassword,
  sendEmailVerification: mockSendEmailVerification,
  sendPasswordResetEmail: mockSendPasswordResetEmail,
  signOut: mockFirebaseSignOut,
  GoogleAuthProvider: vi.fn(),
  updateProfile: mockUpdateProfile,
}));

vi.mock('../../lib/firebase', () => ({
  auth: mockAuth,
}));

vi.mock('../../lib/constants', () => ({
  STORAGE_KEYS: {
    GUEST_MODE: 'metronotes_guest_mode',
    SONGS: 'metronotes_songs',
    SETLISTS: 'metronotes_setlists',
  },
}));

vi.mock('../../lib/offline-cache', () => ({
  clearAllCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../lib/guest-blob-storage', () => ({
  clearAllGuestBlobs: vi.fn().mockResolvedValue(undefined),
}));

import { useAuthProvider } from '../useAuth';

// Mock localStorage
const localStorageStore: Record<string, string> = {};
const mockLocalStorage = {
  getItem: vi.fn((key: string) => localStorageStore[key] || null),
  setItem: vi.fn((key: string, value: string) => { localStorageStore[key] = value; }),
  removeItem: vi.fn((key: string) => { delete localStorageStore[key]; }),
};
Object.defineProperty(globalThis, 'localStorage', { value: mockLocalStorage, writable: true });

describe('useAuthProvider', () => {
  let authStateCallback: ((user: unknown) => void) | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    authStateCallback = null;
    // Clear localStorage mock store
    Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]);

    // Capture the onAuthStateChanged callback
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, callback: (user: unknown) => void) => {
      authStateCallback = callback;
      return vi.fn(); // unsubscribe
    });

    mockFirebaseSignOut.mockResolvedValue(undefined);
  });

  it('starts in loading state', () => {
    const { result } = renderHook(() => useAuthProvider());
    expect(result.current.authState).toBe('loading');
    expect(result.current.user).toBeNull();
  });

  it('transitions to authenticated when verified user detected', async () => {
    const { result } = renderHook(() => useAuthProvider());

    act(() => {
      authStateCallback?.({
        uid: 'user-1',
        emailVerified: true,
        providerData: [{ providerId: 'password' }],
      });
    });

    expect(result.current.authState).toBe('authenticated');
    expect(result.current.user).toBeTruthy();
  });

  it('transitions to authenticated for Google provider', async () => {
    const { result } = renderHook(() => useAuthProvider());

    act(() => {
      authStateCallback?.({
        uid: 'user-1',
        emailVerified: false,
        providerData: [{ providerId: 'google.com' }],
      });
    });

    expect(result.current.authState).toBe('authenticated');
  });

  it('transitions to unverified for email user without verification', async () => {
    const { result } = renderHook(() => useAuthProvider());

    act(() => {
      authStateCallback?.({
        uid: 'user-1',
        emailVerified: false,
        providerData: [{ providerId: 'password' }],
      });
    });

    expect(result.current.authState).toBe('unverified');
  });

  it('transitions to unauthenticated when no user and no guest flag', async () => {
    const { result } = renderHook(() => useAuthProvider());

    act(() => {
      authStateCallback?.(null);
    });

    expect(result.current.authState).toBe('unauthenticated');
    expect(result.current.user).toBeNull();
  });

  it('transitions to guest when no user but guest flag is set', async () => {
    localStorageStore['metronotes_guest_mode'] = 'true';

    const { result } = renderHook(() => useAuthProvider());

    act(() => {
      authStateCallback?.(null);
    });

    expect(result.current.authState).toBe('guest');
  });

  it('continueAsGuest sets guest state', async () => {
    const { result } = renderHook(() => useAuthProvider());

    act(() => {
      authStateCallback?.(null);
    });

    act(() => {
      result.current.continueAsGuest();
    });

    expect(result.current.authState).toBe('guest');
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('metronotes_guest_mode', 'true');
  });

  it('exitGuestMode transitions to unauthenticated', async () => {
    const { result } = renderHook(() => useAuthProvider());

    // Start as guest
    act(() => {
      result.current.continueAsGuest();
    });

    act(() => {
      result.current.exitGuestMode();
    });

    expect(result.current.authState).toBe('unauthenticated');
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('metronotes_guest_mode');
  });

  it('signOut clears state and transitions to unauthenticated', async () => {
    const { result } = renderHook(() => useAuthProvider());

    act(() => {
      authStateCallback?.({ uid: 'user-1', emailVerified: true, providerData: [{ providerId: 'password' }] });
    });

    await act(async () => {
      await result.current.signOut();
    });

    expect(mockFirebaseSignOut).toHaveBeenCalled();
    expect(result.current.authState).toBe('unauthenticated');
  });

  it('signInWithEmail sets error on invalid credentials', async () => {
    mockSignInWithEmailAndPassword.mockRejectedValue({ code: 'auth/invalid-credential' });

    const { result } = renderHook(() => useAuthProvider());

    await act(async () => {
      await result.current.signInWithEmail('bad@test.com', 'wrong');
    });

    expect(result.current.authError).toBe('Invalid email or password.');
  });

  it('signUpWithEmail sets error on weak password', async () => {
    mockCreateUserWithEmailAndPassword.mockRejectedValue({ code: 'auth/weak-password' });

    const { result } = renderHook(() => useAuthProvider());

    await act(async () => {
      await result.current.signUpWithEmail('test@test.com', '123');
    });

    expect(result.current.authError).toBe('Password must be at least 6 characters.');
  });

  it('clearAuthError clears the error', async () => {
    mockSignInWithEmailAndPassword.mockRejectedValue({ code: 'auth/invalid-credential' });

    const { result } = renderHook(() => useAuthProvider());

    await act(async () => {
      await result.current.signInWithEmail('bad@test.com', 'wrong');
    });

    expect(result.current.authError).toBeTruthy();

    act(() => {
      result.current.clearAuthError();
    });

    expect(result.current.authError).toBeNull();
  });

  it('resetPassword does not reveal if user not found', async () => {
    mockSendPasswordResetEmail.mockRejectedValue({ code: 'auth/user-not-found' });

    const { result } = renderHook(() => useAuthProvider());

    await act(async () => {
      await result.current.resetPassword('nonexistent@test.com');
    });

    // Should not set error for user-not-found (security)
    expect(result.current.authError).toBeNull();
  });
});
