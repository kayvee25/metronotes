'use client';

import { useState, useRef, useCallback } from 'react';
import { Song, Setlist, Attachment } from '../../types';
import { ANIMATION } from '../../lib/constants';
import PlayFAB from '../ui/PlayFAB';
import PageDots from '../ui/PageDots';
import AttachmentPage from './AttachmentPage';

interface PerformanceModeProps {
  song?: Song | null;
  attachments: Attachment[];
  attachmentsLoading?: boolean;
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
  audioMode?: 'metronome' | 'backingtrack' | 'off';
  onAudioModeChange?: (mode: 'metronome' | 'backingtrack' | 'off') => void;
  hasBackingTrack?: boolean;
  backingTrackControls?: {
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
  };
  countInBars?: number;
  onCountInBarsChange?: (bars: number) => void;
}

export default function PerformanceMode({
  song,
  attachments,
  attachmentsLoading = false,
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
  audioMode,
  onAudioModeChange,
  hasBackingTrack,
  backingTrackControls,
  countInBars,
  onCountInBarsChange,
}: PerformanceModeProps) {
  const hasPrev = setlist && songIndex > 0;
  const hasNext = setlist && songIndex < (setlist.songIds.length - 1);

  // Find default attachment index and track song changes
  const defaultIndex = Math.max(0, attachments.findIndex(a => a.isDefault));
  const prevSongIdRef = useRef(song?.id);
  const [currentPage, setCurrentPage] = useState(() => defaultIndex);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Reset to default page when song changes (setlist navigation)
  if (prevSongIdRef.current !== song?.id) {
    prevSongIdRef.current = song?.id;
    setCurrentPage(defaultIndex);
  }

  const navigateTo = useCallback((index: number) => {
    if (index === currentPage || index < 0 || index >= attachments.length) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentPage(index);
      setTimeout(() => setIsTransitioning(false), ANIMATION.PAGE_SETTLE_MS);
    }, ANIMATION.PAGE_TRANSITION_MS);
  }, [currentPage, attachments.length]);

  // Build metadata line
  const metaParts = [timeSignature, `${bpm} BPM`, musicalKey].filter(Boolean);
  const metaLine = metaParts.join(' · ');

  const currentAttachment = attachments[currentPage];

  return (
    <div className="flex flex-col h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="flex items-center gap-1 px-3 py-2 border-b border-[var(--border)] max-w-3xl mx-auto w-full">
        {showBack && (
          <button
            onClick={onBack}
            className="w-11 h-11 rounded-xl hover:bg-[var(--card)] active:scale-95 transition-all flex items-center justify-center flex-shrink-0"
            aria-label="Back"
          >
            <svg className="w-6 h-6 text-[var(--foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {setlist && (
          <button
            onClick={onPrevSong}
            disabled={!hasPrev}
            className="w-11 h-11 rounded-xl hover:bg-[var(--card)] active:scale-95 transition-all flex items-center justify-center disabled:opacity-30 flex-shrink-0"
            aria-label="Previous song"
          >
            <svg className="w-5 h-5 text-[var(--foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

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

        {setlist && (
          <button
            onClick={onNextSong}
            disabled={!hasNext}
            className="w-11 h-11 rounded-xl hover:bg-[var(--card)] active:scale-95 transition-all flex items-center justify-center disabled:opacity-30 flex-shrink-0"
            aria-label="Next song"
          >
            <svg className="w-5 h-5 text-[var(--foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {!setlist && (
          <button
            onClick={onSwitchToEdit}
            className="w-11 h-11 rounded-xl hover:bg-[var(--card)] active:scale-95 transition-all flex items-center justify-center flex-shrink-0"
            aria-label="Edit song"
          >
            <svg className="w-5 h-5 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        )}
      </header>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto p-4 pb-20 max-w-3xl mx-auto w-full">
        {/* Metadata + dots */}
        <div className="text-sm text-[var(--muted)] mb-2 text-center">
          {metaLine}
        </div>
        {!attachmentsLoading && attachments.length > 1 && (
          <div className="mb-4 flex items-center justify-center gap-3">
            <button
              onClick={() => navigateTo(currentPage - 1)}
              disabled={currentPage === 0}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-20 transition-colors"
              aria-label="Previous attachment"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <PageDots
              count={attachments.length}
              current={currentPage}
              onDotClick={navigateTo}
            />
            <button
              onClick={() => navigateTo(currentPage + 1)}
              disabled={currentPage === attachments.length - 1}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-20 transition-colors"
              aria-label="Next attachment"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}

        {/* Paged content */}
        {attachmentsLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <svg className="w-8 h-8 text-[var(--muted)] animate-spin mb-3" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={3} opacity={0.25} />
              <path d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
            </svg>
            <p className="text-sm text-[var(--muted)]">Loading attachments...</p>
          </div>
        ) : attachments.length > 0 && currentAttachment ? (
          <div
            className={`transition-opacity duration-150 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}
          >
            <AttachmentPage
              attachment={currentAttachment}
              perfFontSize={perfFontSize}
              perfFontFamily={perfFontFamily}
            />
          </div>
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

      {/* Floating play FAB */}
      <PlayFAB
        bpm={bpm}
        isPlaying={isPlaying}
        currentBeat={currentBeat}
        isBeating={isBeating}
        isMuted={isMuted}
        onTogglePlay={onTogglePlay}
        onBpmChange={onBpmChange}
        onToggleMute={onToggleMute}
        audioMode={audioMode}
        onAudioModeChange={onAudioModeChange}
        hasBackingTrack={hasBackingTrack}
        backingTrackControls={backingTrackControls}
        countInBars={countInBars}
        onCountInBarsChange={onCountInBarsChange}
      />
    </div>
  );
}
