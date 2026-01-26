'use client';

import { useState, useEffect } from 'react';
import { Song, SongInput, Setlist } from '../types';
import { useMetronomeAudio } from '../hooks/useMetronomeAudio';
import KeySelector from './KeySelector';

type Mode = 'performance' | 'edit';

interface SongViewProps {
  song?: Song | null;
  onBack: () => void;
  onSave: (data: SongInput) => void;
  setlist?: Setlist | null;
  songIndex?: number;
  onPrevSong?: () => void;
  onNextSong?: () => void;
  showBack?: boolean;
}

const DENOMINATORS = [2, 4, 8, 12, 16];

export default function SongView({
  song,
  onBack,
  onSave,
  setlist,
  songIndex = 0,
  onPrevSong,
  onNextSong,
  showBack = true
}: SongViewProps) {
  // Mode: performance for existing songs, edit for new songs
  const [mode, setMode] = useState<Mode>(song ? 'performance' : 'edit');

  // Form state
  const [name, setName] = useState(song?.name || '');
  const [artist, setArtist] = useState(song?.artist || '');
  const [musicalKey, setMusicalKey] = useState(song?.key || '');
  const [notes, setNotes] = useState(song?.notes || '');

  // Time signature modal
  const [showTimeSigModal, setShowTimeSigModal] = useState(false);
  const [customNumerator, setCustomNumerator] = useState(() => {
    const [num] = (song?.timeSignature || '4/4').split('/').map(Number);
    return num || 4;
  });
  const [customDenominator, setCustomDenominator] = useState(() => {
    const [, den] = (song?.timeSignature || '4/4').split('/').map(Number);
    return den || 4;
  });

  // Save name modal (for new songs)
  const [showSaveModal, setShowSaveModal] = useState(false);

  // BPM input state (for editing without immediate validation)
  const [bpmInput, setBpmInput] = useState(String(song?.bpm || 120));

  // Metronome audio
  const {
    bpm,
    timeSignature,
    setTimeSignature,
    isPlaying,
    currentBeat,
    isBeating,
    beatsPerMeasure,
    handleBpmChange,
    togglePlayStop
  } = useMetronomeAudio({
    initialBpm: song?.bpm || 120,
    initialTimeSignature: song?.timeSignature || '4/4'
  });

  // Sync form state when song changes
  useEffect(() => {
    if (song) {
      setName(song.name);
      setArtist(song.artist || '');
      setMusicalKey(song.key || '');
      setNotes(song.notes || '');
      const [num, den] = (song.timeSignature || '4/4').split('/').map(Number);
      setCustomNumerator(num || 4);
      setCustomDenominator(den || 4);
      setMode('performance');
    } else {
      setName('');
      setArtist('');
      setMusicalKey('');
      setNotes('');
      setCustomNumerator(4);
      setCustomDenominator(4);
      setMode('edit');
    }
  }, [song]);

  // Sync bpmInput with bpm (when changed via +/- buttons)
  useEffect(() => {
    setBpmInput(String(bpm));
  }, [bpm]);

  const hasPrev = setlist && songIndex > 0;
  const hasNext = setlist && songIndex < (setlist.songIds.length - 1);

  const applyTimeSignature = () => {
    const newTs = `${customNumerator}/${customDenominator}`;
    setTimeSignature(newTs);
    setShowTimeSigModal(false);
  };

  const handleSave = () => {
    if (song) {
      // Update existing song
      onSave({
        name: name.trim() || song.name,
        artist: artist.trim() || undefined,
        bpm,
        timeSignature,
        key: musicalKey || undefined,
        notes: notes.trim() || undefined
      });
    } else {
      // New song - show name modal if no name
      if (!name.trim()) {
        setShowSaveModal(true);
      } else {
        onSave({
          name: name.trim(),
          artist: artist.trim() || undefined,
          bpm,
          timeSignature,
          key: musicalKey || undefined,
          notes: notes.trim() || undefined
        });
      }
    }
  };

  const handleSaveWithName = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      artist: artist.trim() || undefined,
      bpm,
      timeSignature,
      key: musicalKey || undefined,
      notes: notes.trim() || undefined
    });
    setShowSaveModal(false);
  };

  // Performance mode view
  if (mode === 'performance') {
    return (
      <div className="flex flex-col min-h-screen bg-[var(--background)]">
        {/* Header */}
        <header className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)]">
          {/* Back button */}
          {showBack && (
            <button
              onClick={onBack}
              className="w-10 h-10 rounded-xl hover:bg-[var(--card)] active:scale-95 transition-all flex items-center justify-center"
              aria-label="Back"
            >
              <svg className="w-6 h-6 text-[var(--foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
              <svg className="w-5 h-5 text-[var(--foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {/* Title */}
          <div className="flex-1 text-center min-w-0">
            {setlist && (
              <p className="text-xs text-[var(--accent-blue)] font-medium truncate">
                {setlist.name} ({songIndex + 1}/{setlist.songIds.length})
              </p>
            )}
            <h1 className="text-lg font-bold text-[var(--foreground)] truncate">{song?.name || 'New Song'}</h1>
            {song?.artist && (
              <p className="text-sm text-[var(--muted)] truncate">{song.artist}</p>
            )}
          </div>

          {/* Next button (setlist) */}
          {setlist && (
            <button
              onClick={onNextSong}
              disabled={!hasNext}
              className="w-10 h-10 rounded-xl hover:bg-[var(--card)] active:scale-95 transition-all flex items-center justify-center disabled:opacity-30"
              aria-label="Next song"
            >
              <svg className="w-5 h-5 text-[var(--foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {/* Edit toggle */}
          <button
            onClick={() => setMode('edit')}
            className="w-10 h-10 rounded-xl hover:bg-[var(--card)] active:scale-95 transition-all flex items-center justify-center"
            aria-label="Edit"
          >
            <svg className="w-5 h-5 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        </header>

        {/* Info bar */}
        <div className="flex items-center justify-center gap-4 px-4 py-3 bg-[var(--card)] border-b border-[var(--border)]">
          <span className="font-mono font-bold text-[var(--foreground)]">{bpm} BPM</span>
          {musicalKey && (
            <>
              <span className="text-[var(--muted)]">|</span>
              <span className="font-medium text-[var(--foreground)]">{musicalKey}</span>
            </>
          )}
          <span className="text-[var(--muted)]">|</span>
          <span className="font-medium text-[var(--foreground)]">{timeSignature}</span>
          <span className="text-[var(--muted)]">|</span>
          <button
            onClick={togglePlayStop}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95 ${
              isPlaying ? 'bg-red-500' : 'bg-[var(--accent-green)]'
            }`}
            aria-label={isPlaying ? 'Stop' : 'Play'}
          >
            {isPlaying ? (
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="4" height="12" />
                <rect x="14" y="6" width="4" height="12" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 20h14l-3-15H8l-3 15z" />
                <path d="M12 16l5-10" />
                <circle cx="17" cy="6" r="1.5" fill="currentColor" />
              </svg>
            )}
          </button>
        </div>

        {/* Notes area */}
        <div className="flex-1 overflow-y-auto p-4 pb-24">
          {notes ? (
            <pre className="whitespace-pre-wrap font-mono text-base text-[var(--foreground)] leading-relaxed">
              {notes}
            </pre>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <svg className="w-16 h-16 text-[var(--muted)] mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-[var(--muted)]">No notes for this song</p>
              <button
                onClick={() => setMode('edit')}
                className="mt-4 px-4 py-2 text-[var(--accent-blue)] font-medium"
              >
                Tap to add notes
              </button>
            </div>
          )}
        </div>

        {/* Beat indicator */}
        <div className="fixed bottom-16 left-0 right-0 flex justify-center gap-2 py-3 bg-[var(--background)] border-t border-[var(--border)]">
          {Array.from({ length: beatsPerMeasure }).map((_, index) => (
            <div
              key={index}
              className={`w-3 h-3 rounded-full transition-all duration-100 ${
                index === currentBeat && isBeating
                  ? index === 0
                    ? 'bg-[var(--accent-blue)] scale-150'
                    : 'bg-[var(--accent-green)] scale-150'
                  : 'bg-[var(--card)]'
              }`}
            />
          ))}
        </div>
      </div>
    );
  }

  // Edit mode view
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
            <svg className="w-6 h-6 text-[var(--foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        <div className="flex-1 min-w-0">
          {song ? (
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
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
              onChange={(e) => setArtist(e.target.value)}
              placeholder="Artist"
              className="w-full text-sm bg-transparent text-[var(--muted)] placeholder:text-[var(--muted)] focus:outline-none"
            />
          )}
        </div>

        {/* Performance toggle - expand/fullscreen icon */}
        <button
          onClick={() => setMode('performance')}
          className="w-10 h-10 rounded-xl hover:bg-[var(--card)] active:scale-95 transition-all flex items-center justify-center"
          aria-label="Performance mode"
        >
          <svg className="w-5 h-5 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
          </svg>
        </button>

        <button
          onClick={handleSave}
          className="px-4 py-2 rounded-xl bg-[var(--accent-blue)] text-white font-semibold active:scale-95 transition-all"
        >
          Save
        </button>
      </header>

      {/* Controls section */}
      <div className="px-4 py-4 space-y-3 border-b border-[var(--border)]">
        {/* Time signature and Key */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setShowTimeSigModal(true)}
            className="h-12 px-4 rounded-xl bg-[var(--card)] border border-[var(--border)] hover:bg-[var(--border)] active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <span className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Time</span>
            <span className="text-lg font-bold text-[var(--foreground)]">{timeSignature}</span>
          </button>

          <KeySelector value={musicalKey} onChange={setMusicalKey} className="w-full h-12" />
        </div>

        {/* BPM controls and Start button */}
        <div className="grid grid-cols-2 gap-3">
          {/* Tempo controls - aligned with Time sig */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleBpmChange(bpm - 1)}
              className="w-9 h-10 flex-shrink-0 rounded-xl bg-[var(--card)] border border-[var(--border)] hover:bg-[var(--border)] active:scale-95 transition-all flex items-center justify-center"
              aria-label="Decrease BPM"
            >
              <svg className="w-4 h-4 text-[var(--foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
              </svg>
            </button>

            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={bpmInput}
              onChange={(e) => {
                // Only allow digits
                const filtered = e.target.value.replace(/\D/g, '');
                setBpmInput(filtered);
              }}
              onBlur={() => {
                const val = parseInt(bpmInput);
                if (!isNaN(val) && val > 0) {
                  // Clamp to valid range and update both bpm and input
                  const clamped = Math.max(30, Math.min(300, val));
                  handleBpmChange(clamped);
                  setBpmInput(String(clamped));
                } else {
                  setBpmInput(String(bpm));
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur();
                }
              }}
              className="min-w-0 flex-1 h-10 text-center text-lg font-bold bg-[var(--card)] border border-[var(--border)] rounded-xl text-[var(--foreground)] focus:outline-none focus:border-[var(--accent-blue)]"
              aria-label="BPM"
            />

            <button
              onClick={() => handleBpmChange(bpm + 1)}
              className="w-9 h-10 flex-shrink-0 rounded-xl bg-[var(--card)] border border-[var(--border)] hover:bg-[var(--border)] active:scale-95 transition-all flex items-center justify-center"
              aria-label="Increase BPM"
            >
              <svg className="w-4 h-4 text-[var(--foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          {/* Start button - aligned with Key */}
          <button
            onClick={togglePlayStop}
            className={`h-10 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 ${
              isPlaying ? 'bg-red-500' : 'bg-[var(--accent-green)]'
            }`}
            aria-label={isPlaying ? 'Stop' : 'Start'}
          >
            {isPlaying ? (
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="4" height="12" />
                <rect x="14" y="6" width="4" height="12" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 20h14l-3-15H8l-3 15z" />
                <path d="M12 16l5-10" />
                <circle cx="17" cy="6" r="1.5" fill="currentColor" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Beat indicator */}
      <div className="flex justify-center gap-2 py-3 border-b border-[var(--border)]">
        {Array.from({ length: beatsPerMeasure }).map((_, index) => (
          <div
            key={index}
            className={`w-3 h-3 rounded-full transition-all duration-100 ${
              index === currentBeat && isBeating
                ? index === 0
                  ? 'bg-[var(--accent-blue)] scale-150'
                  : 'bg-[var(--accent-green)] scale-150'
                : 'bg-[var(--card)]'
            }`}
          />
        ))}
      </div>

      {/* Notes area */}
      <div className="flex-1 overflow-y-auto p-4 pb-20">
        <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider block mb-2">
          Notes / Chart
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add notes, chord progressions, or chart info..."
          className="w-full h-64 px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-xl text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent-blue)] resize-none font-mono text-sm"
        />
      </div>

      {/* Time Signature Modal */}
      {showTimeSigModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowTimeSigModal(false)}
        >
          <div
            className="bg-[var(--background)] rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-[var(--border)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-[var(--foreground)] text-center mb-6">
              Time Signature
            </h2>

            <div className="flex items-center justify-center gap-4 mb-8">
              <div className="flex flex-col items-center gap-2">
                <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Beats</label>
                <input
                  type="number"
                  min="1"
                  max="16"
                  value={customNumerator}
                  onChange={(e) => {
                    const num = parseInt(e.target.value) || 1;
                    setCustomNumerator(Math.max(1, Math.min(16, num)));
                  }}
                  className="w-20 h-16 text-center text-3xl font-bold bg-[var(--card)] border-2 border-[var(--border)] rounded-xl text-[var(--foreground)] focus:outline-none focus:border-[var(--accent-blue)]"
                />
              </div>

              <span className="text-4xl font-bold text-[var(--muted)] mt-6">/</span>

              <div className="flex flex-col items-center gap-2">
                <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Note</label>
                <select
                  value={customDenominator}
                  onChange={(e) => setCustomDenominator(parseInt(e.target.value))}
                  className="w-20 h-16 text-center text-3xl font-bold bg-[var(--card)] border-2 border-[var(--border)] rounded-xl text-[var(--foreground)] focus:outline-none focus:border-[var(--accent-blue)] cursor-pointer appearance-none"
                >
                  {DENOMINATORS.map((den) => (
                    <option key={den} value={den}>{den}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowTimeSigModal(false)}
                className="flex-1 h-12 rounded-xl bg-[var(--card)] hover:bg-[var(--border)] text-[var(--foreground)] font-semibold transition-all active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={applyTimeSignature}
                className="flex-1 h-12 rounded-xl bg-[var(--accent-blue)] hover:brightness-110 text-white font-semibold transition-all active:scale-95"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Name Modal (for new songs) */}
      {showSaveModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowSaveModal(false)}
        >
          <div
            className="bg-[var(--background)] rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-[var(--border)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-[var(--foreground)] text-center mb-6">
              Save Song
            </h2>

            <div className="space-y-4 mb-6">
              <div>
                <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider block mb-2">
                  Song Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter song name"
                  className="w-full px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-xl text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent-blue)]"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider block mb-2">
                  Artist
                </label>
                <input
                  type="text"
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                  placeholder="Enter artist name"
                  className="w-full px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-xl text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent-blue)]"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowSaveModal(false)}
                className="flex-1 h-12 rounded-xl bg-[var(--card)] hover:bg-[var(--border)] text-[var(--foreground)] font-semibold transition-all active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveWithName}
                disabled={!name.trim()}
                className="flex-1 h-12 rounded-xl bg-[var(--accent-blue)] hover:brightness-110 text-white font-semibold transition-all active:scale-95 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
