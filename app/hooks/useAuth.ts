'use client';

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { STORAGE_KEYS } from '../lib/constants';
import { clearAllCache } from '../lib/offline-cache';
import { clearAllGuestBlobs } from '../lib/guest-blob-storage';

export type AuthState = 'loading' | 'unauthenticated' | 'unverified' | 'authenticated' | 'guest';

interface AuthContextValue {
  user: User | null;
  authState: AuthState;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  continueAsGuest: () => void;
  exitGuestMode: () => void;
  authError: string | null;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export { AuthContext };

const googleProvider = new GoogleAuthProvider();

export function useAuthProvider(): AuthContextValue {
  const [user, setUser] = useState<User | null>(null);
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const isGuest = localStorage.getItem(STORAGE_KEYS.GUEST_MODE) === 'true';

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        if (firebaseUser.providerData[0]?.providerId === 'google.com' || firebaseUser.emailVerified) {
          setAuthState('authenticated');
        } else {
          setAuthState('unverified');
        }
      } else if (isGuest) {
        setUser(null);
        setAuthState('guest');
      } else {
        setUser(null);
        setAuthState('unauthenticated');
      }
    });

    return () => unsubscribe();
  }, []);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      localStorage.removeItem(STORAGE_KEYS.GUEST_MODE);
    } catch (error: unknown) {
      const e = error as { code?: string; message?: string };
      if (e.code === 'auth/popup-blocked') {
        setAuthError('Sign-in popup was blocked. Please allow popups for this site and try again.');
      } else if (e.code === 'auth/popup-closed-by-user') {
        // User closed the popup, not an error
      } else {
        setAuthError(e.message || 'Failed to sign in with Google.');
      }
    }
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      localStorage.removeItem(STORAGE_KEYS.GUEST_MODE);
    } catch (error: unknown) {
      const e = error as { code?: string; message?: string };
      if (e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password' || e.code === 'auth/user-not-found') {
        setAuthError('Invalid email or password.');
      } else if (e.code === 'auth/too-many-requests') {
        setAuthError('Too many attempts. Please try again later.');
      } else {
        setAuthError(e.message || 'Failed to sign in.');
      }
    }
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    setAuthError(null);
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(result.user);
      localStorage.removeItem(STORAGE_KEYS.GUEST_MODE);
    } catch (error: unknown) {
      const e = error as { code?: string; message?: string };
      if (e.code === 'auth/email-already-in-use') {
        setAuthError('An account with this email already exists.');
      } else if (e.code === 'auth/weak-password') {
        setAuthError('Password must be at least 6 characters.');
      } else if (e.code === 'auth/invalid-email') {
        setAuthError('Please enter a valid email address.');
      } else {
        setAuthError(e.message || 'Failed to create account.');
      }
    }
  }, []);

  const resendVerificationEmail = useCallback(async () => {
    setAuthError(null);
    try {
      if (auth.currentUser) {
        await sendEmailVerification(auth.currentUser);
      }
    } catch (error: unknown) {
      const e = error as { code?: string; message?: string };
      if (e.code === 'auth/too-many-requests') {
        setAuthError('Too many attempts. Please try again later.');
      } else {
        setAuthError(e.message || 'Failed to send verification email.');
      }
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    setAuthError(null);
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error: unknown) {
      const e = error as { code?: string; message?: string };
      if (e.code === 'auth/user-not-found') {
        // Don't reveal if email exists
      } else {
        setAuthError(e.message || 'Failed to send reset email.');
      }
    }
  }, []);

  const signOut = useCallback(async () => {
    setAuthError(null);
    try {
      await firebaseSignOut(auth);
      localStorage.removeItem(STORAGE_KEYS.GUEST_MODE);
      localStorage.removeItem(STORAGE_KEYS.SONGS);
      localStorage.removeItem(STORAGE_KEYS.SETLISTS);
      // Clear all cached/local data so next session starts clean
      await Promise.all([clearAllCache(), clearAllGuestBlobs()]);
      setAuthState('unauthenticated');
    } catch (error: unknown) {
      const e = error as { message?: string };
      setAuthError(e.message || 'Failed to sign out.');
    }
  }, []);

  const continueAsGuest = useCallback(() => {
    localStorage.setItem(STORAGE_KEYS.GUEST_MODE, 'true');
    setAuthState('guest');
  }, []);

  const exitGuestMode = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.GUEST_MODE);
    setAuthState('unauthenticated');
  }, []);

  return {
    user,
    authState,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    resendVerificationEmail,
    resetPassword,
    signOut,
    continueAsGuest,
    exitGuestMode,
    authError,
    clearAuthError,
  };
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
