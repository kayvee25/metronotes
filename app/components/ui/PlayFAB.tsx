'use client';

import { useState, useRef, useEffect } from 'react';
import PlayButton from './PlayButton';
import { formatDuration } from '../../lib/audio-processing';


type AudioMode = 'metronome' | 'backingtrack' | 'off';

interface BackingTrackControls {
  isPlaying: boolean;
  isCountingIn: boolean;
  currentTime: number;
  duration: number;
  buffered: number;
  volume: number;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (vol: number) => void;
}

interface PlayFABProps {
  // Metronome props
  bpm: number;
  isPlaying: boolean;
  currentBeat: number;
  isBeating: boolean;
  isMuted?: boolean;
  onTogglePlay: () => void;
  onBpmChange: (bpm: number) => void;
  onToggleMute?: () => void;
  // Audio mode props
  audioMode?: AudioMode;
  onAudioModeChange?: (mode: AudioMode) => void;
  hasBackingTrack?: boolean;
  backingTrackControls?: BackingTrackControls;
  countInBars?: number;
}

function ModeSwitch({
  audioMode,
  onAudioModeChange,
  hasBackingTrack,
}: {
  audioMode: AudioMode;
  onAudioModeChange: (mode: AudioMode) => void;
  hasBackingTrack: boolean;
}) {
  const modes: { value: AudioMode; label: string }[] = [
    { value: 'metronome', label: 'Click' },
    ...(hasBackingTrack ? [{ value: 'backingtrack' as AudioMode, label: 'Track' }] : []),
    { value: 'off', label: 'Off' },
  ];

  return (
    <div className="flex rounded-lg bg-[var(--background)] p-0.5 mb-3" role="group" aria-label="Audio mode">
      {modes.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => onAudioModeChange(value)}
          className={`flex-1 py-1.5 text-[11px] font-semibold rounded-md transition-colors ${
            audioMode === value
              ? 'bg-[var(--accent)] text-white'
              : 'text-[var(--muted)] hover:text-[var(--foreground)]'
          }`}
          aria-label={`${label} mode`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function CountInBadge({ countInBars }: { countInBars: number }) {
  const label = countInBars === 0 ? 'No count-in' : `${countInBars} bar${countInBars > 1 ? 's' : ''} count-in`;
  return (
    <div className="flex items-center justify-center gap-1.5 mt-2 text-[10px] text-[var(--muted)]">
      <span className="uppercase tracking-wider font-medium">Count-in</span>
      <span className="font-bold text-[var(--foreground)]">{countInBars === 0 ? 'Off' : `${countInBars} bar${countInBars > 1 ? 's' : ''}`}</span>
      <span className="sr-only">{label}</span>
    </div>
  );
}

export default function PlayFAB({
  bpm,
  isPlaying,
  currentBeat,
  isBeating,
  isMuted = false,
  onTogglePlay,
  onBpmChange,
  onToggleMute,
  audioMode = 'metronome',
  onAudioModeChange,
  hasBackingTrack = false,
  backingTrackControls,
  countInBars = 1,
}: PlayFABProps) {
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

  // Hidden when off
  if (audioMode === 'off' && !panelOpen) {
    // Show a minimal dot to allow re-opening
    return (
      <div className="fixed bottom-6 right-4 z-50" ref={panelRef}>
        {panelOpen ? null : (
          <button
            onClick={() => setPanelOpen(true)}
            className="w-8 h-8 rounded-full shadow-lg flex items-center justify-center bg-[var(--border)] opacity-50 hover:opacity-100 transition-opacity"
            aria-label="Open play controls"
          >
            <svg className="w-4 h-4 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13" />
            </svg>
          </button>
        )}
      </div>
    );
  }

  const bt = backingTrackControls;
  const isBackingTrackMode = audioMode === 'backingtrack';
  const hasModeSwitch = onAudioModeChange != null;

  // Determine what's "active" for the collapsed FAB
  const isAnythingPlaying = isBackingTrackMode ? (bt?.isPlaying ?? false) : isPlaying;

  return (
    <div className="fixed bottom-6 right-4 z-50" ref={panelRef}>
      {panelOpen ? (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl p-4 w-56 backdrop-blur-sm">
          {/* Mode switch */}
          {hasModeSwitch && (
            <ModeSwitch
              audioMode={audioMode}
              onAudioModeChange={onAudioModeChange}
              hasBackingTrack={hasBackingTrack}
            />
          )}

          {/* Metronome mode content */}
          {audioMode === 'metronome' && (
            <>
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
                <PlayButton
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
            </>
          )}

          {/* Backing track mode content */}
          {audioMode === 'backingtrack' && bt && (
            <>
              {/* Play/pause + time */}
              <div className="flex items-center gap-3 mb-2">
                <button
                  onClick={bt.isPlaying ? bt.onPause : bt.onPlay}
                  className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform ${
                    bt.isPlaying ? 'bg-[var(--accent-danger)]' : 'bg-[var(--accent)]'
                  }`}
                  aria-label={bt.isPlaying ? 'Pause' : 'Play'}
                >
                  {bt.isPlaying ? (
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
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-[var(--foreground)] font-mono">
                    {formatDuration(bt.currentTime)}
                  </div>
                  <div className="text-[10px] text-[var(--muted)]">
                    / {formatDuration(bt.duration)}
                  </div>
                </div>
                {bt.isPlaying && (
                  <button
                    onClick={bt.onStop}
                    className="w-8 h-8 rounded-lg bg-[var(--background)] border border-[var(--border)] flex items-center justify-center active:scale-95 transition-all"
                    aria-label="Stop"
                  >
                    <svg className="w-4 h-4 text-[var(--foreground)]" fill="currentColor" viewBox="0 0 24 24">
                      <rect x="6" y="6" width="12" height="12" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Seek bar */}
              {bt.duration > 0 && (
                <div className="mb-2">
                  <div className="relative h-3 flex items-center">
                    <div className="absolute inset-x-0 h-1 rounded-full bg-[var(--border)]" />
                    <div
                      className="absolute h-1 rounded-full bg-[var(--muted)]/30"
                      style={{ width: `${(bt.buffered / bt.duration) * 100}%` }}
                    />
                    <div
                      className="absolute h-1 rounded-full bg-[var(--accent)]"
                      style={{ width: `${(bt.currentTime / bt.duration) * 100}%` }}
                    />
                    <input
                      type="range"
                      min={0}
                      max={bt.duration}
                      step={0.1}
                      value={bt.currentTime}
                      onChange={(e) => bt.onSeek(parseFloat(e.target.value))}
                      className="absolute inset-0 w-full h-full appearance-none cursor-pointer bg-transparent [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--accent)] [&::-webkit-slider-thumb]:shadow-sm"
                      aria-label="Seek"
                      aria-valuemin={0}
                      aria-valuemax={bt.duration}
                      aria-valuenow={bt.currentTime}
                    />
                  </div>
                </div>
              )}

              {/* Volume slider */}
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-3.5 h-3.5 text-[var(--muted)] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={bt.volume}
                  onChange={(e) => bt.onVolumeChange(parseFloat(e.target.value))}
                  className="flex-1 h-1 rounded-full appearance-none cursor-pointer bg-[var(--border)] accent-[var(--accent)] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--accent)]"
                  aria-label="Volume"
                  aria-valuemin={0}
                  aria-valuemax={1}
                  aria-valuenow={bt.volume}
                />
                <svg className="w-3.5 h-3.5 text-[var(--muted)] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
              </div>

              {/* Count-in display */}
              <CountInBadge countInBars={countInBars} />
            </>
          )}

          {/* Off mode — just the switch */}
          {audioMode === 'off' && (
            <p className="text-xs text-[var(--muted)] text-center">Audio disabled</p>
          )}
        </div>
      ) : (
        <button
          onClick={() => setPanelOpen(true)}
          className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all active:scale-95 ${
            isAnythingPlaying ? 'bg-[var(--accent-danger)]' : 'bg-[var(--accent)]'
          }`}
          aria-label="Open play controls"
        >
          {isAnythingPlaying ? (
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="4" height="12" />
              <rect x="14" y="6" width="4" height="12" />
            </svg>
          ) : isBackingTrackMode ? (
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          ) : (
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}
