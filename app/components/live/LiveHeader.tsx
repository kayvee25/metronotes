'use client';

import { useState, useRef, useEffect, ReactNode } from 'react';

export interface QueueSong {
  id: string;
  name: string;
  artist?: string;
}

interface LiveHeaderProps {
  songName: string;
  artist?: string;
  queue: QueueSong[];
  currentIndex: number;
  onSelectFromQueue?: (index: number) => void;
  onBack?: () => void;
  transportSlot?: ReactNode;
  isEditMode?: boolean;
  onToggleEditMode?: () => void;
  onNameChange?: (name: string) => void;
  onArtistChange?: (artist: string) => void;
}

export default function LiveHeader({
  songName,
  artist,
  queue,
  currentIndex,
  onSelectFromQueue,
  onBack,
  transportSlot,
  isEditMode = false,
  onToggleEditMode,
  onNameChange,
  onArtistChange,
}: LiveHeaderProps) {
  const [showQueue, setShowQueue] = useState(false);
  const queueRef = useRef<HTMLDivElement>(null);

  // Close queue on outside click
  useEffect(() => {
    if (!showQueue) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      const target = typeof TouchEvent !== 'undefined' && e instanceof TouchEvent
        ? e.touches[0]?.target || e.target
        : e.target;
      if (queueRef.current && !queueRef.current.contains(target as Node)) {
        setShowQueue(false);
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowQueue(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler, { passive: true });
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [showQueue]);

  return (
    <div className="border-b border-[var(--border)] bg-[var(--background)]">
      {/* Top bar */}
      <div className="flex items-center gap-1 px-3 py-2">
        {onBack ? (
          <button
            onClick={onBack}
            className="w-11 h-11 rounded-xl hover:bg-[var(--card)] active:scale-95 transition-all flex items-center justify-center flex-shrink-0"
            aria-label="Back"
            data-testid="btn-back"
          >
            <svg className="w-6 h-6 text-[var(--foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        ) : (
          <span className="w-11 flex-shrink-0" />
        )}

        {/* Song name — editable in edit mode, queue dropdown in performance mode */}
        <div ref={queueRef} className="flex-1 min-w-0 relative">
          {isEditMode && onNameChange ? (
            <div className="flex flex-col items-center py-1">
              <input
                type="text"
                value={songName}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="Song name"
                className="text-lg font-bold text-[var(--foreground)] bg-transparent text-center w-full placeholder:text-[var(--muted)] focus:outline-none"
              />
              <input
                type="text"
                value={artist || ''}
                onChange={(e) => onArtistChange?.(e.target.value)}
                placeholder="Artist"
                className="text-xs text-[var(--muted)] bg-transparent text-center w-full placeholder:text-[var(--muted)] focus:outline-none"
              />
            </div>
          ) : (
          <button
            onClick={() => setShowQueue(!showQueue)}
            className="w-full flex flex-col items-center justify-center py-1 rounded-xl hover:bg-[var(--card)] transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-bold text-[var(--foreground)] truncate max-w-[200px]">
                {songName}
              </span>
              <svg
                className={`w-4 h-4 text-[var(--muted)] transition-transform ${showQueue ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            {artist && (
              <span className="text-xs text-[var(--muted)] truncate max-w-[200px]">{artist}</span>
            )}
          </button>
          )}

          {/* Queue popover — floating, overlays content */}
          {showQueue && queue.length > 0 && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 w-full max-w-[400px]" role="dialog" aria-label="Song queue">
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xl overflow-hidden">
                {/* Queue header */}
                <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)]">
                  <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Queue</span>
                  <button
                    onClick={() => setShowQueue(false)}
                    className="w-6 h-6 rounded-lg hover:bg-[var(--border)] flex items-center justify-center text-[var(--muted)] transition-colors"
                    aria-label="Close queue"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Queue items */}
                <div className="max-h-64 overflow-y-auto">
                  {queue.map((song, index) => {
                    const El = onSelectFromQueue ? 'button' : 'div';
                    return (
                    <El
                      key={`${song.id}-${index}`}
                      onClick={onSelectFromQueue ? () => {
                        onSelectFromQueue(index);
                        setShowQueue(false);
                      } : undefined}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        index === currentIndex
                          ? 'bg-[var(--accent)]/10'
                          : onSelectFromQueue ? 'hover:bg-[var(--border)]/50' : ''
                      }`}
                    >
                      <span className={`text-sm font-mono w-6 text-right flex-shrink-0 ${
                        index === currentIndex ? 'text-[var(--accent)] font-bold' : 'text-[var(--muted)]'
                      }`}>
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm truncate ${
                          index === currentIndex ? 'text-[var(--accent)] font-semibold' : 'text-[var(--foreground)]'
                        }`}>
                          {song.name}
                        </div>
                        {song.artist && (
                          <div className="text-xs text-[var(--muted)] truncate">{song.artist}</div>
                        )}
                      </div>
                      {index === currentIndex && (
                        <svg className="w-4 h-4 text-[var(--accent)] flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      )}
                    </El>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Edit/Performance toggle */}
        {onToggleEditMode && (
          <button
            onClick={onToggleEditMode}
            className="w-11 h-11 rounded-xl hover:bg-[var(--card)] active:scale-95 transition-all flex items-center justify-center flex-shrink-0"
            aria-label={isEditMode ? 'Performance mode' : 'Edit mode'}
          >
            {isEditMode ? (
              <svg className="w-5 h-5 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            )}
          </button>
        )}
      </div>

      {/* Transport controls slot */}
      {transportSlot}
    </div>
  );
}
