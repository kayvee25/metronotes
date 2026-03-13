'use client';

import { useState, useEffect, useRef } from 'react';
import { useConfirm } from './ui/ConfirmModal';
import { Song, Setlist, SetlistInput } from '../types';
import { useSetlists } from '../hooks/useSetlists';
import { useToast } from './ui/Toast';
import SetlistForm from './SetlistForm';
import SetlistDetail from './SetlistDetail';
import LongPressMenu from './ui/LongPressMenu';

type SetlistSortOption = 'name-az' | 'name-za' | 'recent-created' | 'recent-updated';

const SORT_OPTIONS: { value: SetlistSortOption; label: string }[] = [
  { value: 'name-az', label: 'Name A-Z' },
  { value: 'name-za', label: 'Name Z-A' },
  { value: 'recent-created', label: 'Recently Created' },
  { value: 'recent-updated', label: 'Recently Updated' },
];

function sortSetlists(setlists: Setlist[], sort: SetlistSortOption): Setlist[] {
  const sorted = [...setlists];
  switch (sort) {
    case 'name-az':
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case 'name-za':
      return sorted.sort((a, b) => b.name.localeCompare(a.name));
    case 'recent-created':
      return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    case 'recent-updated':
      return sorted.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    default:
      return sorted;
  }
}

interface SetlistLibraryProps {
  songs: Song[];
  onPlaySetlist?: (setlist: Setlist, startIndex?: number) => void;
  initialViewSetlistId?: string | null;
  onInitialViewConsumed?: () => void;
}

