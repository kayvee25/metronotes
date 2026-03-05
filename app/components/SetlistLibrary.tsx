'use client';

import { useState, useEffect, useRef } from 'react';
import { Setlist, SetlistInput } from '../types';
import { useSetlists } from '../hooks/useSetlists';
import { useSongs } from '../hooks/useSongs';
import SetlistForm from './SetlistForm';
import SetlistDetail from './SetlistDetail';

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
  onPlaySetlist?: (setlist: Setlist, startIndex?: number) => void;
}

export default function SetlistLibrary({ onPlaySetlist }: SetlistLibraryProps) {
  const { setlists, isLoading, createSetlist, updateSetlist, deleteSetlist } = useSetlists();
  const { songs } = useSongs();
  const [showForm, setShowForm] = useState(false);
  const [editingSetlist, setEditingSetlist] = useState<Setlist | null>(null);
  const [viewingSetlist, setViewingSetlist] = useState<Setlist | null>(null);
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

  const handleCreateSetlist = (data: SetlistInput) => {
    const newSetlist = createSetlist(data);
    setShowForm(false);
    setViewingSetlist(newSetlist);
  };

  const handleUpdateSetlist = (data: SetlistInput) => {
    if (editingSetlist) {
      updateSetlist(editingSetlist.id, data);
      setEditingSetlist(null);
    }
  };

  const handleDeleteSetlist = (setlist: Setlist) => {
    if (confirm(`Delete "${setlist.name}"?`)) {
      deleteSetlist(setlist.id);
    }
  };

  const getTotalDuration = (setlist: Setlist) => {
    return `${setlist.songIds.length} songs`;
  };

  const sortedSetlists = sortSetlists(setlists, sortOption);

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
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] min-h-[64px]">
        <h1 className="text-xl font-bold text-[var(--foreground)]">Setlists</h1>
        <div className="relative" ref={sortMenuRef}>
          <button
            onClick={() => setShowSortMenu(!showSortMenu)}
            className="w-10 h-10 rounded-xl hover:bg-[var(--card)] active:scale-95 transition-all flex items-center justify-center"
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
      </header>

      {/* Setlist List */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-20">
        {sortedSetlists.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
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
            <p className="text-[var(--muted)] mb-4">No setlists yet</p>
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-[var(--accent-blue)] text-white rounded-xl font-medium hover:brightness-110 active:scale-95 transition-all"
            >
              Create your first setlist
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedSetlists.map((setlist) => (
              <div
                key={setlist.id}
                className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 active:scale-[0.99] transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    onClick={() => setViewingSetlist(setlist)}
                    className="flex-1 text-left"
                  >
                    <h3 className="font-semibold text-[var(--foreground)]">{setlist.name}</h3>
                    <p className="text-sm text-[var(--muted)] mt-1">{getTotalDuration(setlist)}</p>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditingSetlist(setlist)}
                      className="w-9 h-9 rounded-lg hover:bg-[var(--border)] flex items-center justify-center transition-colors"
                      aria-label="Edit setlist"
                    >
                      <svg
                        className="w-5 h-5 text-[var(--muted)]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteSetlist(setlist)}
                      className="w-9 h-9 rounded-lg hover:bg-red-500/10 flex items-center justify-center transition-colors"
                      aria-label="Delete setlist"
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
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => setShowForm(true)}
        className="fixed bottom-[80px] right-4 w-14 h-14 rounded-full bg-[var(--accent-blue)] text-white shadow-lg hover:brightness-110 active:scale-95 transition-all flex items-center justify-center z-40"
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
