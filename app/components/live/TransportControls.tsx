'use client';

import { useState, useRef, useEffect, memo } from 'react';
import { TransportState, AudioMode } from '../SongView';
import { Attachment } from '../../types';
import { BPM } from '../../lib/constants';

interface TransportControlsProps {
  transport: TransportState | null;
  onTogglePlay: () => void;
  onBpmChange: (bpm: number) => void;
  onToggleMute: () => void;
  onChangeAudioMode: (mode: AudioMode) => void;
  onBtPlay: () => void;
  onBtPause: () => void;
  onBtSeek: (time: number) => void;
  onBtSetVolume: (vol: number) => void;
  onMetronomeVolumeChange?: (vol: number) => void;
  readOnly?: boolean;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Isolated beat button — only re-renders when beat state changes */
const BeatButton = memo(function BeatButton({
  isPlaying, isBeating, currentBeat, onTogglePlay,
}: {
  isPlaying: boolean; isBeating: boolean; currentBeat: number; onTogglePlay: () => void;
}) {
  return (
    <button
      onClick={onTogglePlay}
      className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-75 active:scale-90 ${
        isPlaying && isBeating && currentBeat === 0
          ? 'bg-red-500 text-white scale-110 shadow-[0_0_14px_rgba(239,68,68,0.5)]'
          : isPlaying && isBeating
          ? 'bg-yellow-500 text-white scale-105 shadow-[0_0_12px_rgba(234,179,8,0.5)]'
          : 'bg-[var(--accent)] text-white shadow-md'
      }`}
      aria-label={isPlaying ? 'Stop' : 'Play'}
      data-testid={isPlaying ? 'btn-stop' : 'btn-play'}
    >
      {isPlaying ? (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <rect x="6" y="5" width="4" height="14" rx="1" />
          <rect x="14" y="5" width="4" height="14" rx="1" />
        </svg>
      ) : (
        <svg className="w-4.5 h-4.5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
      )}
    </button>
  );
});

type SourceOption = { type: 'metronome' } | { type: 'none' } | { type: 'audio'; attachment: Attachment };

/** Read-only beat indicator — shows synced beat without play/stop control */
const ReadOnlyBeatIndicator = memo(function ReadOnlyBeatIndicator({
  isPlaying, isBeating, currentBeat,
}: {
  isPlaying: boolean; isBeating: boolean; currentBeat: number;
}) {
  if (!isPlaying) return null;
  return (
    <div
      className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-75 ${
        isBeating && currentBeat === 0
          ? 'bg-red-500 text-white scale-110 shadow-[0_0_14px_rgba(239,68,68,0.5)]'
          : isBeating
          ? 'bg-yellow-500 text-white scale-105 shadow-[0_0_12px_rgba(234,179,8,0.5)]'
          : 'bg-[var(--card)] text-[var(--muted)]'
      }`}
    >
      <span className="text-sm font-bold">{currentBeat + 1}</span>
    </div>
  );
});

