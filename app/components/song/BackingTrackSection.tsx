'use client';

import { Attachment } from '../../types';
import { AUDIO } from '../../lib/constants';
import BackingTrackCard from './BackingTrackCard';

interface BackingTrackSectionProps {
  audioAttachment: Attachment | null;
  onUpload: () => void;
  onDelete: (attachmentId: string) => void;
  isUploading: boolean;
  // Playback pass-through
  btIsPlaying?: boolean;
  btCurrentTime?: number;
  btDuration?: number;
  btBuffered?: number;
  onBtPlay?: () => void;
  onBtPause?: () => void;
  onBtSeek?: (time: number) => void;
  // Count-in
  countInBars?: number;
  onCountInBarsChange?: (bars: number) => void;
}

export default function BackingTrackSection({
  audioAttachment,
  onUpload,
  onDelete,
  isUploading,
  btIsPlaying,
  btCurrentTime,
  btDuration,
  btBuffered,
  onBtPlay,
  onBtPause,
  onBtSeek,
  countInBars = 1,
  onCountInBarsChange,
}: BackingTrackSectionProps) {
  return (
    <div className="px-4 py-3 border-t border-[var(--border)]">
      <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider block mb-3">
        Backing Track
      </label>

      {isUploading ? (
        <div className="flex items-center justify-center gap-2 py-6">
          <svg className="w-5 h-5 text-[var(--muted)] animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={3} opacity={0.25} />
            <path d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
          </svg>
          <span className="text-sm text-[var(--muted)]">Uploading...</span>
        </div>
      ) : audioAttachment ? (
        <>
          <BackingTrackCard
            attachment={audioAttachment}
            onDelete={() => onDelete(audioAttachment.id)}
            isPlaying={btIsPlaying}
            currentTime={btCurrentTime}
            duration={btDuration}
            buffered={btBuffered}
            onPlay={onBtPlay}
            onPause={onBtPause}
            onSeek={onBtSeek}
          />
          {/* Count-in selector */}
          {onCountInBarsChange && (
            <div className="flex items-center gap-3 mt-3">
              <span className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider whitespace-nowrap">Count-in</span>
              <div className="flex rounded-lg bg-[var(--card)] border border-[var(--border)] p-0.5 flex-1" role="group" aria-label="Count-in bars">
                {(AUDIO.COUNT_IN_OPTIONS as readonly number[]).map((bars) => (
                  <button
                    key={bars}
                    onClick={() => onCountInBarsChange(bars)}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                      countInBars === bars
                        ? 'bg-[var(--accent)] text-white'
                        : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                    }`}
                    aria-label={bars === 0 ? 'No count-in' : `${bars} bar${bars > 1 ? 's' : ''} count-in`}
                  >
                    {bars === 0 ? 'Off' : bars}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <button
          onClick={onUpload}
          className="w-full py-3 rounded-xl border-2 border-dashed border-[var(--border)] text-[var(--muted)] font-medium text-sm hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
          Add Backing Track
        </button>
      )}
    </div>
  );
}
