'use client';

import { memo } from 'react';
import type { JoinedSession } from '../../lib/live-session/protocol';
import { formatRoomCode } from '../../lib/live-session/room-code';
import type { JoinStatus } from '../../hooks/useJoinSession';
import { useConfirm } from '../ui/ConfirmModal';
import SessionQueue from './SessionQueue';

interface MemberViewProps {
  session: JoinedSession | null;
  connectionStatus: JoinStatus;
  onLeave: () => void;
  onReconnect: () => void;
  onShowPerformance?: () => void;
  songDownloadStatus?: Map<string, { total: number; received: number }>;
  // Metronome sync (Phase 4)
  currentBeat?: number;
  isBeating?: boolean;
  clockSynced?: boolean;
}

const STATUS_LABELS: Record<JoinStatus, { text: string; color: string }> = {
  idle: { text: '', color: '' },
  connecting: { text: 'Connecting...', color: 'text-amber-400' },
  connected: { text: 'Connected', color: 'text-green-400' },
  disconnected: { text: 'Disconnected', color: 'text-red-400' },
  reconnecting: { text: 'Reconnecting...', color: 'text-amber-400' },
  ended: { text: 'Session ended by host', color: 'text-red-400' },
};

/** Isolated beat indicator — only re-renders when beat state changes */
const MemberBeatIndicator = memo(function MemberBeatIndicator({
  bpm,
  timeSignature,
  isPlaying,
  currentBeat,
  isBeating,
}: {
  bpm: number;
  timeSignature: [number, number];
  isPlaying: boolean;
  currentBeat: number;
  isBeating: boolean;
}) {
  if (!isPlaying) return null;

  return (
    <div className="flex items-center justify-center gap-3 py-3 px-4 mb-3 rounded-xl bg-[var(--surface)]">
      {/* Beat circle */}
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg transition-all duration-75 ${
          isBeating && currentBeat === 0
            ? 'bg-red-500 text-white scale-110 shadow-[0_0_14px_rgba(239,68,68,0.5)]'
            : isBeating
              ? 'bg-yellow-500 text-white scale-105 shadow-[0_0_12px_rgba(234,179,8,0.5)]'
              : 'bg-[var(--card)] text-[var(--muted)]'
        }`}
      >
        {currentBeat + 1}
      </div>

      {/* BPM + time sig */}
      <div className="text-center">
        <p className="text-lg font-mono font-bold text-[var(--foreground)] tabular-nums">
          {bpm} <span className="text-xs font-normal text-[var(--muted)]">BPM</span>
        </p>
        <p className="text-xs text-[var(--muted)]">
          {timeSignature[0]}/{timeSignature[1]}
        </p>
      </div>
    </div>
  );
});

export default function MemberView({
  session,
  connectionStatus,
  onLeave,
  onReconnect,
  onShowPerformance,
  songDownloadStatus,
  currentBeat = 0,
  isBeating = false,
  clockSynced = false,
}: MemberViewProps) {
  const confirm = useConfirm();

  const handleLeave = async () => {
    if (connectionStatus === 'ended') {
      onLeave();
      return;
    }
    const confirmed = await confirm({
      title: 'Leave Session',
      message: 'Are you sure you want to leave this session?',
      confirmLabel: 'Leave',
      variant: 'danger',
    });
    if (confirmed) {
      onLeave();
    }
  };

  const statusInfo = STATUS_LABELS[connectionStatus];

  // Session ended state
  if (connectionStatus === 'ended') {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center px-8 max-w-2xl mx-auto w-full">
        <div className="text-5xl mb-4">
          <svg
            className="w-16 h-16 text-red-400 mx-auto"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-[var(--foreground)] mb-2">
          Session Ended
        </h2>
        <p className="text-[var(--muted)] mb-6">
          The host has ended this session.
        </p>
        <button
          onClick={handleLeave}
          className="px-6 py-3 rounded-xl bg-[var(--accent)] text-white font-semibold hover:brightness-110 active:scale-95 transition-all"
        >
          Back to Live
        </button>
      </div>
    );
  }

  // Connecting state
  if (connectionStatus === 'connecting') {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center px-8 max-w-2xl mx-auto w-full">
        <div className="w-10 h-10 border-3 border-[var(--muted)] border-t-[var(--accent)] rounded-full animate-spin mb-6" />
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-2">
          Connecting...
        </h2>
        <p className="text-sm text-[var(--muted)]">
          Establishing connection to host
        </p>
      </div>
    );
  }

  const metronome = session?.metronome;

  // Connected state
  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] px-6 pt-6 pb-4 max-w-2xl mx-auto w-full">
      {/* Reconnection banner */}
      {connectionStatus === 'reconnecting' && (
        <div className="flex items-center justify-center gap-2 px-4 py-2.5 mb-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin shrink-0" />
          <span className="text-sm font-medium text-amber-400">
            Connection lost — Reconnecting...
          </span>
        </div>
      )}
      {connectionStatus === 'disconnected' && (
        <div className="flex flex-col items-center gap-2 px-4 py-3 mb-3 rounded-xl bg-red-500/10 border border-red-500/30">
          <span className="text-sm font-medium text-red-400">
            Disconnected
          </span>
          <button
            onClick={onReconnect}
            className="px-4 py-1.5 rounded-lg bg-[var(--accent)] text-white text-sm font-semibold hover:brightness-110 active:scale-95 transition-all"
          >
            Tap to rejoin
          </button>
        </div>
      )}

      {/* Connection Status */}
      <div className="text-center mb-4">
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className={`w-2.5 h-2.5 rounded-full ${
            connectionStatus === 'connected' ? 'bg-green-500 animate-pulse'
            : connectionStatus === 'reconnecting' ? 'bg-amber-500 animate-pulse'
            : connectionStatus === 'disconnected' ? 'bg-red-500'
            : 'bg-green-500 animate-pulse'
          }`} />
          <span className={`text-sm font-medium ${statusInfo.color}`}>
            {statusInfo.text}
          </span>
        </div>
        {session && (
          <p className="text-xs text-[var(--muted)]">
            Room: {formatRoomCode(session.roomCode)}
          </p>
        )}
        {!clockSynced && connectionStatus === 'connected' && (
          <p className="text-xs text-amber-400 mt-1">
            Syncing clock...
          </p>
        )}
      </div>

      {/* Metronome beat indicator */}
      {metronome && clockSynced && (
        <MemberBeatIndicator
          bpm={metronome.bpm}
          timeSignature={metronome.timeSignature}
          isPlaying={metronome.isPlaying}
          currentBeat={currentBeat}
          isBeating={isBeating}
        />
      )}

      {/* Go to current song button */}
      {onShowPerformance && session?.currentIndex != null && session.queue[session.currentIndex] && (
        <button
          onClick={onShowPerformance}
          className="flex items-center justify-center gap-2 w-full py-3 mb-3 rounded-xl bg-[var(--accent)] text-white font-semibold hover:brightness-110 active:scale-95 transition-all"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
          {session.queue[session.currentIndex].song.name}
        </button>
      )}

      {/* Queue */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <SessionQueue
          queue={session?.queue ?? []}
          currentIndex={session?.currentIndex ?? null}
          isHost={false}
          songDownloadStatus={songDownloadStatus}
        />
      </div>

      {/* Leave button */}
      <button
        onClick={handleLeave}
        className="w-full py-3 mt-4 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 active:scale-[0.98] transition-all shrink-0"
      >
        Leave Session
      </button>
    </div>
  );
}
