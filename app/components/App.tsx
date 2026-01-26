'use client';

import { useState, useEffect } from 'react';
import SongView from './SongView';
import SongLibrary from './SongLibrary';
import SetlistLibrary from './SetlistLibrary';
import BottomNav from './BottomNav';
import { Song, Setlist, SongInput } from '../types';
import { useSongs } from '../hooks/useSongs';

type Tab = 'new' | 'songs' | 'setlists';
type NavigationSource = 'none' | 'songs' | 'setlists';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('new');
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [activeSetlist, setActiveSetlist] = useState<Setlist | null>(null);
  const [setlistIndex, setSetlistIndex] = useState(0);
  const [navigationSource, setNavigationSource] = useState<NavigationSource>('none');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const { songs, createSong, updateSong } = useSongs();

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

  const handleSelectSong = (song: Song) => {
    setSelectedSong(song);
    setActiveSetlist(null);
    setNavigationSource('songs');
    setActiveTab('new');
  };

  const handleClearSong = () => {
    // Navigate back based on where user came from
    if (navigationSource === 'songs') {
      setActiveTab('songs');
    } else if (navigationSource === 'setlists') {
      setActiveTab('setlists');
    }
    setSelectedSong(null);
    setActiveSetlist(null);
    setSetlistIndex(0);
    setNavigationSource('none');
  };

  const handlePlaySetlist = (setlist: Setlist, startIndex: number = 0) => {
    setActiveSetlist(setlist);
    setSetlistIndex(startIndex);
    setNavigationSource('setlists');
    setActiveTab('new');
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
      // Update existing song
      const updated = updateSong(selectedSong.id, data);
      if (updated) {
        setSelectedSong(updated);
      }
    } else {
      // Create new song - treat as if opened from songs list
      const newSong = createSong(data);
      setSelectedSong(newSong);
      setNavigationSource('songs');
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Theme toggle - bottom right, above nav */}
      <button
        onClick={() => setIsDarkMode(!isDarkMode)}
        className="fixed bottom-20 right-4 z-40 w-10 h-10 rounded-xl bg-[var(--card)] border border-[var(--border)] hover:bg-[var(--border)] active:scale-95 transition-all flex items-center justify-center shadow-lg"
        aria-label="Toggle dark mode"
      >
        {isMounted && (
          <svg
            className="w-5 h-5 text-[var(--foreground)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            {isDarkMode ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
              />
            )}
          </svg>
        )}
      </button>

      {/* Main content area */}
      <main>
        {activeTab === 'new' && (
          <SongView
            song={selectedSong}
            onBack={handleClearSong}
            onSave={handleSaveSong}
            setlist={activeSetlist}
            songIndex={setlistIndex}
            onPrevSong={handlePrevSong}
            onNextSong={handleNextSong}
            showBack={navigationSource !== 'none'}
          />
        )}
        {activeTab === 'songs' && <SongLibrary onSelectSong={handleSelectSong} />}
        {activeTab === 'setlists' && <SetlistLibrary onPlaySetlist={handlePlaySetlist} />}
      </main>

      {/* Bottom navigation */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={(tab) => {
          // If clicking Play tab while already on Play, start a new song
          if (tab === 'new' && activeTab === 'new') {
            setSelectedSong(null);
            setActiveSetlist(null);
            setSetlistIndex(0);
            setNavigationSource('none');
          }
          setActiveTab(tab);
        }}
      />
    </div>
  );
}
