'use client';

import { useState, useRef } from 'react';
import SongLibrary from './SongLibrary';
import SetlistLibrary from './SetlistLibrary';
import FilesLibrary from './FilesLibrary';
import { Song, Setlist, SongInput, Asset } from '../types';

export type LibrarySubTab = 'songs' | 'setlists' | 'files';

interface LibraryTabProps {
  songs: Song[];
  songsLoading: boolean;
  songsError: string | null;
  deleteSong: (id: string) => boolean;
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
  onRenameAsset: (id: string, name: string) => void;
  onDeleteAsset: (id: string) => void;
  initialSubTab?: LibrarySubTab;
  onSubTabChange?: (subTab: LibrarySubTab) => void;
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
  onRenameAsset,
  onDeleteAsset,
  initialSubTab,
  onSubTabChange,
}: LibraryTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<LibrarySubTab>(
    initialSubTab || (initialViewSetlistId ? 'setlists' : 'songs')
  );

  // Swipe detection
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleSubTabChange = (tab: LibrarySubTab) => {
    setActiveSubTab(tab);
    onSubTabChange?.(tab);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    // Only trigger if horizontal swipe > 50px and vertical < 30px
    if (Math.abs(deltaX) < 50 || Math.abs(deltaY) > 30) return;

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
      onTouchEnd={handleTouchEnd}
    >
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
            onRename={onRenameAsset}
            onDelete={onDeleteAsset}
          />
        )}
      </div>
    </div>
  );
}
