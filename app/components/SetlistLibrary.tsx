'use client';

import { useState } from 'react';
import { Setlist, SetlistInput } from '../types';
import { useSetlists } from '../hooks/useSetlists';
import { useSongs } from '../hooks/useSongs';
import SetlistForm from './SetlistForm';
import SetlistDetail from './SetlistDetail';

interface SetlistLibraryProps {
  onPlaySetlist?: (setlist: Setlist, startIndex?: number) => void;
}

export default function SetlistLibrary({ onPlaySetlist }: SetlistLibraryProps) {
  const { setlists, isLoading, createSetlist, updateSetlist, deleteSetlist } = useSetlists();
  const { songs } = useSongs();
  const [showForm, setShowForm] = useState(false);
  const [editingSetlist, setEditingSetlist] = useState<Setlist | null>(null);
  const [viewingSetlist, setViewingSetlist] = useState<Setlist | null>(null);

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

  const getSongCount = (setlist: Setlist) => {
    return setlist.songIds.length;
  };

  const getTotalDuration = (setlist: Setlist) => {
    // Placeholder - could calculate based on song durations if we add that field
    return `${setlist.songIds.length} songs`;
  };

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
      <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <h1 className="text-xl font-bold text-[var(--foreground)]">Setlists</h1>
        <button
          onClick={() => setShowForm(true)}
          className="w-10 h-10 rounded-xl bg-[var(--accent-blue)] hover:brightness-110 active:scale-95 transition-all flex items-center justify-center"
        >
          <svg
            className="w-6 h-6 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </header>

      {/* Setlist List */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-20">
        {setlists.length === 0 ? (
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
            {setlists.map((setlist) => (
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