export default function TransportControls({
  transport,
  onTogglePlay,
  onBpmChange,
  onToggleMute,
  onChangeAudioMode,
  onBtPlay,
  onBtPause,
  onBtSeek,
  onBtSetVolume,
  onMetronomeVolumeChange,
  readOnly = false,
}: TransportControlsProps) {
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [showVolume, setShowVolume] = useState(false);
  const seekBarRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click/touch
  useEffect(() => {
    if (!showSourcePicker && !showVolume) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      const target = e instanceof TouchEvent ? (e.touches[0]?.target || e.target) : e.target;
      if (showSourcePicker && sourceRef.current && !sourceRef.current.contains(target as Node)) {
        setShowSourcePicker(false);
      }
      if (showVolume && volumeRef.current && !volumeRef.current.contains(target as Node)) {
        setShowVolume(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [showSourcePicker, showVolume]);

  if (!transport) return null;

  // Read-only mode
  if (readOnly) {
    const roVolume = transport.isMuted ? 0 : (transport.metronomeVolume ?? 1);

    // Backing track mode — show disabled play/pause + seek bar
    if (transport.audioMode === 'backingtrack') {
      const roProgress = transport.btDuration > 0 ? (transport.btCurrentTime / transport.btDuration) * 100 : 0;
      return (
        <div className="border-b border-[var(--border)]/50">
          <div className="flex items-center px-4 py-2">
            {/* Music note icon (no interaction) */}
            <div className="w-20 flex-shrink-0 flex items-center">
              <div className="w-9 h-9 flex items-center justify-center text-[var(--accent)]">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
            </div>

            {/* Time display */}
            <span className="flex-1 text-center text-xs font-mono text-[var(--muted)] tabular-nums">
              {formatTime(transport.btCurrentTime)}
              <span className="text-[var(--border)]"> / </span>
              {formatTime(transport.btDuration)}
            </span>

            {/* Disabled play/pause indicator */}
            <div className="w-20 flex-shrink-0 flex justify-end">
              <div
                className={`w-11 h-11 rounded-full flex items-center justify-center opacity-50 ${
                  transport.btIsPlaying
                    ? 'bg-[var(--accent)] text-white shadow-[0_0_10px_rgba(224,159,79,0.3)]'
                    : 'bg-[var(--card)] text-[var(--muted)]'
                }`}
              >
                {transport.btIsPlaying ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="5" width="4" height="14" rx="1" />
                    <rect x="14" y="5" width="4" height="14" rx="1" />
                  </svg>
                ) : (
                  <svg className="w-4.5 h-4.5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </div>
            </div>
          </div>

          {/* Read-only seek bar */}
          <div className="px-4 pb-2 h-4 flex items-center">
            <div className="w-full h-1 bg-[var(--border)] rounded-full overflow-visible relative">
              <div
                className="absolute inset-y-0 left-0 bg-[var(--accent)] rounded-full transition-[width] duration-100"
                style={{ width: `${roProgress}%` }}
              />
            </div>
          </div>
        </div>
      );
    }

    // Off mode — nothing to show
    if (transport.audioMode === 'off') {
      return null;
    }

    // Metronome mode — beat indicator + BPM
    return (
      <div className="border-b border-[var(--border)]/50">
        <div className="flex items-center px-4 py-2">
          {/* Volume */}
          <div className="relative w-20 flex-shrink-0" ref={volumeRef}>
            <button
              onClick={() => setShowVolume(!showVolume)}
              className={`w-9 h-9 rounded-lg hover:bg-[var(--card)] active:scale-95 transition-all flex items-center justify-center ${
                roVolume === 0 ? 'text-red-400' : 'text-[var(--muted)]'
              }`}
              aria-label="Volume"
              data-testid="btn-volume"
            >
              {roVolume === 0 ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
              )}
            </button>
            {showVolume && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-lg z-30 p-2 flex flex-col items-center">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={roVolume}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (val === 0 && !transport.isMuted) onToggleMute();
                    else if (val > 0 && transport.isMuted) onToggleMute();
                    if (val > 0) onMetronomeVolumeChange?.(val);
                  }}
                  aria-label="Volume"
                  className="h-24 accent-[var(--accent)]"
                  style={{ writingMode: 'vertical-lr', direction: 'rtl' } as React.CSSProperties}
                />
              </div>
            )}
          </div>

          {/* BPM display — centered, no +/- */}
          <span className="flex-1 text-center text-sm font-mono font-bold text-[var(--foreground)] tabular-nums">
            {transport.bpm}
          </span>

          {/* Beat indicator — read-only, no play/stop */}
          <div className="w-20 flex-shrink-0 flex justify-end">
            <ReadOnlyBeatIndicator
              isPlaying={transport.isPlaying}
              isBeating={transport.isBeating}
              currentBeat={transport.currentBeat}
            />
          </div>
        </div>
      </div>
    );
  }

  const { bpm, isPlaying, currentBeat, isBeating, isMuted,
          audioMode, audioAttachments,
          btIsPlaying, btCurrentTime, btDuration, btBuffered, btVolume, btActiveTrackId } = transport;

  // Volume value
  const metronomeVolume = transport.metronomeVolume ?? 1;
  const volumeValue = audioMode === 'backingtrack' ? btVolume : (isMuted ? 0 : metronomeVolume);
  const handleVolumeChange = (val: number) => {
    if (audioMode === 'backingtrack') {
      onBtSetVolume(val);
    } else {
      if (val === 0 && !isMuted) onToggleMute();
      else if (val > 0 && isMuted) onToggleMute();
      if (val > 0) onMetronomeVolumeChange?.(val);
    }
  };

  // Source options
  const sources: SourceOption[] = [
    { type: 'metronome' },
    ...audioAttachments.map(a => ({ type: 'audio' as const, attachment: a })),
    { type: 'none' },
  ];

  const handleSourceSelect = (source: SourceOption) => {
    setShowSourcePicker(false);
    if (source.type === 'metronome') onChangeAudioMode('metronome');
    else if (source.type === 'none') onChangeAudioMode('off');
    else onChangeAudioMode('backingtrack');
  };

  const handleSeekClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!seekBarRef.current || btDuration <= 0) return;
    const rect = seekBarRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onBtSeek(ratio * btDuration);
  };

  const handleSeekTouch = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!seekBarRef.current || btDuration <= 0) return;
    const rect = seekBarRef.current.getBoundingClientRect();
    const touch = e.touches[0] || e.changedTouches[0];
    const ratio = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
    onBtSeek(ratio * btDuration);
  };

  // Reusable source icons
  const metronomeIcon = (className: string) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      {/* Metronome body */}
      <path d="M8 22h8l-2.5-17h-3L8 22z" opacity={0.15} />
      <path d="M8 22h8l-2.5-17h-3L8 22z" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
      {/* Pendulum arm */}
      <line x1="12" y1="14" x2="15.5" y2="4.5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
      {/* Pendulum weight */}
      <circle cx="16" cy="3.5" r="1.8" />
    </svg>
  );

  const musicNoteIcon = (className: string) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
    </svg>
  );

  const offIcon = (className: string) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
    </svg>
  );

  // Current source icon for the button
  const sourceIcon = audioMode === 'metronome' ? metronomeIcon("w-4 h-4")
    : audioMode === 'backingtrack' ? musicNoteIcon("w-4 h-4")
    : offIcon("w-4 h-4");

  // Get icon for a source option
  const getSourceIcon = (source: SourceOption) => {
    if (source.type === 'metronome') return metronomeIcon("w-5 h-5 flex-shrink-0");
    if (source.type === 'none') return offIcon("w-5 h-5 flex-shrink-0");
    return musicNoteIcon("w-5 h-5 flex-shrink-0");
  };

  // Source picker dropdown
  const sourcePicker = showSourcePicker && (
    <div className="absolute top-full left-0 mt-2 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-lg z-30 min-w-[160px] overflow-hidden">
      {sources.map((source) => {
        const label = source.type === 'metronome' ? 'Metronome'
          : source.type === 'none' ? 'Off'
          : source.attachment.name || source.attachment.fileName || source.attachment.cloudFileName || 'Audio';
        const isActive = (source.type === 'metronome' && audioMode === 'metronome')
          || (source.type === 'none' && audioMode === 'off')
          || (source.type === 'audio' && audioMode === 'backingtrack' && source.attachment.id === btActiveTrackId);
        return (
          <button
            key={source.type === 'audio' ? source.attachment.id : source.type}
            onClick={() => handleSourceSelect(source)}
            className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${
              isActive ? 'text-[var(--accent)] bg-[var(--accent)]/10' : 'text-[var(--foreground)] hover:bg-[var(--border)]'
            }`}
          >
            {getSourceIcon(source)}
            {label}
          </button>
        );
      })}
    </div>
  );

  // Volume popup (vertical slider above icon)
  const volumePopup = showVolume && (
    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-lg z-30 p-2 flex flex-col items-center">
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={volumeValue}
        onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
        aria-label="Volume"
        className="h-24 accent-[var(--accent)]"
        style={{ writingMode: 'vertical-lr', direction: 'rtl' } as React.CSSProperties}
      />
    </div>
  );

  // Volume icon
  const volumeIcon = volumeValue === 0 ? (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
    </svg>
  );

  // ── Off mode — minimal row with just source icon ──────────
  if (audioMode === 'off') {
    return (
      <div className="border-b border-[var(--border)]/50">
        <div className="flex items-center px-4 py-2">
          <div className="relative" ref={sourceRef}>
            <button
              onClick={() => setShowSourcePicker(!showSourcePicker)}
              className="w-9 h-9 rounded-lg hover:bg-[var(--card)] active:scale-95 transition-all flex items-center justify-center text-[var(--muted)]"
              aria-label="Audio source"
              data-testid="btn-audio-source"
            >
              {sourceIcon}
            </button>
            {sourcePicker}
          </div>
        </div>
      </div>
    );
  }

  // ── Metronome mode ──────────────────────────────────────────
  if (audioMode === 'metronome') {
    return (
      <div className="border-b border-[var(--border)]/50">
        <div className="flex items-center px-4 py-2">
          {/* Left icons — fixed width for symmetry */}
          <div className="flex items-center gap-1 w-20 flex-shrink-0">
            {/* Source icon */}
            <div className="relative" ref={sourceRef}>
              <button
                onClick={() => setShowSourcePicker(!showSourcePicker)}
                className="w-9 h-9 rounded-lg hover:bg-[var(--card)] active:scale-95 transition-all flex items-center justify-center text-[var(--accent)]"
                aria-label="Audio source"
              data-testid="btn-audio-source"
              >
                {sourceIcon}
              </button>
              {sourcePicker}
            </div>

            {/* Volume icon */}
            <div className="relative" ref={volumeRef}>
              <button
                onClick={() => setShowVolume(!showVolume)}
                className={`w-9 h-9 rounded-lg hover:bg-[var(--card)] active:scale-95 transition-all flex items-center justify-center ${
                  volumeValue === 0 ? 'text-red-400' : 'text-[var(--muted)]'
                }`}
                aria-label="Volume"
                data-testid="btn-volume"
              >
                {volumeIcon}
              </button>
              {volumePopup}
            </div>
          </div>

          {/* Tempo nudge — centered */}
          <div className="flex-1 flex items-center justify-center gap-1">
            <button
              onClick={() => onBpmChange(bpm - 1)}
              disabled={bpm <= BPM.MIN}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card)] disabled:opacity-30 transition-all active:scale-95"
              aria-label="Decrease tempo"
              data-testid="btn-decrease-tempo"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
              </svg>
            </button>
            <span className="text-sm font-mono font-bold text-[var(--foreground)] w-9 text-center tabular-nums">
              {bpm}
            </span>
            <button
              onClick={() => onBpmChange(bpm + 1)}
              disabled={bpm >= BPM.MAX}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card)] disabled:opacity-30 transition-all active:scale-95"
              aria-label="Increase tempo"
              data-testid="btn-increase-tempo"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>

          </div>

          {/* Play/Stop button — blinks red on beat 1, amber on other beats */}
          <div className="w-20 flex-shrink-0 flex justify-end">
            <BeatButton
              isPlaying={isPlaying}
              isBeating={isBeating}
              currentBeat={currentBeat}
              onTogglePlay={onTogglePlay}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Backing track mode ──────────────────────────────────────
  const progress = btDuration > 0 ? (btCurrentTime / btDuration) * 100 : 0;
  const buffered = btDuration > 0 ? (btBuffered / btDuration) * 100 : 0;

  return (
    <div className="border-b border-[var(--border)]/50">
      {/* Control row */}
      <div className="flex items-center px-4 py-2">
        {/* Left icons — fixed width for symmetry */}
        <div className="flex items-center gap-1 w-20 flex-shrink-0">
          {/* Source icon */}
          <div className="relative" ref={sourceRef}>
            <button
              onClick={() => setShowSourcePicker(!showSourcePicker)}
              className="w-9 h-9 rounded-lg hover:bg-[var(--card)] active:scale-95 transition-all flex items-center justify-center text-[var(--accent)]"
              aria-label="Audio source"
              data-testid="btn-audio-source"
            >
              {sourceIcon}
            </button>
            {sourcePicker}
          </div>

          {/* Volume icon */}
          <div className="relative" ref={volumeRef}>
            <button
              onClick={() => setShowVolume(!showVolume)}
              className={`w-9 h-9 rounded-lg hover:bg-[var(--card)] active:scale-95 transition-all flex items-center justify-center ${
                volumeValue === 0 ? 'text-red-400' : 'text-[var(--muted)]'
              }`}
              aria-label="Volume"
            >
              {volumeIcon}
            </button>
            {volumePopup}
          </div>
        </div>

        {/* Time display — centered */}
        <span className="flex-1 text-center text-xs font-mono text-[var(--muted)] tabular-nums">
          {formatTime(btCurrentTime)}
          <span className="text-[var(--border)]"> / </span>
          {formatTime(btDuration)}
        </span>

        {/* Play/Pause button — fixed width matching left side */}
        <div className="w-20 flex-shrink-0 flex justify-end">
          <button
            onClick={btIsPlaying ? onBtPause : onBtPlay}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-90 ${
              btIsPlaying
                ? 'bg-[var(--accent)] text-white shadow-[0_0_10px_rgba(224,159,79,0.3)]'
                : 'bg-[var(--accent)] text-white shadow-md'
            }`}
            aria-label={btIsPlaying ? 'Pause' : 'Play'}
            data-testid={btIsPlaying ? 'btn-stop' : 'btn-play'}
          >
            {btIsPlaying ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            ) : (
              <svg className="w-4.5 h-4.5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Seek bar */}
      <div
        ref={seekBarRef}
        role="slider"
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={Math.round(btDuration)}
        aria-valuenow={Math.round(btCurrentTime)}
        aria-valuetext={`${formatTime(btCurrentTime)} of ${formatTime(btDuration)}`}
        tabIndex={0}
        className="px-4 pb-2 h-4 flex items-center cursor-pointer group"
        onClick={handleSeekClick}
        onTouchStart={(e) => {
          e.preventDefault();
          handleSeekTouch(e);
        }}
        onTouchMove={handleSeekTouch}
        onKeyDown={(e) => {
          if (btDuration <= 0) return;
          const step = btDuration * 0.05; // 5% per arrow key
          if (e.key === 'ArrowRight') { e.preventDefault(); onBtSeek(Math.min(btDuration, btCurrentTime + step)); }
          else if (e.key === 'ArrowLeft') { e.preventDefault(); onBtSeek(Math.max(0, btCurrentTime - step)); }
          else if (e.key === 'Home') { e.preventDefault(); onBtSeek(0); }
          else if (e.key === 'End') { e.preventDefault(); onBtSeek(btDuration); }
        }}
      >
        <div className="w-full h-1 group-hover:h-1.5 bg-[var(--border)] rounded-full overflow-visible relative transition-all">
          <div
            className="absolute inset-y-0 left-0 bg-[var(--muted)]/20 rounded-full"
            style={{ width: `${buffered}%` }}
          />
          <div
            className="absolute inset-y-0 left-0 bg-[var(--accent)] rounded-full transition-[width] duration-100"
            style={{ width: `${progress}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-[var(--accent)] shadow-md transition-[left] duration-100 group-hover:scale-125"
            style={{ left: `${progress}%`, marginLeft: '-6px' }}
          />
        </div>
      </div>
    </div>
  );
}
