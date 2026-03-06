'use client';

import { Song, Setlist } from '../../types';
import BeatIndicator from '../ui/BeatIndicator';
import MetronomeButton from '../ui/MetronomeButton';

interface PerformanceModeProps {
  song?: Song | null;
  notes: string;
  musicalKey: string;
  bpm: number;
  timeSignature: string;
  isPlaying: boolean;
  currentBeat: number;
  isBeating: boolean;
  beatsPerMeasure: number;
  setlist?: Setlist | null;
  songIndex: number;
  showBack: boolean;
  onBack: () => void;
  onPrevSong?: () => void;
  onNextSong?: () => void;
  onTogglePlay: () => void;
  onSwitchToEdit: () => void;
}

export default function PerformanceMode({
  song,
  notes,
  musicalKey,
  bpm,
  timeSignature,
  isPlaying,
  currentBeat,
  isBeating,
  beatsPerMeasure,
  setlist,
  songIndex,
  showBack,
  onBack,
  onPrevSong,
  onNextSong,
  onTogglePlay,
  onSwitchToEdit,
}: PerformanceModeProps) {
  const hasPrev = setlist && songIndex > 0;
  const hasNext = setlist && songIndex < (setlist.songIds.length - 1);

  return (
    <div className="flex flex-col h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)]">
        {/* Back button */}
        {showBack && (
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-xl hover:bg-[var(--card)] active:scale-95 transition-all flex items-center justify-center"
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
            className="w-10 h-10 rounded-xl hover:bg-[var(--card)] active:scale-95 transition-all flex items-center justify-center disabled:opacity-30"
            aria-label="Previous song"
          >
            <svg
              className="w-5 h-5 text-[var(--foreground)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {/* Title */}
        <div className="flex-1 text-center min-w-0">
          {setlist && (
            <p className="text-xs text-[var(--muted)] font-medium truncate">
              {setlist.name} · {songIndex + 1} of {setlist.songIds.length}
            </p>
          )}
          <h1 className="text-lg font-bold text-[var(--foreground)] truncate">
            {song?.name || 'New Song'}
          </h1>
          {song?.artist && <p className="text-sm text-[var(--muted)] truncate">{song.artist}</p>}
        </div>

        {/* Next button (setlist) */}
        {setlist && (
          <button
            onClick={onNextSong}
            disabled={!hasNext}
            className="w-10 h-10 rounded-xl hover:bg-[var(--card)] active:scale-95 transition-all flex items-center justify-center disabled:opacity-30"
            aria-label="Next song"
          >
            <svg
              className="w-5 h-5 text-[var(--foreground)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* Edit toggle */}
        <button
          onClick={onSwitchToEdit}
          className="w-10 h-10 rounded-xl hover:bg-[var(--card)] active:scale-95 transition-all flex items-center justify-center"
          aria-label="Edit"
        >
          <svg
            className="w-5 h-5 text-[var(--muted)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
        </button>
      </header>

      {/* Info bar */}
      <div className="flex items-center justify-center gap-3 px-4 py-2 bg-[var(--card)] border-b border-[var(--border)]">
        <span className="font-medium text-[var(--foreground)]">{timeSignature}</span>
        <span className="text-[var(--muted)]">·</span>
        <span className="font-mono font-bold text-[var(--foreground)]">{bpm} BPM</span>
        {musicalKey && (
          <>
            <span className="text-[var(--muted)]">·</span>
            <span className="font-medium text-[var(--foreground)]">{musicalKey}</span>
          </>
        )}
      </div>

      {/* Notes area */}
      <div className="flex-1 overflow-y-auto p-4 pb-24">
        {notes ? (
          <pre className="whitespace-pre-wrap font-mono text-base text-[var(--foreground)] leading-relaxed">
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
            <button
              onClick={onSwitchToEdit}
              className="mt-4 px-4 py-2 text-[var(--accent-blue)] font-medium"
            >
              Tap to add notes
            </button>
          </div>
        )}
      </div>

      {/* Bottom control bar */}
      <div className="fixed bottom-16 left-0 right-0 z-40 bg-[var(--background)] border-t border-[var(--border)] px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Beat indicator */}
          <BeatIndicator
            beatsPerMeasure={beatsPerMeasure}
            currentBeat={currentBeat}
            isBeating={isBeating}
          />
          {/* Play button */}
          <MetronomeButton
            isPlaying={isPlaying}
            onClick={onTogglePlay}
            size="lg"
            variant="round"
          />
        </div>
      </div>
    </div>
  );
}
