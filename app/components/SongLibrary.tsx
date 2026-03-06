'use client';

import { useState, useEffect, useRef } from 'react';
import { Song, SongInput } from '../types';
import { useSongs } from '../hooks/useSongs';
import { BPM, TIME_SIGNATURE, TIME_SIGNATURES } from '../lib/constants';
import Modal from './ui/Modal';

type SongSortOption = 'name-az' | 'name-za' | 'bpm-low' | 'bpm-high' | 'recent-added' | 'recent-updated';

const SORT_OPTIONS: { value: SongSortOption; label: string }[] = [
  { value: 'name-az', label: 'Name A-Z' },
  { value: 'name-za', label: 'Name Z-A' },
  { value: 'bpm-low', label: 'BPM (Low to High)' },
  { value: 'bpm-high', label: 'BPM (High to Low)' },
  { value: 'recent-added', label: 'Recently Added' },
  { value: 'recent-updated', label: 'Recently Updated' },
];

function sortSongs(songs: Song[], sort: SongSortOption): Song[] {
  const sorted = [...songs];
  switch (sort) {
    case 'name-az':
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case 'name-za':
      return sorted.sort((a, b) => b.name.localeCompare(a.name));
    case 'bpm-low':
      return sorted.sort((a, b) => a.bpm - b.bpm);
    case 'bpm-high':
      return sorted.sort((a, b) => b.bpm - a.bpm);
    case 'recent-added':
      return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    case 'recent-updated':
      return sorted.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    default:
      return sorted;
  }
}

interface SongLibraryProps {
  onSelectSong?: (song: Song) => void;
  onCreateSong?: (input: SongInput) => Song;
  onQuickAddSong?: (song: Song) => void;
}

export default function SongLibrary({ onSelectSong, onCreateSong, onQuickAddSong }: SongLibraryProps) {
  const { songs, isLoading, error, deleteSong, refresh } = useSongs();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SongSortOption>(() => {
    if (typeof window === 'undefined') return 'name-az';
    try {
      const saved = localStorage.getItem('metronotes_songs_sort');
      if (saved && SORT_OPTIONS.some(o => o.value === saved)) {
        return saved as SongSortOption;
      }
    } catch {}
    return 'name-az';
  });
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  // Quick-add form state
  const [qaName, setQaName] = useState('');
  const [qaBpm, setQaBpm] = useState(String(BPM.DEFAULT));
  const [qaTimeSig, setQaTimeSig] = useState<string>(TIME_SIGNATURE.DEFAULT);

  // Close sort menu on outside click
  useEffect(() => {
    if (!showSortMenu) return;
    const handler = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setShowSortMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSortMenu]);

  const handleSortChange = (option: SongSortOption) => {
    setSortOption(option);
    setShowSortMenu(false);
    try {
      localStorage.setItem('metronotes_songs_sort', option);
    } catch {}
  };

  const filteredSongs = songs.filter(
    (song) =>
      song.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      song.artist?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedSongs = sortSongs(filteredSongs, sortOption);

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

  const handleQuickAdd = () => {
    const trimmedName = qaName.trim();
    if (!trimmedName || !onCreateSong) return;
    const bpmVal = parseInt(qaBpm) || BPM.DEFAULT;
    const clampedBpm = Math.max(BPM.MIN, Math.min(BPM.MAX, bpmVal));
    const newSong = onCreateSong({
      name: trimmedName,
      bpm: clampedBpm,
      timeSignature: qaTimeSig,
    });
    setShowQuickAdd(false);
    setQaName('');
    setQaBpm(String(BPM.DEFAULT));
    setQaTimeSig(TIME_SIGNATURE.DEFAULT);
    onQuickAddSong?.(newSong);
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
      <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] min-h-[64px]">
        <h1 className="text-xl font-bold text-[var(--foreground)]">Songs</h1>
        <div className="flex items-center gap-1">
        <button
          onClick={refresh}
          className="w-10 h-10 rounded-xl hover:bg-[var(--card)] active:scale-95 transition-all flex items-center justify-center"
          aria-label="Refresh songs"
        >
          <svg className="w-5 h-5 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M20.49 9A9 9 0 005.64 5.64L4 4m16 16l-1.64-1.64A9 9 0 014.51 15" />
          </svg>
        </button>
        <div className="relative" ref={sortMenuRef}>
          <button
            onClick={() => setShowSortMenu(!showSortMenu)}
            className="w-10 h-10 rounded-xl hover:bg-[var(--card)] active:scale-95 transition-all flex items-center justify-center"
            aria-label="Sort songs"
          >
            <svg className="w-5 h-5 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
            </svg>
          </button>
          {showSortMenu && (
            <div className="absolute right-0 top-12 w-52 bg-[var(--background)] border border-[var(--border)] rounded-xl shadow-lg z-50 py-1 overflow-hidden">
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleSortChange(option.value)}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                    sortOption === option.value
                      ? 'text-[var(--accent-blue)] bg-[var(--accent-blue)]/10 font-medium'
                      : 'text-[var(--foreground)] hover:bg-[var(--card)]'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="mx-4 mt-3 px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-between">
          <p className="text-sm text-red-500">{error}</p>
          <button onClick={refresh} className="text-sm font-medium text-red-500 hover:underline ml-3 flex-shrink-0">Retry</button>
        </div>
      )}

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
        {sortedSongs.length === 0 ? (
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
                <p className="text-sm text-[var(--muted)]">Tap the + button to add a song</p>
              </>
            ) : (
              <p className="text-[var(--muted)]">No songs match your search</p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {sortedSongs.map((song) => (
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

      {/* FAB */}
      <button
        onClick={() => setShowQuickAdd(true)}
        className="fixed bottom-[80px] right-4 w-14 h-14 rounded-full bg-[var(--accent-blue)] text-white shadow-lg hover:brightness-110 active:scale-95 transition-all flex items-center justify-center z-40"
        aria-label="Add song"
      >
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Quick-Add Modal */}
      <Modal isOpen={showQuickAdd} onClose={() => setShowQuickAdd(false)} title="New Song">
        <div className="space-y-4 mb-6">
          <div>
            <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider block mb-2">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={qaName}
              onChange={(e) => setQaName(e.target.value)}
              placeholder="Song name"
              className="w-full px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-xl text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent-blue)]"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider block mb-2">
              BPM
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={qaBpm}
              onChange={(e) => setQaBpm(e.target.value.replace(/\D/g, ''))}
              className="w-full px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-xl text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent-blue)]"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider block mb-2">
              Time Signature
            </label>
            <select
              value={qaTimeSig}
              onChange={(e) => setQaTimeSig(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-xl text-[var(--foreground)] focus:outline-none focus:border-[var(--accent-blue)] cursor-pointer"
            >
              {TIME_SIGNATURES.map((ts) => (
                <option key={ts} value={ts}>{ts}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setShowQuickAdd(false)}
            className="flex-1 h-12 rounded-xl bg-[var(--card)] hover:bg-[var(--border)] text-[var(--foreground)] font-semibold transition-all active:scale-95"
          >
            Cancel
          </button>
          <button
            onClick={handleQuickAdd}
            disabled={!qaName.trim()}
            className="flex-1 h-12 rounded-xl bg-[var(--accent-blue)] hover:brightness-110 text-white font-semibold transition-all active:scale-95 disabled:opacity-50"
          >
            Create
          </button>
        </div>
      </Modal>
    </div>
  );
}
