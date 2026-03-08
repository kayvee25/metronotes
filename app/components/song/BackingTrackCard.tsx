'use client';

import { Attachment } from '../../types';
import { formatDuration, formatFileSize } from '../../lib/audio-processing';
import { useConfirm } from '../ui/ConfirmModal';

interface BackingTrackCardProps {
  attachment: Attachment;
  onDelete: () => void;
  // Playback props (optional — absent means no playback wired)
  isPlaying?: boolean;
  currentTime?: number;
  duration?: number;
  buffered?: number;
  onPlay?: () => void;
  onPause?: () => void;
  onSeek?: (time: number) => void;
}

export default function BackingTrackCard({
  attachment,
  onDelete,
  isPlaying,
  currentTime = 0,
  duration = 0,
  buffered = 0,
  onPlay,
  onPause,
  onSeek,
}: BackingTrackCardProps) {
  const confirmAction = useConfirm();
  const hasPlayback = onPlay != null;

  const handleDelete = async () => {
    const ok = await confirmAction({
      title: 'Remove Backing Track',
      message: 'Remove this backing track? This cannot be undone.',
      confirmLabel: 'Remove',
      variant: 'danger',
    });
    if (ok) onDelete();
  };

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3">
      {/* File info row */}
      <div className="flex items-center gap-3">
        {/* Play/pause button or audio icon */}
        {hasPlayback ? (
          <button
            onClick={isPlaying ? onPause : onPlay}
            className="w-10 h-10 rounded-full bg-[var(--accent)] flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="5" width="4" height="14" />
                <rect x="14" y="5" width="4" height="14" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
        ) : (
          <div className="w-10 h-10 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
        )}

        {/* File details */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--foreground)] truncate">
            {attachment.fileName || 'Backing Track'}
          </p>
          <p className="text-xs text-[var(--muted)]">
            {attachment.duration != null && formatDuration(attachment.duration)}
            {attachment.duration != null && attachment.fileSize != null && ' · '}
            {attachment.fileSize != null && formatFileSize(attachment.fileSize)}
          </p>
        </div>

        {/* Delete button */}
        <button
          onClick={handleDelete}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--muted)] hover:text-[var(--accent-danger)] hover:bg-[var(--accent-danger)]/10 transition-colors flex-shrink-0"
          aria-label="Remove backing track"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Transport controls — seek bar with buffer indicator + time */}
      {hasPlayback && duration > 0 && (
        <div className="mt-2.5 px-1">
          <div className="relative h-3 flex items-center">
            {/* Track background */}
            <div className="absolute inset-x-0 h-1 rounded-full bg-[var(--border)]" />
            {/* Buffered bar */}
            <div
              className="absolute h-1 rounded-full bg-[var(--muted)]/30"
              style={{ width: `${(buffered / duration) * 100}%` }}
            />
            {/* Played bar */}
            <div
              className="absolute h-1 rounded-full bg-[var(--accent)]"
              style={{ width: `${(currentTime / duration) * 100}%` }}
            />
            {/* Range input (transparent, on top for interaction) */}
            <input
              type="range"
              min={0}
              max={duration}
              step={0.1}
              value={currentTime}
              onChange={(e) => onSeek?.(parseFloat(e.target.value))}
              className="absolute inset-0 w-full h-full appearance-none cursor-pointer bg-transparent [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--accent)] [&::-webkit-slider-thumb]:shadow-sm"
              aria-label="Seek"
              aria-valuemin={0}
              aria-valuemax={duration}
              aria-valuenow={currentTime}
            />
          </div>
          <div className="flex justify-between mt-0.5">
            <span className="text-[10px] text-[var(--muted)] font-mono">{formatDuration(currentTime)}</span>
            <span className="text-[10px] text-[var(--muted)] font-mono">{formatDuration(duration)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
