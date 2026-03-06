'use client';

import { useState, useRef, useEffect } from 'react';
import MetronomeButton from './MetronomeButton';

interface MetronomePillProps {
  bpm: number;
  isPlaying: boolean;
  currentBeat: number;
  isBeating: boolean;
  isMuted?: boolean;
  onTogglePlay: () => void;
  onBpmChange: (bpm: number) => void;
  onToggleMute?: () => void;
}

export default function MetronomePill({
  bpm,
  isPlaying,
  currentBeat,
  isBeating,
  isMuted = false,
  onTogglePlay,
  onBpmChange,
  onToggleMute,
}: MetronomePillProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!panelOpen) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [panelOpen]);

  return (
    <div className="fixed bottom-6 right-4 z-50" ref={panelRef}>
      {panelOpen ? (
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
        <button
          onClick={() => setPanelOpen(true)}
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
  );
}
