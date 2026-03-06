'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import SongView, { SongViewHandle } from './SongView';
import SongLibrary from './SongLibrary';
import SetlistLibrary from './SetlistLibrary';
import Settings from './Settings';
import BottomNav, { Tab } from './BottomNav';
import AuthScreen from './AuthScreen';
import EmailVerificationScreen from './EmailVerificationScreen';
import { Song, Setlist, SongInput } from '../types';
import { useSongs } from '../hooks/useSongs';
import { useAuthProvider, AuthContext } from '../hooks/useAuth';
import { migrateLocalToFirestore } from '../lib/firestore';

type NavigationSource = 'none' | 'songs' | 'setlists';
type PendingNav = { type: 'tab'; tab: Tab } | { type: 'back' } | null;

function getInitialDarkMode(): boolean {
  if (typeof window === 'undefined') return false;
  const saved = localStorage.getItem('metronotes_dark_mode');
  if (saved !== null) return saved === 'true';
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function AppInner() {
  const [activeTab, setActiveTab] = useState<Tab>('songs');
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [showSongView, setShowSongView] = useState(false);
  const [activeSetlist, setActiveSetlist] = useState<Setlist | null>(null);
  const [setlistIndex, setSetlistIndex] = useState(0);
  const [navigationSource, setNavigationSource] = useState<NavigationSource>('none');
  const [isDarkMode, setIsDarkMode] = useState(getInitialDarkMode);
  const [editModeOnOpen, setEditModeOnOpen] = useState(false);
  const { songs, createSong, updateSong } = useSongs();

  // Dirty state tracking
  const [isDirty, setIsDirty] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<PendingNav>(null);
  const pendingNavRef = useRef<PendingNav>(null);
  const songViewRef = useRef<SongViewHandle>(null);

  // Sync dark mode to DOM and localStorage
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    localStorage.setItem('metronotes_dark_mode', String(isDarkMode));
  }, [isDarkMode]);

  // Android back button / browser back: popstate triggers back navigation from song view
  const handleClearSongRef = useRef(() => {});
  const showSongViewRef = useRef(false);

  useEffect(() => {
    const handler = () => {
      if (showSongViewRef.current) {
        handleClearSongRef.current();
      }
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  // Derive current song from setlist when in setlist mode
  const currentSong = activeSetlist && activeSetlist.songIds.length > 0
    ? songs.find(s => s.id === activeSetlist.songIds[setlistIndex]) ?? selectedSong
    : selectedSong;

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
    history.pushState(null, '', '');
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

  // Keep refs in sync for popstate handler
  useEffect(() => {
    handleClearSongRef.current = handleClearSong;
    showSongViewRef.current = showSongView;
  });

  const handlePlaySetlist = (setlist: Setlist, startIndex: number = 0) => {
    setActiveSetlist(setlist);
    setSetlistIndex(startIndex);
    setNavigationSource('setlists');
    setEditModeOnOpen(false);
    setShowSongView(true);
    setIsDirty(false);
    history.pushState(null, '', '');
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
    if (currentSong) {
      const updated = updateSong(currentSong.id, data);
      if (updated) {
        setSelectedSong(updated);
      }
    } else {
      const newSong = createSong(data);
      setSelectedSong(newSong);
      setNavigationSource('songs');
    }
    setIsDirty(false);

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
    history.pushState(null, '', '');
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
            key={currentSong?.id ?? 'new'}
            ref={songViewRef}
            song={currentSong}
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
            {activeTab === 'settings' && (
              <Settings
                isDarkMode={isDarkMode}
                onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
              />
            )}
          </>
        )}
      </main>

      <BottomNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
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

export default function App() {
  const authValue = useAuthProvider();
  const [migrationState, setMigrationState] = useState<'idle' | 'migrating' | 'done'>('idle');
  const migrationStarted = useRef(false);

  // Migration: when user signs in, check for localStorage data and upload to Firestore
  useEffect(() => {
    if (authValue.authState !== 'authenticated' || !authValue.user || migrationStarted.current) return;
    migrationStarted.current = true;

    const runMigration = async () => {
      const SONGS_KEY = 'metronotes_songs';
      const SETLISTS_KEY = 'metronotes_setlists';
      const songsData = localStorage.getItem(SONGS_KEY);
      const setlistsData = localStorage.getItem(SETLISTS_KEY);

      const hasLocalData =
        (songsData && JSON.parse(songsData).length > 0) ||
        (setlistsData && JSON.parse(setlistsData).length > 0);

      if (hasLocalData) {
        setMigrationState('migrating');
        try {
          await migrateLocalToFirestore(authValue.user!.uid);
        } finally {
          setMigrationState('done');
        }
      } else {
        setMigrationState('done');
      }
    };
    runMigration();
  }, [authValue.authState, authValue.user]);

  // Loading state
  if (authValue.authState === 'loading') {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="text-[var(--muted)]">Loading...</div>
      </div>
    );
  }

  // Unauthenticated — show auth screen
  if (authValue.authState === 'unauthenticated') {
    return (
      <AuthContext.Provider value={authValue}>
        <AuthScreen />
      </AuthContext.Provider>
    );
  }

  // Unverified email — show verification screen
  if (authValue.authState === 'unverified') {
    return (
      <AuthContext.Provider value={authValue}>
        <EmailVerificationScreen />
      </AuthContext.Provider>
    );
  }

  // Migrating or waiting for migration check (authenticated users only)
  if (authValue.authState === 'authenticated' && migrationState !== 'done') {
    return (
      <div className="min-h-screen bg-[var(--background)] flex flex-col items-center justify-center gap-3">
        <div className="text-[var(--foreground)] font-medium">
          {migrationState === 'migrating' ? 'Migrating your data...' : 'Loading...'}
        </div>
        {migrationState === 'migrating' && (
          <div className="text-sm text-[var(--muted)]">This will only happen once</div>
        )}
      </div>
    );
  }

  // Authenticated (migration done) or guest — show the app
  return (
    <AuthContext.Provider value={authValue}>
      <AppInner />
    </AuthContext.Provider>
  );
}
