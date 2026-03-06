'use client';

import { useAuth } from '../hooks/useAuth';

interface SettingsProps {
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export default function Settings({ isDarkMode, onToggleDarkMode }: SettingsProps) {
  const { user, authState, signOut, exitGuestMode } = useAuth();

  const isGuest = authState === 'guest';

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] min-h-[64px]">
        <h1 className="text-xl font-bold text-[var(--foreground)]">Settings</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-20 space-y-4">
        {/* Account section */}
        {isGuest ? (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
            <p className="text-[var(--foreground)] font-medium mb-1">Sign in to sync</p>
            <p className="text-sm text-[var(--muted)] mb-4">
              Sign in to sync your data across devices
            </p>
            <button
              onClick={exitGuestMode}
              className="w-full h-11 rounded-xl bg-[var(--accent-blue)] text-white font-semibold hover:brightness-110 active:scale-95 transition-all text-sm"
            >
              Sign In
            </button>
          </div>
        ) : (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-[var(--accent-blue)] flex items-center justify-center text-white font-bold text-lg">
                {(user?.displayName?.[0] || user?.email?.[0] || '?').toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                {user?.displayName && (
                  <p className="text-[var(--foreground)] font-medium truncate">{user.displayName}</p>
                )}
                <p className="text-sm text-[var(--muted)] truncate">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={signOut}
              className="w-full h-11 rounded-xl bg-red-500/10 text-red-500 font-semibold hover:bg-red-500/20 active:scale-95 transition-all text-sm"
            >
              Sign Out
            </button>
          </div>
        )}

        {/* Appearance */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[var(--foreground)] font-medium">Dark Mode</p>
              <p className="text-sm text-[var(--muted)]">Toggle dark appearance</p>
            </div>
            <button
              onClick={onToggleDarkMode}
              className={`relative w-12 h-7 rounded-full transition-colors ${
                isDarkMode ? 'bg-[var(--accent-blue)]' : 'bg-[var(--border)]'
              }`}
              aria-label="Toggle dark mode"
            >
              <div
                className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                  isDarkMode ? 'translate-x-[22px]' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>

        {/* App info */}
        <div className="text-center text-sm text-[var(--muted)] pt-4">
          <p>MetroNotes v0.2.0</p>
        </div>
      </div>
    </div>
  );
}
