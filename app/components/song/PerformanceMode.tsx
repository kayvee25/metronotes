'use client';

import { Song, Setlist } from '../../types';
import MetronomePill from '../ui/MetronomePill';

interface PerformanceModeProps {
  song?: Song | null;
  notes: string;
  musicalKey: string;
  bpm: number;
  timeSignature: string;
  isPlaying: boolean;
  currentBeat: number;
  isBeating: boolean;
  setlist?: Setlist | null;
  songIndex: number;
  showBack: boolean;
  onBack: () => void;
  onPrevSong?: () => void;
  onNextSong?: () => void;
  onTogglePlay: () => void;
  onBpmChange: (bpm: number) => void;
  onSwitchToEdit: () => void;
  perfFontSize?: string;
  perfFontFamily?: string;
  isMuted?: boolean;
  onToggleMute?: () => void;
}

const FONT_SIZE_MAP: Record<string, string> = {
  sm: 'text-sm sm:text-base',
  md: 'text-base sm:text-lg',
  lg: 'text-xl sm:text-2xl',
  xl: 'text-2xl sm:text-3xl',
};

const FONT_FAMILY_MAP: Record<string, string> = {
  mono: 'font-mono',
  sans: 'font-sans',
  serif: '',
};

export default function PerformanceMode({
  song,
  notes,
  musicalKey,
  bpm,
  timeSignature,
  isPlaying,
  currentBeat,
  isBeating,
  setlist,
  songIndex,
  showBack,
  onBack,
  onPrevSong,
  onNextSong,
  onTogglePlay,
  onBpmChange,
  onSwitchToEdit,
  perfFontSize = 'md',
  perfFontFamily = 'mono',
  isMuted = false,
  onToggleMute,
}: PerformanceModeProps) {
  const hasPrev = setlist && songIndex > 0;
  const hasNext = setlist && songIndex < (setlist.songIds.length - 1);

  const fontSizeClass = FONT_SIZE_MAP[perfFontSize] || FONT_SIZE_MAP.md;
  const fontFamilyClass = FONT_FAMILY_MAP[perfFontFamily] ?? FONT_FAMILY_MAP.mono;
  const serifStyle = perfFontFamily === 'serif' ? { fontFamily: 'Georgia, "Times New Roman", serif' } : {};

  // Build metadata line
  const metaParts = [timeSignature, `${bpm} BPM`, musicalKey].filter(Boolean);
  const metaLine = metaParts.join(' · ');

  return (
    <div className="flex flex-col h-screen bg-[var(--background)]">
      {/* Simplified header */}
      <header className="flex items-center gap-1 px-3 py-2 border-b border-[var(--border)] max-w-3xl mx-auto w-full">
        {/* Back button */}
        {showBack && (
          <button
            onClick={onBack}
            className="w-11 h-11 rounded-xl hover:bg-[var(--card)] active:scale-95 transition-all flex items-center justify-center flex-shrink-0"
            aria-label="Back"
          >
            <svg
              className="w-6 h-6 text-[var(--foreground)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {/* Prev button (setlist) */}
        {setlist && (
          <button
            onClick={onPrevSong}
            disabled={!hasPrev}
            className="w-11 h-11 rounded-xl hover:bg-[var(--card)] active:scale-95 transition-all flex items-center justify-center disabled:opacity-30 flex-shrink-0"
            aria-label="Previous song"
          >
            <svg
              className="w-5 h-5 text-[var(--foreground)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {/* Title — simplified */}
        <div className="flex-1 text-center min-w-0">
          <h1 className="text-lg font-bold text-[var(--foreground)] truncate">
            {song?.name || 'New Song'}
            {setlist && (
              <span className="text-sm font-medium text-[var(--muted)] ml-2">
                ({songIndex + 1}/{setlist.songIds.length})
              </span>
            )}
          </h1>
        </div>

        {/* Next button (setlist) */}
        {setlist && (
          <button
            onClick={onNextSong}
            disabled={!hasNext}
            className="w-11 h-11 rounded-xl hover:bg-[var(--card)] active:scale-95 transition-all flex items-center justify-center disabled:opacity-30 flex-shrink-0"
            aria-label="Next song"
          >
            <svg
              className="w-5 h-5 text-[var(--foreground)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* Edit button for standalone songs (not setlist) */}
        {!setlist && (
          <button
            onClick={onSwitchToEdit}
            className="w-11 h-11 rounded-xl hover:bg-[var(--card)] active:scale-95 transition-all flex items-center justify-center flex-shrink-0"
            aria-label="Edit song"
          >
            <svg
              className="w-5 h-5 text-[var(--muted)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        )}
      </header>

      {/* Notes area — full screen teleprompter */}
      <div className="flex-1 overflow-y-auto p-4 pb-20 max-w-3xl mx-auto w-full">
        {/* Inline metadata at top of content */}
        <div className="text-sm text-[var(--muted)] mb-4 text-center">
          {metaLine}
        </div>

        {notes ? (
          <pre
            className={`whitespace-pre-wrap ${fontSizeClass} ${fontFamilyClass} text-[var(--foreground)] leading-relaxed`}
            style={serifStyle}
          >
            {notes}
          </pre>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <svg
              className="w-16 h-16 text-[var(--muted)] mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-[var(--muted)]">No notes for this song</p>
          </div>
        )}
      </div>

      {/* Floating metronome pill */}
      <MetronomePill
        bpm={bpm}
        isPlaying={isPlaying}
        currentBeat={currentBeat}
        isBeating={isBeating}
        isMuted={isMuted}
        onTogglePlay={onTogglePlay}
        onBpmChange={onBpmChange}
        onToggleMute={onToggleMute}
      />
    </div>
  );
}
