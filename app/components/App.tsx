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
        isDarkMode={isMounted ? isDarkMode : false}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
      />
    </div>
  );
}