export default function SetlistLibrary({ songs, onPlaySetlist, initialViewSetlistId, onInitialViewConsumed }: SetlistLibraryProps) {
  const { toast } = useToast();
  const { setlists, isLoading, error, createSetlist, updateSetlist, deleteSetlist, removeSongFromSetlist, reorderSongs, refresh } = useSetlists(toast);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingSetlist, setEditingSetlist] = useState<Setlist | null>(null);
  const [viewingSetlist, setViewingSetlist] = useState<Setlist | null>(() => {
    if (initialViewSetlistId) {
      const found = setlists.find(s => s.id === initialViewSetlistId);
      if (found) return found;
    }
    return null;
  });
  const [sortOption, setSortOption] = useState<SetlistSortOption>(() => {
    if (typeof window === 'undefined') return 'name-az';
    try {
      const saved = localStorage.getItem('metronotes_setlists_sort');
      if (saved && SORT_OPTIONS.some(o => o.value === saved)) {
        return saved as SetlistSortOption;
      }
    } catch {}
    return 'name-az';
  });
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  // Restore setlist detail view when returning from song view (if setlists weren't ready at init)
  useEffect(() => {
    if (initialViewSetlistId && !viewingSetlist && setlists.length > 0) {
      const setlist = setlists.find(s => s.id === initialViewSetlistId);
      if (setlist) {
        setViewingSetlist(setlist);
      }
      onInitialViewConsumed?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialViewSetlistId, setlists]);

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

  const handleSortChange = (option: SetlistSortOption) => {
    setSortOption(option);
    setShowSortMenu(false);
    try {
      localStorage.setItem('metronotes_setlists_sort', option);
    } catch {}
  };

  const handleCreateSetlist = async (data: SetlistInput) => {
    const newSetlist = await createSetlist(data);
    setShowForm(false);
    if (newSetlist) setViewingSetlist(newSetlist);
  };

  const handleUpdateSetlist = async (data: SetlistInput) => {
    if (editingSetlist) {
      await updateSetlist(editingSetlist.id, data);
      setEditingSetlist(null);
    }
  };

  const confirmAction = useConfirm();

  const handleDeleteSetlist = async (setlist: Setlist) => {
    const ok = await confirmAction({
      title: 'Delete Setlist',
      message: `Delete "${setlist.name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (ok) await deleteSetlist(setlist.id);
  };

  const getTotalDuration = (setlist: Setlist) => {
    return `${setlist.songIds.length} songs`;
  };

  const filteredSetlists = setlists.filter(
    (setlist) => setlist.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const sortedSetlists = sortSetlists(filteredSetlists, sortOption);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[var(--muted)]">Loading...</div>
      </div>
    );
  }

  // Show setlist detail view
  if (viewingSetlist) {
    const currentSetlist = setlists.find((s) => s.id === viewingSetlist.id) || viewingSetlist;
    return (
      <SetlistDetail
        setlist={currentSetlist}
        songs={songs}
        onBack={() => setViewingSetlist(null)}
        onPlay={onPlaySetlist}
        updateSetlist={updateSetlist}
        removeSongFromSetlist={removeSongFromSetlist}
        reorderSongs={reorderSongs}
      />
    );
  }

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto w-full">
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
            placeholder="Search setlists..."
            className="w-full pl-10 pr-4 py-2.5 bg-[var(--card)] border border-[var(--border)] rounded-xl text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
        <div className="relative" ref={sortMenuRef}>
          <button
            onClick={() => setShowSortMenu(!showSortMenu)}
            className="w-10 h-10 rounded-xl hover:bg-[var(--card)] active:scale-95 transition-all flex items-center justify-center flex-shrink-0"
            aria-label="Sort setlists"
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

      {/* Error banner */}
      {error && (
        <div className="mx-4 mt-3 px-4 py-2.5 bg-[var(--accent-danger)]/10 border border-[var(--accent-danger)]/20 rounded-xl flex items-center justify-between">
          <p className="text-sm text-[var(--accent-danger)]">{error}</p>
          <button onClick={refresh} className="text-sm font-medium text-[var(--accent-danger)] hover:underline ml-3 flex-shrink-0">Retry</button>
        </div>
      )}

      {/* Setlist List */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-20">
        {sortedSetlists.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            {setlists.length === 0 ? (
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
                    d="M4 6h16M4 10h16M4 14h16M4 18h16"
                  />
                </svg>
                <p className="text-[var(--muted)] mb-2">No setlists yet</p>
                <p className="text-sm text-[var(--muted)]">Tap the + button to add a setlist</p>
              </>
            ) : (
              <p className="text-[var(--muted)]">No setlists match your search</p>
            )}
          </div>
        ) : (
          <div>
            {sortedSetlists.map((setlist) => (
              <LongPressMenu
                key={setlist.id}
                onTap={() => setViewingSetlist(setlist)}
                items={[
                  {
                    label: 'Edit',
                    icon: (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    ),
                    onClick: () => setEditingSetlist(setlist),
                  },
                  {
                    label: 'Delete',
                    variant: 'danger' as const,
                    icon: (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    ),
                    onClick: () => handleDeleteSetlist(setlist),
                  },
                ]}
              >
                <div className="w-full flex items-center justify-between px-3 py-3 bg-[var(--background)] active:bg-[var(--card)] transition-colors text-left border-b border-[var(--border)] cursor-pointer">
                  <h3 className="font-semibold text-[var(--foreground)]">{setlist.name}</h3>
                  <span className="text-sm text-[var(--muted)] flex-shrink-0">{getTotalDuration(setlist)}</span>
                </div>
              </LongPressMenu>
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => setShowForm(true)}
        className="fixed bottom-[80px] right-4 w-14 h-14 rounded-2xl bg-[var(--accent)] text-white shadow-lg hover:brightness-110 active:scale-95 transition-all flex items-center justify-center z-40"
        aria-label="Add setlist"
      >
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Setlist Form Modal */}
      {(showForm || editingSetlist) && (
        <SetlistForm
          setlist={editingSetlist}
          onSubmit={editingSetlist ? handleUpdateSetlist : handleCreateSetlist}
          onCancel={() => {
            setShowForm(false);
            setEditingSetlist(null);
          }}
        />
      )}
    </div>
  );
}
