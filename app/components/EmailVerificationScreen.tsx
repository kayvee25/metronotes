'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { auth } from '../lib/firebase';

export default function EmailVerificationScreen() {
  const { resendVerificationEmail, signOut, authError } = useAuth();
  const [resent, setResent] = useState(false);

  // Poll for email verification
  useEffect(() => {
    const interval = setInterval(async () => {
      if (auth.currentUser) {
        await auth.currentUser.reload();
        if (auth.currentUser.emailVerified) {
          // Force auth state update
          window.location.reload();
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const handleResend = async () => {
    await resendVerificationEmail();
    setResent(true);
    setTimeout(() => setResent(false), 5000);
  };

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        <svg className="w-20 h-20 text-[var(--accent)] mx-auto mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
        </svg>

        <h1 className="text-2xl font-bold text-[var(--foreground)] mb-2">Check your email</h1>
        <p className="text-[var(--muted)] mb-8">
          We sent a verification link to <span className="text-[var(--foreground)] font-medium">{auth.currentUser?.email}</span>. Click the link to verify your account.
        </p>

        {authError && (
          <div className="mb-4 p-3 rounded-xl bg-[var(--accent-danger)]/10 border border-[var(--accent-danger)]/20 text-[var(--accent-danger)] text-sm">
            {authError}
          </div>
        )}

        {resent && (
          <div className="mb-4 p-3 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 text-[var(--accent)] text-sm">
            Verification email sent!
          </div>
        )}

        <button
          onClick={handleResend}
          className="w-full h-12 rounded-xl bg-[var(--accent)] text-white font-semibold hover:brightness-110 active:scale-[0.98] transition-all mb-3"
        >
          Resend Verification Email
        </button>

        <button
          onClick={signOut}
          className="w-full text-center text-sm text-[var(--muted)]"
        >
          Back to Sign In
        </button>
      </div>
    </div>
  );
}
