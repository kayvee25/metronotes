'use client';

import { useState, useRef, useEffect } from 'react';
import { useConfirm } from './ui/ConfirmModal';
import { Asset } from '../types';

interface FilesLibraryProps {
  assets: Asset[];
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

function InlineEditName({ name, onSave }: { name: string; onSave: (name: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const handleSave = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== name) {
      onSave(trimmed);
    } else {
      setValue(name);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSave();
          if (e.key === 'Escape') {
            setValue(name);
            setEditing(false);
          }
        }}
        className="font-medium text-[var(--foreground)] bg-transparent border-b border-[var(--accent)] outline-none py-0 px-0 w-full"
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="font-medium text-[var(--foreground)] text-left truncate hover:text-[var(--accent)] transition-colors"
    >
      {name}
    </button>
  );
}

export default function FilesLibrary({ assets, onRename, onDelete }: FilesLibraryProps) {
  const confirm = useConfirm();

  const sortedAssets = [...assets].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const handleDelete = async (asset: Asset) => {
    const ok = await confirm({
      title: 'Delete File',
      message: `Delete "${asset.name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (ok) onDelete(asset.id);
  };

  if (sortedAssets.length === 0) {
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
    <div className="flex-1 overflow-y-auto px-4 py-2 pb-20">
      {sortedAssets.map((asset) => (
        <div
          key={asset.id}
          className="flex items-center gap-3 py-3 border-b border-[var(--border)]"
        >
          <div className="text-[var(--muted)] flex-shrink-0">
            {getTypeIcon(asset.type)}
          </div>
          <div className="flex-1 min-w-0">
            <InlineEditName name={asset.name} onSave={(name) => onRename(asset.id, name)} />
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${getTypeBadge(asset.type)}`}>
                {asset.type}
              </span>
              {asset.size !== null && asset.size > 0 && (
                <span className="text-xs text-[var(--muted)]">{formatFileSize(asset.size)}</span>
              )}
            </div>
          </div>
          <button
            onClick={() => handleDelete(asset)}
            className="w-8 h-8 rounded-lg hover:bg-[var(--card)] active:scale-95 transition-all flex items-center justify-center flex-shrink-0"
            aria-label={`Delete ${asset.name}`}
          >
            <svg className="w-4 h-4 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
