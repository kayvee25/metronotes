'use client';

import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from './ui/Toast';
import HostDashboard from './live/HostDashboard';
import MemberView from './live/MemberView';
import type { SessionSettings } from '../lib/live-session/protocol';
import { DEFAULT_SESSION_SETTINGS } from '../lib/live-session/protocol';
import type { UseHostSessionReturn } from '../hooks/useHostSession';
import type { UseJoinSessionReturn } from '../hooks/useJoinSession';

export interface LiveTabProps {
  hasSongs: boolean;
  onCreateSong: () => void;
  hostSession: UseHostSessionReturn;
  joinSession: UseJoinSessionReturn;
  onSwitchToLibrary: () => void;
  onNavigateToSong?: (queueIndex: number) => void;
}

type LiveMode = 'idle' | 'hosting' | 'joining' | 'joined';

const GUEST_DISPLAY_NAME_KEY = 'metronotes_guest_display_name';

export default function LiveTab({
  hasSongs,
  onCreateSong,
  hostSession,
  joinSession,
  onSwitchToLibrary,
  onNavigateToSong,
}: LiveTabProps) {
  const { user, authState } = useAuth();
  const isGuest = authState === 'guest';
  const { toast } = useToast();

  const [mode, setMode] = useState<LiveMode>(() => {
    if (hostSession.isActive) return 'hosting';
    if (joinSession.connectionStatus !== 'idle' && joinSession.connectionStatus !== 'ended') return 'joined';
    return 'idle';
  });
  const [showSettings, setShowSettings] = useState(false);
  const [sessionSettings, setSessionSettings] = useState<SessionSettings>(DEFAULT_SESSION_SETTINGS);

  // Join form state
  const [joinCode, setJoinCode] = useState('');
  const [displayName, setDisplayName] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(GUEST_DISPLAY_NAME_KEY) ?? '';
  });

  // Start session (host)
  const handleStartSession = async () => {
    try {
      await hostSession.startSession(sessionSettings);
      setMode('hosting');
      setShowSettings(false);
    } catch {
      toast('Failed to start session', 'error');
    }
  };

  const handleEndSession = async () => {
    await hostSession.endSession();
    setMode('idle');
  };

  // Join session (member)
  const handleJoinSession = async () => {
    if (!joinCode.trim()) {
      toast('Enter a room code', 'error');
      return;
    }

    const name = isGuest
      ? displayName.trim()
      : user?.displayName ?? user?.email ?? 'Member';

    if (isGuest && !name) {
      toast('Enter your display name', 'error');
      return;
    }

    // Persist guest display name
    if (isGuest && name) {
      localStorage.setItem(GUEST_DISPLAY_NAME_KEY, name);
    }

    const result = await joinSession.join(joinCode, name);
    if (result.ok) {
      setMode('joined');
    } else {
      toast(result.error, 'error');
    }
  };

  const handleLeaveSession = () => {
    joinSession.leave();
    setMode('idle');
  };

  // Host dashboard
  if (mode === 'hosting' && hostSession.session) {
    return (
      <HostDashboard
        session={hostSession.session}
        peers={hostSession.peers}
        currentSong={hostSession.currentSong}
        onEndSession={handleEndSession}
        onAddSongs={onSwitchToLibrary}
        onNavigateToSong={onNavigateToSong ?? hostSession.navigateToSong}
        onRemoveSong={hostSession.removeSongFromQueue}
        onReorderQueue={hostSession.reorderQueue}
      />
    );
  }

  // Member view (connected or connecting)
  if (mode === 'joined') {
    return (
      <MemberView
        session={joinSession.session}
        connectionStatus={joinSession.connectionStatus}
        onLeave={handleLeaveSession}
        pendingAssets={joinSession.pendingAssets}
        currentBeat={joinSession.currentBeat}
        isBeating={joinSession.isBeating}
        clockSynced={joinSession.clockSynced}
      />
    );
  }

  // Join form
  if (mode === 'joining') {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center px-8 max-w-2xl mx-auto w-full">
        <h2 className="text-xl font-semibold text-[var(--foreground)] mb-6">
          Join Session
        </h2>

        <div className="w-full max-w-xs space-y-4">
          <div>
            <input
              type="text"
              value={joinCode}
              onChange={(e) =>
                setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))
              }
              placeholder="Room Code"
              maxLength={6}
              className="w-full px-4 py-3 text-center text-2xl font-mono tracking-[0.2em] rounded-xl bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)] placeholder:text-[var(--muted)] placeholder:text-base placeholder:tracking-normal placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              autoFocus
            />
          </div>

          {isGuest && (
            <div>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your display name"
                maxLength={30}
                className="w-full px-4 py-3 rounded-xl bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>
          )}

          {!isGuest && (
            <p className="text-xs text-[var(--muted)]">
              Joining as {user?.displayName ?? user?.email ?? 'Member'}
            </p>
          )}

          <button
            onClick={handleJoinSession}
            disabled={joinCode.length < 6 || (isGuest && !displayName.trim())}
            className="w-full py-3 rounded-xl bg-[var(--accent)] text-white font-semibold hover:brightness-110 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Join
          </button>

          <button
            onClick={() => setMode('idle')}
            className="w-full py-3 rounded-xl text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Settings sheet (start session config)
  if (showSettings) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh] px-8 max-w-2xl mx-auto w-full">
        <h2 className="text-xl font-semibold text-[var(--foreground)] mb-6">
          Session Settings
        </h2>

        <div className="w-full max-w-xs space-y-4">
          <div>
            <label className="block text-sm text-[var(--muted)] mb-1">
              Session Name
            </label>
            <input
              type="text"
              value={sessionSettings.sessionName}
              onChange={(e) =>
                setSessionSettings((s) => ({
                  ...s,
                  sessionName: e.target.value,
                }))
              }
              maxLength={40}
              className="w-full px-4 py-3 rounded-xl bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>

          <ToggleRow
            label="Metronome"
            description="Sync metronome across all members"
            value={sessionSettings.metronomeEnabled}
            onChange={(v) =>
              setSessionSettings((s) => ({ ...s, metronomeEnabled: v }))
            }
          />
          <ToggleRow
            label="Wait for sync"
            description="Pause until all members are ready"
            value={sessionSettings.waitForSync}
            onChange={(v) =>
              setSessionSettings((s) => ({ ...s, waitForSync: v }))
            }
          />
          <ToggleRow
            label="Allow late join"
            description="New members can join mid-session"
            value={sessionSettings.allowLateJoin}
            onChange={(v) =>
              setSessionSettings((s) => ({ ...s, allowLateJoin: v }))
            }
          />

          <button
            onClick={handleStartSession}
            className="w-full py-3 rounded-xl bg-[var(--accent)] text-white font-semibold hover:brightness-110 active:scale-95 transition-all"
          >
            Start
          </button>

          <button
            onClick={() => setShowSettings(false)}
            className="w-full py-3 rounded-xl text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Idle state — show session start/join options
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center px-8 max-w-2xl mx-auto w-full">
      <svg
        className="w-20 h-20 text-[var(--muted)] mb-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
        />
      </svg>
      <h2 className="text-xl font-semibold text-[var(--foreground)] mb-2">
        Live Session
      </h2>
      <p className="text-[var(--muted)] mb-8">
        Play together in sync with your band
      </p>

      <div className="w-full max-w-xs space-y-3">
        <button
          onClick={() => setShowSettings(true)}
          disabled={isGuest}
          className="w-full py-3 rounded-xl bg-[var(--accent)] text-white font-semibold hover:brightness-110 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Start Session
        </button>

        {isGuest && (
          <p className="text-xs text-[var(--muted)]">
            Sign in to host a session
          </p>
        )}

        <div className="flex items-center gap-3 my-2">
          <div className="flex-1 h-px bg-[var(--border)]" />
          <span className="text-xs text-[var(--muted)]">or</span>
          <div className="flex-1 h-px bg-[var(--border)]" />
        </div>

        <button
          onClick={() => setMode('joining')}
          className="w-full py-3 rounded-xl border border-[var(--border)] text-[var(--foreground)] font-semibold hover:bg-[var(--surface)] active:scale-95 transition-all"
        >
          Join Session
        </button>
      </div>

      {!hasSongs && (
        <button
          onClick={onCreateSong}
          className="mt-8 px-6 py-3 rounded-xl text-[var(--muted)] hover:text-[var(--foreground)] transition-colors text-sm"
        >
          Or create your first song
        </button>
      )}
    </div>
  );
}

// --- Toggle Row ---

function ToggleRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm font-medium text-[var(--foreground)]">{label}</p>
        <p className="text-xs text-[var(--muted)]">{description}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-colors ${
          value ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${
            value ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
