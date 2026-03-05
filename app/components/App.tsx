'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import SongView, { SongViewHandle } from './SongView';
import SongLibrary from './SongLibrary';
import SetlistLibrary from './SetlistLibrary';
import BottomNav from './BottomNav';
import { Song, Setlist, SongInput } from '../types';
import { useSongs } from '../hooks/useSongs';

type Tab = 'songs' | 'setlists';
type NavigationSource = 'none' | 'songs' | 'setlists';
type PendingNav = { type: 'tab'; tab: Tab } | { type: 'back' } | null;

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('songs');
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [showSongView, setShowSongView] = useState(false);
  const [activeSetlist, setActiveSetlist] = useState<Setlist | null>(null);
  const [setlistIndex, setSetlistIndex] = useState(0);
  const [navigationSource, setNavigationSource] = useState<NavigationSource>('none');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [editModeOnOpen, setEditModeOnOpen] = useState(false);
  const { songs, createSong, updateSong } = useSongs();

  // Dirty state tracking
  const [isDirty, setIsDirty] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<PendingNav>(null);
  const pendingNavRef = useRef<PendingNav>(null);
  const songViewRef = useRef<SongViewHandle>(null);

  // Initialize dark mode after mount
  useEffect(() => {
    setIsMounted(true);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDarkMode(prefersDark);
    if (prefersDark) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  // Dark mode toggle effect
  useEffect(() => {
    if (!isMounted) return;
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode, isMounted]);

  // Update selected song when setlist index changes
  useEffect(() => {
    if (activeSetlist && activeSetlist.songIds.length > 0) {
      const songId = activeSetlist.songIds[setlistIndex];
      const song = songs.find((s) => s.id === songId);
      if (song) {
        setSelectedSong(song);
      }
    }
  }, [activeSetlist, setlistIndex, songs]);

  const doNavigateBack = useCallback(() => {
    setSelectedSong(null);
    setShowSongView(false);
    setActiveSetlist(null);
    setSetlistIndex(0);
    setNavigationSource('none');
    setIsDirty(false);
  }, []);

  const handleSelectSong = (song: Song) => {
    setSelectedSong(song);
    setActiveSetlist(null);
    setNavigationSource('songs');
    setEditModeOnOpen(false);
    setShowSongView(true);
    setIsDirty(false);
  };

  const handleClearSong = () => {
    if (isDirty) {
      setPendingNavigation({ type: 'back' });
      return;
    }
    if (navigationSource === 'songs') {
      setActiveTab('songs');
    } else if (navigationSource === 'setlists') {
      setActiveTab('setlists');
    }
    doNavigateBack();
  };

  const handlePlaySetlist = (setlist: Setlist, startIndex: number = 0) => {
    setActiveSetlist(setlist);
    setSetlistIndex(startIndex);
    setNavigationSource('setlists');
    setEditModeOnOpen(false);
    setShowSongView(true);
    setIsDirty(false);
  };

  const handlePrevSong = () => {
    if (activeSetlist && setlistIndex > 0) {
      setSetlistIndex(setlistIndex - 1);
    }
  };

  const handleNextSong = () => {
    if (activeSetlist && setlistIndex < activeSetlist.songIds.length - 1) {
      setSetlistIndex(setlistIndex + 1);
    }
  };

  const handleSaveSong = (data: SongInput) => {
    if (selectedSong) {
      const updated = updateSong(selectedSong.id, data);
      if (updated) {
        setSelectedSong(updated);
      }
    } else {
      const newSong = createSong(data);
      setSelectedSong(newSong);
      setNavigationSource('songs');
    }
    setIsDirty(false);

    // If we were saving before navigating, do the navigation now
    const nav = pendingNavRef.current;
    if (nav) {
      pendingNavRef.current = null;
      if (nav.type === 'back') {
        if (navigationSource === 'songs') {
          setActiveTab('songs');
        } else if (navigationSource === 'setlists') {
          setActiveTab('setlists');
        }
        setTimeout(() => {
          doNavigateBack();
        }, 0);
      } else if (nav.type === 'tab') {
        setTimeout(() => {
          setSelectedSong(null);
          setShowSongView(false);
          setActiveSetlist(null);
          setSetlistIndex(0);
          setNavigationSource('none');
          setActiveTab(nav.tab);
        }, 0);
      }
    }
  };

  const handleCreateFromQuickAdd = (song: Song) => {
    setSelectedSong(song);
    setNavigationSource('songs');
    setEditModeOnOpen(true);
    setShowSongView(true);
    setIsDirty(false);
  };

  const handleDirtyChange = useCallback((dirty: boolean) => {
    setIsDirty(dirty);
  }, []);

  const handleTabChange = (tab: Tab) => {
    if (showSongView && isDirty) {
      setPendingNavigation({ type: 'tab', tab });
      return;
    }
    if (showSongView) {
      setSelectedSong(null);
      setShowSongView(false);
      setActiveSetlist(null);
      setSetlistIndex(0);
      setNavigationSource('none');
    }
    setActiveTab(tab);
  };

  const handleDiscardChanges = () => {
    const nav = pendingNavigation;
    setPendingNavigation(null);
    pendingNavRef.current = null;
    setIsDirty(false);
    if (nav?.type === 'back') {
      if (navigationSource === 'songs') {
        setActiveTab('songs');
      } else if (navigationSource === 'setlists') {
        setActiveTab('setlists');
      }
      doNavigateBack();
    } else if (nav?.type === 'tab') {
      setSelectedSong(null);
      setShowSongView(false);
      setActiveSetlist(null);
      setSetlistIndex(0);
      setNavigationSource('none');
      setActiveTab(nav.tab);
    }
  };

  const handleSaveAndNavigate = () => {
    const nav = pendingNavigation;
    setPendingNavigation(null);
    pendingNavRef.current = nav;
    songViewRef.current?.save();
  };

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <main>
        {showSongView ? (
          <SongView
            key={selectedSong?.id ?? 'new'}
            ref={songViewRef}
            song={selectedSong}
            onBack={handleClearSong}
            onSave={handleSaveSong}
            setlist={activeSetlist}
            songIndex={setlistIndex}
            onPrevSong={handlePrevSong}
            onNextSong={handleNextSong}
            showBack={navigationSource !== 'none'}
            onDirtyChange={handleDirtyChange}
            initialEditMode={editModeOnOpen}
          />
        ) : (
          <>
            {activeTab === 'songs' && (
              <SongLibrary
                onSelectSong={handleSelectSong}
                onCreateSong={createSong}
                onQuickAddSong={handleCreateFromQuickAdd}
              />
            )}
            {activeTab === 'setlists' && <SetlistLibrary onPlaySetlist={handlePlaySetlist} />}
          </>
        )}
      </main>

      {/* Bottom navigation */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
        isDarkMode={isMounted ? isDarkMode : false}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
      />

      {/* Unsaved changes dialog */}
      {pendingNavigation && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
          onClick={() => setPendingNavigation(null)}
        >
          <div
            className="bg-[var(--background)] rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-[var(--border)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-[var(--foreground)] text-center mb-2">
              Unsaved Changes
            </h2>
            <p className="text-[var(--muted)] text-center mb-6">
              You have unsaved changes. Discard?
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDiscardChanges}
                className="flex-1 h-12 rounded-xl bg-[var(--card)] hover:bg-[var(--border)] text-[var(--foreground)] font-semibold transition-all active:scale-95"
              >
                Discard
              </button>
              <button
                onClick={handleSaveAndNavigate}
                className="flex-1 h-12 rounded-xl bg-[var(--accent-blue)] hover:brightness-110 text-white font-semibold transition-all active:scale-95"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
