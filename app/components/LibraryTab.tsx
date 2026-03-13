'use client';

import { useState, useRef, useCallback } from 'react';
import SongLibrary from './SongLibrary';
import SetlistLibrary from './SetlistLibrary';
import FilesLibrary from './FilesLibrary';
import { Song, Setlist, SongInput, Asset } from '../types';
import type { AssetLinkageMap } from '../hooks/useAssetLinkage';

export type LibrarySubTab = 'songs' | 'setlists' | 'files';

function formatSyncTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 60000) return 'Just now';
  if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`;
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

interface LibraryTabProps {
  songs: Song[];
  songsLoading: boolean;
  songsError: string | null;
  deleteSong: (id: string, keepFiles?: boolean) => boolean;
  refreshSongs: () => Promise<void>;
  onSelectSong: (song: Song) => void;
  onEditSong: (song: Song) => void;
  onCreateSong: (data: SongInput) => Song | null;
  onQuickAddSong: (song: Song) => void;
  isGuest: boolean;
  onPlaySetlist: (setlist: Setlist, startIndex?: number) => void;
  initialViewSetlistId: string | null;
  onInitialViewConsumed: () => void;
  assets: Asset[];
  assetLinkage: AssetLinkageMap;
  onRenameAsset: (id: string, name: string) => void;
  onDeleteAsset: (id: string) => void;
  initialSubTab?: LibrarySubTab;
  onSubTabChange?: (subTab: LibrarySubTab) => void;
  // Live session (Phase 3)
  isHostingSession?: boolean;
  connectedPeerCount?: number;
  onAddSongsToSession?: (songs: Song[]) => void;
}

const SUB_TABS: { id: LibrarySubTab; label: string }[] = [
  { id: 'songs', label: 'Songs' },
  { id: 'setlists', label: 'Setlists' },
  { id: 'files', label: 'Files' },
];

export default function LibraryTab({
  songs,
  songsLoading,
  songsError,
  deleteSong,
  refreshSongs,
  onSelectSong,
  onEditSong,
  onCreateSong,
  onQuickAddSong,
  isGuest,
  onPlaySetlist,
  initialViewSetlistId,
  onInitialViewConsumed,
  assets,
  assetLinkage,
  onRenameAsset,
  onDeleteAsset,
  initialSubTab,
  onSubTabChange,
  isHostingSession,
  connectedPeerCount = 0,
  onAddSongsToSession,
}: LibraryTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<LibrarySubTab>(
    initialSubTab || (initialViewSetlistId ? 'setlists' : 'songs')
  );
  const [lastSynced, setLastSynced] = useState<Date>(() => new Date());
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      await refreshSongs();
      setLastSynced(new Date());
    } finally {
      setIsSyncing(false);
    }
  }, [refreshSongs]);

  // Swipe detection — track gesture direction early to avoid conflicts with scrolling
  const touchRef = useRef<{ startX: number; startY: number; locked: 'h' | 'v' | null }>({ startX: 0, startY: 0, locked: null });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleSubTabChange = (tab: LibrarySubTab) => {
    setActiveSubTab(tab);
    onSubTabChange?.(tab);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchRef.current = { startX: touch.clientX, startY: touch.clientY, locked: null };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchRef.current.locked) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchRef.current.startX);
    const dy = Math.abs(touch.clientY - touchRef.current.startY);
    // Lock direction once we've moved enough
    if (dx > 10 || dy > 10) {
      touchRef.current.locked = dx > dy ? 'h' : 'v';
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchRef.current.locked !== 'h') return;
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchRef.current.startX;

    if (Math.abs(deltaX) < 50) return;

    const currentIndex = SUB_TABS.findIndex(t => t.id === activeSubTab);
    if (deltaX < 0 && currentIndex < SUB_TABS.length - 1) {
      handleSubTabChange(SUB_TABS[currentIndex + 1].id);
    } else if (deltaX > 0 && currentIndex > 0) {
      handleSubTabChange(SUB_TABS[currentIndex - 1].id);
    }
  };

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full max-w-2xl mx-auto w-full"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Live session banner */}
      {isHostingSession && (
        <div className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)]/10 border-b border-[var(--accent)]/20">
          <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
          <span className="text-xs font-medium text-[var(--accent)]">
            Live · {connectedPeerCount} connected
          </span>
          <span className="text-xs text-[var(--muted)] ml-auto">
            Tap song to add to session
          </span>
        </div>
      )}

      {/* Sync bar */}
      {!isGuest && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)]">
          <span className="text-xs text-[var(--muted)]">
            Synced {formatSyncTime(lastSynced)}
          </span>
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-1.5 text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors disabled:opacity-50"
            aria-label="Sync now"
          >
            <svg className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M20.49 9A9 9 0 005.64 5.64L4 4m16 16l-1.64-1.64A9 9 0 014.51 15" />
            </svg>
            Sync
          </button>
        </div>
      )}

      {/* Sub-tab switcher */}
      <div className="flex border-b border-[var(--border)] px-4">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleSubTabChange(tab.id)}
            className={`flex-1 py-3 text-sm font-medium text-center transition-colors relative ${
              activeSubTab === tab.id
                ? 'text-[var(--accent)]'
                : 'text-[var(--muted)] hover:text-[var(--foreground)]'
            }`}
          >
            {tab.label}
            {activeSubTab === tab.id && (
              <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-[var(--accent)] rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      <div className="flex-1 overflow-hidden">
        {activeSubTab === 'songs' && (
          <SongLibrary
            songs={songs}
            isLoading={songsLoading}
            error={songsError}
            deleteSong={deleteSong}
            refresh={refreshSongs}
            onSelectSong={onSelectSong}
            onEditSong={onEditSong}
            onCreateSong={onCreateSong}
            onQuickAddSong={onQuickAddSong}
            isGuest={isGuest}
            onAddToSession={isHostingSession ? onAddSongsToSession : undefined}
          />
        )}
        {activeSubTab === 'setlists' && (
          <SetlistLibrary
            songs={songs}
            onPlaySetlist={onPlaySetlist}
            initialViewSetlistId={initialViewSetlistId}
            onInitialViewConsumed={onInitialViewConsumed}
          />
        )}
        {activeSubTab === 'files' && (
          <FilesLibrary
            assets={assets}
            linkedSongs={assetLinkage}
            onRename={onRenameAsset}
            onDelete={onDeleteAsset}
          />
        )}
      </div>
    </div>
  );
}
