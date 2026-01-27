'use client';

import Modal from '../ui/Modal';

interface SaveSongModalProps {
  isOpen: boolean;
  onClose: () => void;
  name: string;
  artist: string;
  onNameChange: (name: string) => void;
  onArtistChange: (artist: string) => void;
  onSave: () => void;
}

export default function SaveSongModal({
  isOpen,
  onClose,
  name,
  artist,
  onNameChange,
  onArtistChange,
  onSave,
}: SaveSongModalProps) {
  const handleSave = () => {
    if (!name.trim()) return;
    onSave();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Save Song">
      <div className="space-y-4 mb-6">
        <div>
          <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider block mb-2">
            Song Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Enter song name"
            className="w-full px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-xl text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent-blue)]"
            autoFocus
          />
        </div>

        <div>
          <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider block mb-2">
            Artist
          </label>
          <input
            type="text"
            value={artist}
            onChange={(e) => onArtistChange(e.target.value)}
            placeholder="Enter artist name"
            className="w-full px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-xl text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent-blue)]"
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onClose}
          className="flex-1 h-12 rounded-xl bg-[var(--card)] hover:bg-[var(--border)] text-[var(--foreground)] font-semibold transition-all active:scale-95"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!name.trim()}
          className="flex-1 h-12 rounded-xl bg-[var(--accent-blue)] hover:brightness-110 text-white font-semibold transition-all active:scale-95 disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </Modal>
  );
}
