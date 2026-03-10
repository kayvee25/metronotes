'use client';

import { useState } from 'react';

export interface QueueSong {
  id: string;
  name: string;
  artist?: string;
}

interface LiveHeaderProps {
  songName: string;
  artist?: string;
  musicalKey?: string;
  bpm: number;
  timeSignature: string;
  queue: QueueSong[];
  currentIndex: number;
  onSelectFromQueue: (index: number) => void;
  onBack: () => void;
}

export default function LiveHeader({
  songName,
  artist,
  musicalKey,
  bpm,
  timeSignature,
  queue,
  currentIndex,
  onSelectFromQueue,
  onBack,
}: LiveHeaderProps) {
  const [showQueue, setShowQueue] = useState(false);

  const metaParts = [timeSignature, `${bpm} BPM`, musicalKey].filter(Boolean);
  const metaLine = metaParts.join(' · ');

  return (
    <div className="border-b border-[var(--border)] bg-[var(--background)]">
      {/* Top bar */}
      <div className="flex items-center gap-1 px-3 py-2 max-w-3xl mx-auto w-full">
        <button
          onClick={onBack}
          className="w-11 h-11 rounded-xl hover:bg-[var(--card)] active:scale-95 transition-all flex items-center justify-center flex-shrink-0"
          aria-label="Back to Library"
        >
          <svg className="w-6 h-6 text-[var(--foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <button
          onClick={() => setShowQueue(!showQueue)}
          className="flex-1 min-w-0 flex flex-col items-center justify-center py-1 rounded-xl hover:bg-[var(--card)] transition-colors"
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

        {/* Spacer to balance back button */}
        <div className="w-11 h-11 flex-shrink-0" />
      </div>

      {/* Transport bar placeholder */}
      <div className="flex items-center justify-center px-4 pb-2 max-w-3xl mx-auto">
        <span className="text-sm text-[var(--muted)]">{metaLine}</span>
      </div>

      {/* Queue dropdown */}
      {showQueue && queue.length > 0 && (
        <div className="border-t border-[var(--border)] max-h-64 overflow-y-auto">
          {queue.map((song, index) => (
            <button
              key={`${song.id}-${index}`}
              onClick={() => {
                onSelectFromQueue(index);
                setShowQueue(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                index === currentIndex
                  ? 'bg-[var(--accent)]/10'
                  : 'hover:bg-[var(--card)]'
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
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
