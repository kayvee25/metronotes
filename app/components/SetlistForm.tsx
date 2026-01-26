'use client';

import { useState, useEffect } from 'react';
import { Setlist, SetlistInput } from '../types';

interface SetlistFormProps {
  setlist?: Setlist | null;
  onSubmit: (data: SetlistInput) => void;
  onCancel: () => void;
}

export default function SetlistForm({ setlist, onSubmit, onCancel }: SetlistFormProps) {
  const [name, setName] = useState(setlist?.name || '');

  const isEditing = !!setlist;

  useEffect(() => {
    if (setlist) {
      setName(setlist.name);
    }
  }, [setlist]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSubmit({
      name: name.trim(),
      songIds: setlist?.songIds || []
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className="bg-[var(--background)] rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-[var(--border)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-[var(--foreground)] text-center mb-6">
          {isEditing ? 'Edit Setlist' : 'New Setlist'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[var(--muted)]">
              Setlist Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Friday Night Gig"
              className="w-full px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-xl text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent-blue)]"
              autoFocus
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 h-12 rounded-xl bg-[var(--card)] hover:bg-[var(--border)] text-[var(--foreground)] font-semibold transition-all active:scale-95"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex-1 h-12 rounded-xl bg-[var(--accent-blue)] hover:brightness-110 text-white font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isEditing ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
