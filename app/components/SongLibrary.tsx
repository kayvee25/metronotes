'use client';

import { useState, useEffect, useRef } from 'react';
import { Song, SongInput } from '../types';
import { BPM, TIME_SIGNATURE, TIME_SIGNATURES } from '../lib/constants';
import Modal from './ui/Modal';
import SongDownloadIcon from './ui/SongDownloadIcon';
import LongPressMenu from './ui/LongPressMenu';
import { GUEST } from '../lib/constants';
import { type SongSortOption, sortSongs, getSavedSortOption } from '../lib/song-sort';

const SORT_OPTIONS: { value: SongSortOption; label: string }[] = [
  { value: 'name-az', label: 'Name A-Z' },
  { value: 'name-za', label: 'Name Z-A' },
  { value: 'recent-added', label: 'Recently Added' },
  { value: 'recent-updated', label: 'Recently Updated' },
];

interface SongLibraryProps {
  songs: Song[];
  isLoading: boolean;
  error: string | null;
  deleteSong: (id: string, keepFiles?: boolean) => Promise<boolean>;
  refresh: () => Promise<void>;
  onSelectSong?: (song: Song) => void;
  onEditSong?: (song: Song) => void;
  onCreateSong?: (input: SongInput) => Promise<Song | null>;
  onQuickAddSong?: (song: Song) => void;
  isGuest?: boolean;
  onAddToSession?: (songs: Song[]) => void;
}

