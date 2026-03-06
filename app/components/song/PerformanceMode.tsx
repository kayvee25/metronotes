'use client';

import { useState, useRef, useEffect } from 'react';
import { Song, Setlist } from '../../types';
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
  beatsPerMeasure,
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
  const [metronomePanelOpen, setMetronomePanelOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close metronome panel on outside click
  useEffect(() => {
    if (!metronomePanelOpen) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setMetronomePanelOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [metronomePanelOpen]);

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
      <div className="fixed bottom-6 right-4 z-50" ref={panelRef}>
        {metronomePanelOpen ? (
          /* Expanded metronome panel */
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl p-4 w-52 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3 mb-3">
              {/* Beat circle */}
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold transition-all duration-100 ${
                  isPlaying
                    ? isBeating
                      ? currentBeat === 0
                        ? 'bg-[var(--accent-danger)] text-white scale-110'
                        : 'bg-[var(--accent)] text-white scale-110'
                      : currentBeat === 0
                        ? 'bg-[var(--accent-danger)]/70 text-white'
                        : 'bg-[var(--accent)]/70 text-white'
                    : 'bg-[var(--border)] text-[var(--muted)]'
                }`}
              >
                {isPlaying ? currentBeat + 1 : 1}
              </div>

              {/* Play/Stop */}
              <MetronomeButton
                isPlaying={isPlaying}
                onClick={onTogglePlay}
                size="lg"
                variant="round"
              />
            </div>

            {/* Mute toggle */}
            {onToggleMute && (
              <button
                onClick={onToggleMute}
                className={`w-full flex items-center justify-center gap-2 py-1.5 rounded-lg text-xs font-medium transition-colors mb-2 ${
                  isMuted
                    ? 'bg-[var(--accent-danger)]/10 text-[var(--accent-danger)]'
                    : 'bg-[var(--background)] text-[var(--muted)] hover:text-[var(--foreground)]'
                }`}
                aria-label={isMuted ? 'Unmute metronome' : 'Mute metronome'}
              >
                {isMuted ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                )}
                {isMuted ? 'Muted' : 'Sound On'}
              </button>
            )}

            {/* BPM stepper */}
            <div className="flex items-center justify-center gap-1">
              <button
                onClick={() => onBpmChange(bpm - 1)}
                className="w-9 h-9 rounded-lg bg-[var(--background)] border border-[var(--border)] hover:bg-[var(--border)] active:scale-95 transition-all flex items-center justify-center"
                aria-label="Decrease BPM"
              >
                <svg className="w-4 h-4 text-[var(--foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                </svg>
              </button>
              <div className="flex-1 text-center">
                <span className="text-lg font-bold text-[var(--foreground)] font-mono">{bpm}</span>
                <span className="text-xs text-[var(--muted)] ml-1">BPM</span>
              </div>
              <button
                onClick={() => onBpmChange(bpm + 1)}
                className="w-9 h-9 rounded-lg bg-[var(--background)] border border-[var(--border)] hover:bg-[var(--border)] active:scale-95 transition-all flex items-center justify-center"
                aria-label="Increase BPM"
              >
                <svg className="w-4 h-4 text-[var(--foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          </div>
        ) : (
          /* Collapsed pill */
          <button
            onClick={() => setMetronomePanelOpen(true)}
            className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all active:scale-95 ${
              isPlaying ? 'bg-[var(--accent-danger)]' : 'bg-[var(--accent)]'
            }`}
            aria-label="Open metronome"
          >
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 20h14l-3-15H8l-3 15z" />
              <path d="M12 16l5-10" />
              <circle cx="17" cy="6" r="1.5" fill="currentColor" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
