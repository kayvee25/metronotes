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
import { useAuthProvider, useAuth, AuthContext } from '../hooks/useAuth';
import { usePerformanceSettings } from '../hooks/usePerformanceSettings';
import { useWakeLock } from '../hooks/useWakeLock';
import { migrateLocalToFirestore } from '../lib/firestore';
import { STORAGE_KEYS } from '../lib/constants';
import { ConfirmProvider } from './ui/ConfirmModal';
import Modal from './ui/Modal';
import { ToastProvider, useToast } from './ui/Toast';
import OfflineBanner from './ui/OfflineBanner';

type NavigationSource = 'none' | 'songs' | 'setlists';
type PendingNav = { type: 'tab'; tab: Tab } | { type: 'back' } | null;

function getInitialDarkMode(): boolean {
  if (typeof window === 'undefined') return false;
  const saved = localStorage.getItem(STORAGE_KEYS.DARK_MODE);
  if (saved !== null) return saved === 'true';
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function AppInner() {
  const { authState } = useAuth();
  const isGuest = authState === 'guest';
  const [activeTab, setActiveTab] = useState<Tab>('songs');
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [showSongView, setShowSongView] = useState(false);
  const [activeSetlist, setActiveSetlist] = useState<Setlist | null>(null);
  const [setlistIndex, setSetlistIndex] = useState(0);
  const [navigationSource, setNavigationSource] = useState<NavigationSource>('none');
  const [isDarkMode, setIsDarkMode] = useState(getInitialDarkMode);
  const [editModeOnOpen, setEditModeOnOpen] = useState(false);
  const [returnToSetlistId, setReturnToSetlistId] = useState<string | null>(null);
  const { toast } = useToast();
  const { songs, createSong, updateSong, deleteSong, isLoading: songsLoading, error: songsError, refresh: refreshSongs } = useSongs(toast);
  const perfSettings = usePerformanceSettings();

  // Keep screen on during performance mode
  useWakeLock(perfSettings.keepScreenOn, showSongView);

  // Dirty state tracking
  const [isDirty, setIsDirty] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<PendingNav>(null);
  const pendingNavRef = useRef<PendingNav>(null);
  const songViewRef = useRef<SongViewHandle>(null);

  // Sync dark mode to DOM and localStorage
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    localStorage.setItem(STORAGE_KEYS.DARK_MODE, String(isDarkMode));
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

  const handleEditSong = (song: Song) => {
    setSelectedSong(song);
    setActiveSetlist(null);
    setNavigationSource('songs');
    setEditModeOnOpen(true);
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
      if (activeSetlist) {
        setReturnToSetlistId(activeSetlist.id);
      }
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
      if (!newSong) return; // Guest limit reached
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
          if (activeSetlist) {
            setReturnToSetlistId(activeSetlist.id);
          }
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
        if (activeSetlist) {
          setReturnToSetlistId(activeSetlist.id);
        }
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
      <OfflineBanner />
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
            perfFontSize={perfSettings.fontSize}
            perfFontFamily={perfSettings.fontFamily}
            metronomeSound={perfSettings.metronomeSound}
          />
        ) : (
          <>
            {activeTab === 'songs' && (
              <SongLibrary
                songs={songs}
                isLoading={songsLoading}
                error={songsError}
                deleteSong={deleteSong}
                refresh={refreshSongs}
                onSelectSong={handleSelectSong}
                onEditSong={handleEditSong}
                onCreateSong={createSong}
                onQuickAddSong={handleCreateFromQuickAdd}
                isGuest={isGuest}
              />
            )}
            {activeTab === 'setlists' && (
              <SetlistLibrary
                songs={songs}
                onPlaySetlist={handlePlaySetlist}
                initialViewSetlistId={returnToSetlistId}
                onInitialViewConsumed={() => setReturnToSetlistId(null)}
              />
            )}
            {activeTab === 'settings' && (
              <Settings
                isDarkMode={isDarkMode}
                onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
                fontSize={perfSettings.fontSize}
                onFontSizeChange={perfSettings.setFontSize}
                fontFamily={perfSettings.fontFamily}
                onFontFamilyChange={perfSettings.setFontFamily}
                metronomeSound={perfSettings.metronomeSound}
                onMetronomeSoundChange={perfSettings.setMetronomeSound}
                keepScreenOn={perfSettings.keepScreenOn}
                onKeepScreenOnChange={perfSettings.setKeepScreenOn}
              />
            )}
          </>
        )}
      </main>

      {!showSongView && (
        <BottomNav
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />
      )}

      {/* Unsaved changes dialog */}
      <Modal isOpen={!!pendingNavigation} onClose={() => setPendingNavigation(null)} title="Unsaved Changes">
        <p className="text-[var(--muted)] text-center mb-6 -mt-2">
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
            className="flex-1 h-12 rounded-xl bg-[var(--accent)] hover:brightness-110 text-white font-semibold transition-all active:scale-95"
          >
            Save
          </button>
        </div>
      </Modal>
    </div>
  );
}

export default function App() {
  const authValue = useAuthProvider();
  const [migrationState, setMigrationState] = useState<'idle' | 'migrating' | 'done'>('idle');
  const [migrationProgress, setMigrationProgress] = useState<{ current: number; total: number } | null>(null);
  const migrationStarted = useRef(false);

  // Migration: when user signs in, check for localStorage data and upload to Firestore
  useEffect(() => {
    if (authValue.authState !== 'authenticated' || !authValue.user || migrationStarted.current) return;
    migrationStarted.current = true;

    const runMigration = async () => {
      const songsData = localStorage.getItem(STORAGE_KEYS.SONGS);
      const setlistsData = localStorage.getItem(STORAGE_KEYS.SETLISTS);

      const hasLocalData =
        (songsData && JSON.parse(songsData).length > 0) ||
        (setlistsData && JSON.parse(setlistsData).length > 0);

      if (hasLocalData) {
        setMigrationState('migrating');
        try {
          await migrateLocalToFirestore(authValue.user!.uid, (current, total) => {
            setMigrationProgress({ current, total });
          });
        } finally {
          setMigrationState('done');
          setMigrationProgress(null);
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
          <>
            {migrationProgress && migrationProgress.total > 0 && (
              <div className="text-sm text-[var(--muted)]">
                Uploading {migrationProgress.current}/{migrationProgress.total} items...
              </div>
            )}
            <div className="text-xs text-[var(--muted)]">This will only happen once</div>
          </>
        )}
      </div>
    );
  }

  // Authenticated (migration done) or guest — show the app
  return (
    <AuthContext.Provider value={authValue}>
      <ToastProvider>
        <ConfirmProvider>
          <AppInner />
        </ConfirmProvider>
      </ToastProvider>
    </AuthContext.Provider>
  );
}
