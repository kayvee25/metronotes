'use client';

import { useState } from 'react';
import { Song } from '../types';

interface SongPickerProps {
  songs: Song[];
  existingSongIds: string[];
  onSelect: (songIds: string[]) => void;
  onCancel: () => void;
}

export default function SongPicker({ songs, existingSongIds, onSelect, onCancel }: SongPickerProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter out songs already in setlist and apply search
  const availableSongs = songs.filter(
    (song) =>
      !existingSongIds.includes(song.id) &&
      (song.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        song.artist?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const toggleSong = (songId: string) => {
    setSelectedIds((prev) =>
      prev.includes(songId) ? prev.filter((id) => id !== songId) : [...prev, songId]
    );
  };

  const handleSubmit = () => {
    onSelect(selectedIds);
  };

  return (
    <div className="fixed inset-0 bg-[var(--background)] z-50 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <button
          onClick={onCancel}
          className="px-3 py-2 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
        >
          Cancel
        </button>
        <h1 className="text-lg font-semibold text-[var(--foreground)]">Add Songs</h1>
        <button
          onClick={handleSubmit}
          disabled={selectedIds.length === 0}
          className="px-3 py-2 text-[var(--accent)] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add ({selectedIds.length})
        </button>
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
            className="w-full pl-10 pr-4 py-2.5 bg-[var(--card)] border border-[var(--border)] rounded-xl text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
      </div>

      {/* Song List */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {availableSongs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            {songs.length === existingSongIds.length ? (
              <p className="text-[var(--muted)]">All songs are already in this setlist</p>
            ) : songs.length === 0 ? (
              <p className="text-[var(--muted)]">No songs in your library yet</p>
            ) : (
              <p className="text-[var(--muted)]">No songs match your search</p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {availableSongs.map((song) => {
              const isSelected = selectedIds.includes(song.id);
              return (
                <button
                  key={song.id}
                  onClick={() => toggleSong(song.id)}
                  className={`w-full text-left p-4 rounded-xl border transition-all active:scale-[0.99] ${
                    isSelected
                      ? 'bg-[var(--accent)]/10 border-[var(--accent)]'
                      : 'bg-[var(--card)] border-[var(--border)]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Checkbox */}
                    <div
                      className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'bg-[var(--accent)] border-[var(--accent)]'
                          : 'border-[var(--border)]'
                      }`}
                    >
                      {isSelected && (
                        <svg
                          className="w-4 h-4 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>

                    {/* Song info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-[var(--foreground)] truncate">{song.name}</h3>
                      {song.artist && (
                        <p className="text-sm text-[var(--muted)] truncate">{song.artist}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1 text-xs text-[var(--muted)]">
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
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
