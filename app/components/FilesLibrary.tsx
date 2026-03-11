'use client';

import { useState, useRef, useEffect } from 'react';
import { useConfirm } from './ui/ConfirmModal';
import { Asset } from '../types';
import LongPressMenu from './ui/LongPressMenu';

interface LinkedSong {
  songId: string;
  songName: string;
}

interface FilesLibraryProps {
  assets: Asset[];
  linkedSongs: Record<string, LinkedSong[]>; // assetId → songs that reference it
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

type TypeFilter = 'all' | 'audio' | 'image' | 'pdf' | 'richtext' | 'drawing';

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'audio', label: 'Audio' },
  { value: 'image', label: 'Image' },
  { value: 'pdf', label: 'PDF' },
  { value: 'richtext', label: 'Text' },
  { value: 'drawing', label: 'Drawing' },
];

function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getTypeLabel(type: string): string {
  switch (type) {
    case 'richtext': return 'Text';
    case 'pdf': return 'PDF';
    default: return type.charAt(0).toUpperCase() + type.slice(1);
  }
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'audio':
      return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
      );
    case 'image':
      return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    case 'pdf':
      return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      );
    case 'richtext':
      return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    case 'drawing':
      return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      );
    default:
      return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      );
  }
}

function getTypeBadge(type: string) {
  const colors: Record<string, string> = {
    audio: 'bg-purple-500/10 text-purple-500',
    image: 'bg-blue-500/10 text-blue-500',
    pdf: 'bg-red-500/10 text-red-500',
    richtext: 'bg-green-500/10 text-green-500',
    drawing: 'bg-orange-500/10 text-orange-500',
  };
  return colors[type] || 'bg-[var(--muted)]/10 text-[var(--muted)]';
}

function RenameModal({ name, onSave, onClose }: { name: string; onSave: (name: string) => void; onClose: () => void }) {
  const [value, setValue] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 50);
  }, []);

  const handleSave = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== name) {
      onSave(trimmed);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="fixed inset-0 bg-black/50" />
      <div className="relative bg-[var(--background)] border border-[var(--border)] rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">Rename File</h3>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') onClose();
          }}
          className="w-full px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-xl text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)] mb-4"
        />
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-11 rounded-xl bg-[var(--card)] hover:bg-[var(--border)] text-[var(--foreground)] font-semibold transition-all active:scale-95"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!value.trim() || value.trim() === name}
            className="flex-1 h-11 rounded-xl bg-[var(--accent)] hover:brightness-110 text-white font-semibold transition-all active:scale-95 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FilesLibrary({ assets, linkedSongs, onRename, onDelete }: FilesLibraryProps) {
  const confirm = useConfirm();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [renameTarget, setRenameTarget] = useState<Asset | null>(null);

  const sortedAssets = [...assets].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const filteredAssets = typeFilter === 'all'
    ? sortedAssets
    : sortedAssets.filter(a => a.type === typeFilter);

  // Only show filter options that have assets
  const availableTypes = new Set(assets.map(a => a.type));
  const activeFilters = TYPE_FILTERS.filter(f => f.value === 'all' || availableTypes.has(f.value));

  const handleDelete = async (asset: Asset) => {
    const links = linkedSongs[asset.id] || [];
    const message = links.length > 0
      ? `Delete "${asset.name}"? It will be removed from ${links.length} song${links.length > 1 ? 's' : ''} (${links.map(l => l.songName).join(', ')}). This cannot be undone.`
      : `Delete "${asset.name}"? This cannot be undone.`;

    const ok = await confirm({
      title: 'Delete File',
      message,
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (ok) onDelete(asset.id);
  };

  if (assets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center px-8">
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
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
        <p className="text-[var(--muted)] mb-2">No files yet</p>
        <p className="text-sm text-[var(--muted)]">
          Files are created when you add attachments to songs.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Type filter pills */}
      {activeFilters.length > 2 && (
        <div className="px-4 py-2 flex gap-1.5 overflow-x-auto no-scrollbar">
          {activeFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => setTypeFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                typeFilter === f.value
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--card)] text-[var(--muted)] hover:text-[var(--foreground)]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* File list */}
      <div className="flex-1 overflow-y-auto px-4 py-2 pb-20">
        {filteredAssets.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-[var(--muted)] text-sm">
            No {TYPE_FILTERS.find(f => f.value === typeFilter)?.label.toLowerCase()} files
          </div>
        ) : (
          filteredAssets.map((asset) => {
            const links = linkedSongs[asset.id] || [];
            const isOrphaned = links.length === 0;

            return (
              <LongPressMenu
                key={asset.id}
                items={[
                  {
                    label: 'Rename',
                    icon: (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    ),
                    onClick: () => setRenameTarget(asset),
                  },
                  {
                    label: 'Delete',
                    variant: 'danger' as const,
                    icon: (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    ),
                    onClick: () => handleDelete(asset),
                  },
                ]}
              >
                <div className="flex items-center gap-3 py-3 border-b border-[var(--border)]">
                  <div className="text-[var(--muted)] flex-shrink-0">
                    {getTypeIcon(asset.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[var(--foreground)] truncate">{asset.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${getTypeBadge(asset.type)}`}>
                        {getTypeLabel(asset.type)}
                      </span>
                      {asset.size !== null && asset.size > 0 && (
                        <span className="text-xs text-[var(--muted)]">{formatFileSize(asset.size)}</span>
                      )}
                      {isOrphaned ? (
                        <span className="text-xs text-[var(--muted)] italic">Unlinked</span>
                      ) : (
                        <span className="text-xs text-[var(--muted)] truncate max-w-[150px]">
                          {links.map(l => l.songName).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </LongPressMenu>
            );
          })
        )}
      </div>

      {/* Rename modal */}
      {renameTarget && (
        <RenameModal
          key={renameTarget.id}
          name={renameTarget.name}
          onSave={(name) => onRename(renameTarget.id, name)}
          onClose={() => setRenameTarget(null)}
        />
      )}
    </div>
  );
}
