'use client';

import { useState } from 'react';
import { Song } from '../types';
import { useSongs } from '../hooks/useSongs';

interface SongLibraryProps {
  onSelectSong?: (song: Song) => void;
}

export default function SongLibrary({ onSelectSong }: SongLibraryProps) {
  const { songs, isLoading, deleteSong } = useSongs();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSongs = songs.filter(
    (song) =>
      song.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      song.artist?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDeleteSong = (e: React.MouseEvent, song: Song) => {
    e.stopPropagation();
    if (confirm(`Delete "${song.name}"?`)) {
      deleteSong(song.id);
    }
  };

  const handleSongClick = (song: Song) => {
    if (onSelectSong) {
      onSelectSong(song);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[var(--muted)]">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <h1 className="text-xl font-bold text-[var(--foreground)]">Songs</h1>
      </header>

      {/* Search */}
      <div className="px-4 py-3">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--muted)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search songs..."
            className="w-full pl-10 pr-4 py-2.5 bg-[var(--card)] border border-[var(--border)] rounded-xl text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent-blue)]"
          />
        </div>
      </div>

      {/* Song List */}
      <div className="flex-1 overflow-y-auto px-4 pb-20">
        {filteredSongs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            {songs.length === 0 ? (
              <>
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
                    d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                  />
                </svg>
                <p className="text-[var(--muted)] mb-2">No songs yet</p>
                <p className="text-sm text-[var(--muted)]">Tap the New tab to create one</p>
              </>
            ) : (
              <p className="text-[var(--muted)]">No songs match your search</p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredSongs.map((song) => (
              <div
                key={song.id}
                className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 active:scale-[0.99] transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    onClick={() => handleSongClick(song)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <h3 className="font-semibold text-[var(--foreground)] truncate">{song.name}</h3>
                    {song.artist && (
                      <p className="text-sm text-[var(--muted)] truncate">{song.artist}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-sm text-[var(--muted)]">
                      <span className="font-mono">{song.bpm} BPM</span>
                      <span>•</span>
                      <span>{song.timeSignature}</span>
                      {song.key && (
                        <>
                          <span>•</span>
                          <span>{song.key}</span>
                        </>
                      )}
                    </div>
                  </button>

                  <button
                    onClick={(e) => handleDeleteSong(e, song)}
                    className="w-9 h-9 rounded-lg hover:bg-red-500/10 flex items-center justify-center transition-colors flex-shrink-0"
                    aria-label="Delete song"
                  >
                    <svg
                      className="w-5 h-5 text-red-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
