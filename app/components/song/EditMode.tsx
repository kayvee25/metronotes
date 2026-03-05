'use client';

import { useState, useEffect } from 'react';
import { Song } from '../../types';
import { BPM } from '../../lib/constants';
import KeySelector from '../KeySelector';
import BeatIndicator from '../ui/BeatIndicator';
import MetronomeButton from '../ui/MetronomeButton';

interface EditModeProps {
  song?: Song | null;
  name: string;
  artist: string;
  notes: string;
  musicalKey: string;
  bpm: number;
  timeSignature: string;
  isPlaying: boolean;
  currentBeat: number;
  isBeating: boolean;
  beatsPerMeasure: number;
  showBack: boolean;
  onBack: () => void;
  onNameChange: (name: string) => void;
  onArtistChange: (artist: string) => void;
  onNotesChange: (notes: string) => void;
  onKeyChange: (key: string) => void;
  onBpmChange: (bpm: number) => void;
  onTogglePlay: () => void;
  onSwitchToPerformance: () => void;
  onOpenTimeSigModal: () => void;
  onSave: () => void;
  isDirty?: boolean;
}

export default function EditMode({
  song,
  name,
  artist,
  notes,
  musicalKey,
  bpm,
  timeSignature,
  isPlaying,
  currentBeat,
  isBeating,
  beatsPerMeasure,
  showBack,
  onBack,
  onNameChange,
  onArtistChange,
  onNotesChange,
  onKeyChange,
  onBpmChange,
  onTogglePlay,
  onSwitchToPerformance,
  onOpenTimeSigModal,
  onSave,
  isDirty = true,
}: EditModeProps) {
  // BPM input state (for editing without immediate validation)
  const [bpmInput, setBpmInput] = useState(String(bpm));

  // Sync bpmInput with bpm (when changed via +/- buttons)
  useEffect(() => {
    setBpmInput(String(bpm));
  }, [bpm]);

  const handleBpmInputChange = (value: string) => {
    const filtered = value.replace(/\D/g, '');
    setBpmInput(filtered);
  };

  const handleBpmBlur = () => {
    const val = parseInt(bpmInput);
    if (!isNaN(val) && val > 0) {
      const clamped = Math.max(BPM.MIN, Math.min(BPM.MAX, val));
      onBpmChange(clamped);
      setBpmInput(String(clamped));
    } else {
      setBpmInput(String(bpm));
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)]">
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

        <div className="flex-1 min-w-0">
          {song ? (
            <input
              type="text"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Song name"
              className="w-full text-lg font-bold bg-transparent text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none"
            />
          ) : (
            <h1 className="text-lg font-bold text-[var(--foreground)]">New Song</h1>
          )}
          {song && (
            <input
              type="text"
              value={artist}
              onChange={(e) => onArtistChange(e.target.value)}
              placeholder="Artist"
              className="w-full text-sm bg-transparent text-[var(--muted)] placeholder:text-[var(--muted)] focus:outline-none"
            />
          )}
        </div>

        {/* Performance toggle */}
        <button
          onClick={onSwitchToPerformance}
          className="w-10 h-10 rounded-xl hover:bg-[var(--card)] active:scale-95 transition-all flex items-center justify-center"
          aria-label="Performance mode"
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
              d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5"
            />
          </svg>
        </button>

        <button
          onClick={onSave}
          disabled={!isDirty}
          className={`px-4 py-2 rounded-xl bg-[var(--accent-blue)] text-white font-semibold transition-all ${
            isDirty ? 'active:scale-95' : 'opacity-50 pointer-events-none'
          }`}
        >
          Save
        </button>
      </header>

      {/* Controls section */}
      <div className="px-4 py-3 border-b border-[var(--border)]">
        <div className="grid grid-cols-3 gap-2">
          {/* Time signature */}
          <button
            onClick={onOpenTimeSigModal}
            className="h-12 rounded-lg bg-[var(--card)] border border-[var(--border)] hover:bg-[var(--border)] active:scale-95 transition-all flex flex-col items-center justify-center"
          >
            <span className="text-lg font-bold text-[var(--foreground)] leading-tight">{timeSignature}</span>
            <span className="text-[10px] font-medium text-[var(--muted)] uppercase tracking-wider">
              Time
            </span>
          </button>

          {/* BPM controls */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => onBpmChange(bpm - 1)}
              className="w-6 h-12 flex-shrink-0 rounded-l-lg bg-[var(--card)] border border-[var(--border)] hover:bg-[var(--border)] active:scale-95 transition-all flex items-center justify-center"
              aria-label="Decrease BPM"
            >
              <svg
                className="w-3 h-3 text-[var(--foreground)]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={3}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
              </svg>
            </button>

            <div className="flex-1 h-12 flex flex-col items-center justify-center bg-[var(--card)] border-y border-[var(--border)]">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={bpmInput}
                onChange={(e) => handleBpmInputChange(e.target.value)}
                onBlur={handleBpmBlur}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur();
                  }
                }}
                className="w-full text-center text-lg font-bold bg-transparent text-[var(--foreground)] focus:outline-none leading-tight"
                aria-label="BPM"
              />
              <span className="text-[10px] font-medium text-[var(--muted)] uppercase tracking-wider">
                BPM
              </span>
            </div>

            <button
              onClick={() => onBpmChange(bpm + 1)}
              className="w-6 h-12 flex-shrink-0 rounded-r-lg bg-[var(--card)] border border-[var(--border)] hover:bg-[var(--border)] active:scale-95 transition-all flex items-center justify-center"
              aria-label="Increase BPM"
            >
              <svg
                className="w-3 h-3 text-[var(--foreground)]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={3}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          {/* Key */}
          <KeySelector value={musicalKey} onChange={onKeyChange} className="h-12" compact />
        </div>
      </div>

      {/* Notes area */}
      <div className="flex-1 overflow-y-auto p-4 pb-32">
        <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider block mb-2">
          Lyrics / Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Add lyrics, chords, notes, or anything else..."
          className="w-full h-64 px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-xl text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent-blue)] resize-none font-mono text-sm"
        />
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
