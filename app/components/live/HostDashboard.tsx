'use client';

import type { LiveSession, PeerInfo, QueueItem } from '../../lib/live-session/protocol';
import { formatRoomCode } from '../../lib/live-session/room-code';
import { useConfirm } from '../ui/ConfirmModal';
import SessionQueue from './SessionQueue';

interface HostDashboardProps {
  session: LiveSession;
  peers: PeerInfo[];
  currentSong: QueueItem | null;
  onEndSession: () => void;
  onAddSongs: () => void;
  onNavigateToSong: (index: number) => void;
  onRemoveSong: (index: number) => void;
  onReorderQueue: (fromIndex: number, toIndex: number) => void;
}

const STATUS_COLORS: Record<string, { dot: string; text: string; bg: string }> = {
  connected: { dot: 'bg-green-500', text: 'text-green-400', bg: 'bg-green-500/10' },
  connecting: { dot: 'bg-amber-500', text: 'text-amber-400', bg: 'bg-amber-500/10' },
  reconnecting: { dot: 'bg-amber-500', text: 'text-amber-400', bg: 'bg-amber-500/10' },
  disconnected: { dot: 'bg-red-500', text: 'text-red-400', bg: 'bg-red-500/10' },
};

export default function HostDashboard({
  session,
  peers,
  currentSong,
  onEndSession,
  onAddSongs,
  onNavigateToSong,
  onRemoveSong,
  onReorderQueue,
}: HostDashboardProps) {
  const confirm = useConfirm();

  const handleEndSession = async () => {
    const confirmed = await confirm({
      title: 'End Session',
      message:
        'This will disconnect all members. Are you sure you want to end the session?',
      confirmLabel: 'End Session',
      variant: 'danger',
    });
    if (confirmed) {
      onEndSession();
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(session.roomCode).catch(() => {});
  };

  const connectedCount = peers.filter(p => p.status === 'connected').length;

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] px-6 pt-6 pb-4 max-w-2xl mx-auto w-full">
      {/* Room Code */}
      <div className="text-center mb-4">
        <p className="text-xs uppercase tracking-wider text-[var(--muted)] mb-2">
          Room Code
        </p>
        <button
          onClick={handleCopyCode}
          className="text-4xl font-mono font-bold tracking-[0.3em] text-[var(--accent)] active:scale-95 transition-transform"
          title="Tap to copy"
        >
          {formatRoomCode(session.roomCode)}
        </button>
        <p className="text-xs text-[var(--muted)] mt-1">
          Tap to copy
        </p>
      </div>

      {/* Session Name + Connected Count */}
      <div className="text-center mb-4">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          {session.settings.sessionName}
        </h2>
        {peers.length > 0 && (
          <p className="text-xs text-[var(--muted)] mt-0.5">
            {connectedCount} connected
          </p>
        )}
        {currentSong && (
          <p className="text-xs text-[var(--accent)] mt-1">
            Now playing: {currentSong.song.name}
          </p>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
        {/* Members */}
        <div>
          <h3 className="text-sm font-medium text-[var(--muted)] uppercase tracking-wider mb-2">
            Members ({peers.length})
          </h3>

          {peers.length === 0 ? (
            <div className="text-center py-4 text-[var(--muted)]">
              <p className="text-sm">Waiting for members to join...</p>
              <p className="text-xs mt-1">Share the room code with your band</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {peers.map((peer) => {
                const colors = STATUS_COLORS[peer.status] ?? STATUS_COLORS.disconnected;
                return (
                  <div
                    key={peer.peerId}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[var(--surface)]"
                  >
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${colors.dot} shrink-0`}
                    />
                    <span className="text-sm font-medium text-[var(--foreground)] flex-1 truncate">
                      {peer.displayName || peer.peerId.slice(0, 8)}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${colors.text} ${colors.bg}`}
                    >
                      {peer.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Queue */}
        <div>
          <h3 className="text-sm font-medium text-[var(--muted)] uppercase tracking-wider mb-2">
            Queue ({session.queue.length})
          </h3>
          <SessionQueue
            queue={session.queue}
            currentIndex={session.currentIndex}
            onNavigate={onNavigateToSong}
            onRemove={onRemoveSong}
            onReorder={onReorderQueue}
            isHost={true}
            onAddSongs={onAddSongs}
          />
        </div>
      </div>

      {/* End Session */}
      <button
        onClick={handleEndSession}
        className="w-full py-3 mt-4 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 active:scale-[0.98] transition-all shrink-0"
      >
        End Session
      </button>
    </div>
  );
}