export default function SongLibrary({ songs, isLoading, error, deleteSong, refresh, onSelectSong, onEditSong, onCreateSong, onQuickAddSong, isGuest = false, onAddToSession }: SongLibraryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SongSortOption>(getSavedSortOption);
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

  const [deleteTarget, setDeleteTarget] = useState<Song | null>(null);

  const handleDeleteConfirm = async (keepFiles: boolean) => {
    if (deleteTarget) {
      await deleteSong(deleteTarget.id, keepFiles);
      setDeleteTarget(null);
    }
  };

  const handleSongClick = (song: Song) => {
    // During active session, tap adds to queue instead of opening
    if (onAddToSession) {
      onAddToSession([song]);
      return;
    }
    if (onSelectSong) {
      onSelectSong(song);
    }
  };

  const handleQuickAdd = async () => {
    const trimmedName = qaName.trim();
    if (!trimmedName || !onCreateSong) return;
    const bpmVal = parseInt(qaBpm) || BPM.DEFAULT;
    const clampedBpm = Math.max(BPM.MIN, Math.min(BPM.MAX, bpmVal));
    const newSong = await onCreateSong({
      name: trimmedName,
      bpm: clampedBpm,
      timeSignature: qaTimeSig,
    });
    if (!newSong) return; // Guest limit reached
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
    <div className="flex flex-col h-full max-w-2xl mx-auto w-full">
      {/* Error banner */}
      {error && (
        <div className="mx-4 mt-3 px-4 py-2.5 bg-[var(--accent-danger)]/10 border border-[var(--accent-danger)]/20 rounded-xl flex items-center justify-between">
          <p className="text-sm text-[var(--accent-danger)]">{error}</p>
          <button onClick={refresh} className="text-sm font-medium text-[var(--accent-danger)] hover:underline ml-3 flex-shrink-0">Retry</button>
        </div>
      )}

      {/* Search + Sort */}
      <div className="px-4 py-3 flex items-center gap-2">
        <div className="relative flex-1">
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
            data-testid="input-search-songs"
            className="w-full pl-10 pr-4 py-2.5 bg-[var(--card)] border border-[var(--border)] rounded-xl text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
        <div className="relative" ref={sortMenuRef}>
          <button
            onClick={() => setShowSortMenu(!showSortMenu)}
            className="w-10 h-10 rounded-xl hover:bg-[var(--card)] active:scale-95 transition-all flex items-center justify-center flex-shrink-0"
            aria-label="Sort songs"
            data-testid="btn-sort-songs"
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
                  data-testid={`sort-${option.value}`}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                    sortOption === option.value
                      ? 'text-[var(--accent)] bg-[var(--accent)]/10 font-medium'
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
          <div>
            {sortedSongs.map((song) => (
              <LongPressMenu
                key={song.id}
                onTap={() => handleSongClick(song)}
                items={[
                  ...(onAddToSession ? [{
                    label: 'Add to Session',
                    icon: (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                    ),
                    onClick: () => onAddToSession([song]),
                  }] : []),
                  ...(onEditSong ? [{
                    label: 'Edit',
                    icon: (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    ),
                    onClick: () => onEditSong(song),
                  }] : []),
                  {
                    label: 'Delete',
                    variant: 'danger' as const,
                    icon: (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    ),
                    onClick: () => setDeleteTarget(song),
                  },
                ]}
              >
                <div className="w-full flex items-center gap-3 px-3 py-3 bg-[var(--background)] active:bg-[var(--card)] transition-colors text-left border-b border-[var(--border)] cursor-pointer" data-testid="song-item">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-[var(--foreground)] truncate">{song.name}</h3>
                    {song.artist && (
                      <p className="text-xs text-[var(--muted)] truncate mt-0.5">{song.artist}</p>
                    )}
                  </div>
                  <SongDownloadIcon songId={song.id} />
                </div>
              </LongPressMenu>
            ))}
          </div>
        )}
      </div>

      {/* Guest mode footer */}
      {isGuest && (
        <div className="px-4 py-3 text-center text-xs text-[var(--muted)]">
          {songs.length}/{GUEST.MAX_SONGS} songs · <span className="text-[var(--accent)] font-medium">Sign in for unlimited</span>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setShowQuickAdd(true)}
        className="fixed bottom-[80px] right-4 w-14 h-14 rounded-2xl bg-[var(--accent)] text-white shadow-lg hover:brightness-110 active:scale-95 transition-all flex items-center justify-center z-40"
        aria-label="Add song"
        data-testid="btn-add-song"
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
              Name <span className="text-[var(--accent-danger)]">*</span>
            </label>
            <input
              type="text"
              value={qaName}
              onChange={(e) => setQaName(e.target.value)}
              placeholder="Song name"
              data-testid="input-song-name"
              className="w-full px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-xl text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)]"
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
              data-testid="input-bpm-modal"
              className="w-full px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-xl text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider block mb-2">
              Time Signature
            </label>
            <select
              value={qaTimeSig}
              onChange={(e) => setQaTimeSig(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-xl text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)] cursor-pointer"
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
            data-testid="btn-create-song"
            className="flex-1 h-12 rounded-xl bg-[var(--accent)] hover:brightness-110 text-white font-semibold transition-all active:scale-95 disabled:opacity-50"
          >
            Create
          </button>
        </div>
      </Modal>

      {/* Delete Song Dialog */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Song">
        <p className="text-sm text-[var(--muted)] text-center mb-6 -mt-2">
          Delete &ldquo;{deleteTarget?.name}&rdquo;? This cannot be undone.
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => handleDeleteConfirm(false)}
            data-testid="btn-confirm-delete"
            className="w-full h-12 rounded-xl bg-[var(--accent-danger)] hover:brightness-110 text-white font-semibold transition-all active:scale-95"
          >
            Delete song and files
          </button>
          <button
            onClick={() => handleDeleteConfirm(true)}
            data-testid="btn-confirm-delete-keep-files"
            className="w-full h-12 rounded-xl bg-[var(--card)] hover:bg-[var(--border)] text-[var(--foreground)] font-semibold transition-all active:scale-95"
          >
            Delete song, keep files
          </button>
          <button
            onClick={() => setDeleteTarget(null)}
            className="w-full h-12 rounded-xl text-[var(--muted)] font-medium transition-all active:scale-95"
          >
            Cancel
          </button>
        </div>
      </Modal>
    </div>
  );
}
