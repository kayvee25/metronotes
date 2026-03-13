'use client';

import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

type AuthView = 'main' | 'email-signin' | 'email-signup' | 'forgot-password' | 'forgot-sent';

export default function AuthScreen() {
  const {
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
    continueAsGuest,
    authError,
    clearAuthError,
  } = useAuth();

  const [view, setView] = useState<AuthView>('main');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const switchView = (v: AuthView) => {
    setView(v);
    setEmail('');
    setPassword('');
    setDisplayName('');
    clearAuthError();
  };

  const handleEmailSignIn = async () => {
    if (!email.trim() || !password) return;
    setIsSubmitting(true);
    await signInWithEmail(email.trim(), password);
    setIsSubmitting(false);
  };

  const handleEmailSignUp = async () => {
    if (!email.trim() || !password) return;
    setIsSubmitting(true);
    await signUpWithEmail(email.trim(), password, displayName);
    setIsSubmitting(false);
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) return;
    setIsSubmitting(true);
    await resetPassword(email.trim());
    setIsSubmitting(false);
    setView('forgot-sent');
  };

  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter') action();
  };

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Logo / App Name */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-[var(--foreground)] flex items-center justify-center mx-auto mb-4">
            <svg className="w-9 h-9 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-[var(--foreground)]">MetroNotes</h1>
          <p className="text-[var(--muted)] mt-2">Your stage, organized.</p>
        </div>

        {/* Error message */}
        {authError && (
          <div className="mb-4 p-3 rounded-xl bg-[var(--accent-danger)]/10 border border-[var(--accent-danger)]/20 text-[var(--accent-danger)] text-sm text-center">
            {authError}
          </div>
        )}

        {/* Main view */}
        {view === 'main' && (
          <div className="space-y-3">
            <button
              onClick={signInWithGoogle}
              className="w-full h-12 rounded-xl bg-[var(--card)] text-[var(--foreground)] font-semibold flex items-center justify-center gap-3 border border-[var(--border)] hover:brightness-95 active:scale-[0.98] transition-all"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Sign in with Google
            </button>

            <button
              onClick={() => switchView('email-signin')}
              className="w-full h-12 rounded-xl bg-[var(--accent)] text-white font-semibold hover:brightness-110 active:scale-[0.98] transition-all"
            >
              Sign in with Email
            </button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[var(--border)]" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-[var(--background)] px-4 text-[var(--muted)]">or</span>
              </div>
            </div>

            <button
              onClick={continueAsGuest}
              className="w-full h-12 rounded-xl bg-[var(--card)] text-[var(--muted)] font-medium hover:bg-[var(--border)] active:scale-[0.98] transition-all"
            >
              Continue as Guest
            </button>
          </div>
        )}

        {/* Email Sign In */}
        {view === 'email-signin' && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider block mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, handleEmailSignIn)}
                placeholder="your@email.com"
                className="w-full px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-xl text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)]"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider block mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, handleEmailSignIn)}
                placeholder="Password"
                className="w-full px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-xl text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <button
              onClick={handleEmailSignIn}
              disabled={!email.trim() || !password || isSubmitting}
              className="w-full h-12 rounded-xl bg-[var(--accent)] text-white font-semibold hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </button>

            <div className="flex items-center justify-between text-sm">
              <button
                onClick={() => switchView('forgot-password')}
                className="text-[var(--accent)] font-medium"
              >
                Forgot Password?
              </button>
              <button
                onClick={() => switchView('email-signup')}
                className="text-[var(--accent)] font-medium"
              >
                Create Account
              </button>
            </div>

            <button
              onClick={() => switchView('main')}
              className="w-full text-center text-sm text-[var(--muted)] mt-2"
            >
              Back
            </button>
          </div>
        )}

        {/* Email Sign Up */}
        {view === 'email-signup' && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider block mb-2">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, handleEmailSignUp)}
                placeholder="Your name"
                className="w-full px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-xl text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)]"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider block mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, handleEmailSignUp)}
                placeholder="your@email.com"
                className="w-full px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-xl text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider block mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, handleEmailSignUp)}
                placeholder="At least 6 characters"
                className="w-full px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-xl text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <button
              onClick={handleEmailSignUp}
              disabled={!email.trim() || !password || isSubmitting}
              className="w-full h-12 rounded-xl bg-[var(--accent)] text-white font-semibold hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Creating account...' : 'Create Account'}
            </button>

            <div className="text-center text-sm">
              <span className="text-[var(--muted)]">Already have an account? </span>
              <button
                onClick={() => switchView('email-signin')}
                className="text-[var(--accent)] font-medium"
              >
                Sign In
              </button>
            </div>

            <button
              onClick={() => switchView('main')}
              className="w-full text-center text-sm text-[var(--muted)] mt-2"
            >
              Back
            </button>
          </div>
        )}

        {/* Forgot Password */}
        {view === 'forgot-password' && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--muted)] text-center">
              Enter your email and we&apos;ll send you a link to reset your password.
            </p>
            <div>
              <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider block mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, handleForgotPassword)}
                placeholder="your@email.com"
                className="w-full px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-xl text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)]"
                autoFocus
              />
            </div>

            <button
              onClick={handleForgotPassword}
              disabled={!email.trim() || isSubmitting}
              className="w-full h-12 rounded-xl bg-[var(--accent)] text-white font-semibold hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Sending...' : 'Send Reset Link'}
            </button>

            <button
              onClick={() => switchView('email-signin')}
              className="w-full text-center text-sm text-[var(--muted)] mt-2"
            >
              Back to Sign In
            </button>
          </div>
        )}

        {/* Forgot Password Sent */}
        {view === 'forgot-sent' && (
          <div className="text-center space-y-4">
            <svg className="w-16 h-16 text-[var(--accent)] mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
            <p className="text-[var(--foreground)] font-medium">Check your email</p>
            <p className="text-sm text-[var(--muted)]">
              If an account exists with that email, we&apos;ve sent a password reset link.
            </p>
            <button
              onClick={() => switchView('email-signin')}
              className="text-[var(--accent)] font-medium text-sm"
            >
              Back to Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
