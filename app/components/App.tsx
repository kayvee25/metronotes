'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { SongViewHandle } from './SongView';
import LibraryTab, { LibrarySubTab } from './LibraryTab';
import LiveTab from './LiveTab';
import LivePerformanceView from './live/LivePerformanceView';
import Settings from './Settings';
import BottomNav, { Tab } from './BottomNav';
import AuthScreen from './AuthScreen';
import EmailVerificationScreen from './EmailVerificationScreen';
import { Song, Setlist, SongInput } from '../types';
import { useSongs } from '../hooks/useSongs';
import { useAssets } from '../hooks/useAssets';
import { useAuthProvider, useAuth, AuthContext } from '../hooks/useAuth';
import { usePerformanceSettings } from '../hooks/usePerformanceSettings';
import { useWakeLock } from '../hooks/useWakeLock';
import { useAssetLinkage } from '../hooks/useAssetLinkage';
import { migrateLocalToFirestore, firestoreGetSongs, firestoreGetAttachments, firestoreClearAttachmentAssetId } from '../lib/firestore';
import { migrateAttachmentsToAssets, migrateGuestAttachmentsToAssets } from '../lib/asset-migration';
import { storage } from '../lib/storage';
import { STORAGE_KEYS } from '../lib/constants';
import { ConfirmProvider } from './ui/ConfirmModal';
import Modal from './ui/Modal';
import { ToastProvider, useToast } from './ui/Toast';
import OfflineBanner from './ui/OfflineBanner';

type PendingNav = { type: 'tab'; tab: Tab } | { type: 'back' } | null;

function getInitialDarkMode(): boolean {
  if (typeof window === 'undefined') return false;
  const saved = localStorage.getItem(STORAGE_KEYS.DARK_MODE);
  if (saved !== null) return saved === 'true';
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function AppInner() {
  const { authState, user } = useAuth();
  const isGuest = authState === 'guest';
  const [activeTab, setActiveTab] = useState<Tab>('library');
  const [activeSong, setActiveSong] = useState<Song | null>(null);
  const [activeSetlist, setActiveSetlist] = useState<Setlist | null>(null);
  const [setlistIndex, setSetlistIndex] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(getInitialDarkMode);
  const [editModeOnOpen, setEditModeOnOpen] = useState(false);
  const [librarySubTab, setLibrarySubTab] = useState<LibrarySubTab>('songs');
  const [returnToSetlistId, setReturnToSetlistId] = useState<string | null>(null);
  const { toast } = useToast();
  const { songs, createSong, updateSong, deleteSong, isLoading: songsLoading, error: songsError, refresh: refreshSongs } = useSongs(toast);
  const { assets, updateAsset, deleteAsset } = useAssets(toast);
  const { linkage: assetLinkage, refresh: refreshAssetLinkage } = useAssetLinkage(songs);
  const perfSettings = usePerformanceSettings();

  // Migrate guest attachments to assets (one-time, idempotent)
  const guestAssetMigrationDone = useRef(false);
  useEffect(() => {
    if (isGuest && !songsLoading && songs.length > 0 && !guestAssetMigrationDone.current) {
      guestAssetMigrationDone.current = true;
      try {
        migrateGuestAttachmentsToAssets(songs);
      } catch {
        // Non-critical — migration is idempotent, will retry next load
      }
    }
  }, [isGuest, songsLoading, songs]);

  // Keep screen on during performance mode
  const isPerforming = activeTab === 'live' && activeSong != null;
  useWakeLock(perfSettings.keepScreenOn, isPerforming);

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

  // Android back button / browser back
  const handleBackRef = useRef(() => {});

  useEffect(() => {
    const handler = () => {
      handleBackRef.current();
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  // Derive current song from setlist when in setlist mode
  const currentSong = activeSetlist && activeSetlist.songIds.length > 0
    ? songs.find(s => s.id === activeSetlist.songIds[setlistIndex]) ?? activeSong
    : activeSong;

  const doNavigateBack = useCallback(() => {
    setActiveSong(null);
    setActiveSetlist(null);
    setSetlistIndex(0);
    setIsDirty(false);
    setActiveTab('library');
  }, []);

  const handleSelectSong = (song: Song) => {
    setActiveSong(song);
    setActiveSetlist(null);
    setEditModeOnOpen(false);
    setActiveTab('live');
    setIsDirty(false);
    history.pushState(null, '', '');
  };

  const handleEditSong = (song: Song) => {
    setActiveSong(song);
    setActiveSetlist(null);
    setEditModeOnOpen(true);
    setActiveTab('live');
    setIsDirty(false);
    history.pushState(null, '', '');
  };

  const handleClearSong = () => {
    if (isDirty) {
      setPendingNavigation({ type: 'back' });
      return;
    }
    if (activeSetlist) {
      setReturnToSetlistId(activeSetlist.id);
      setLibrarySubTab('setlists');
    }
    doNavigateBack();
  };

  // Keep ref in sync for popstate handler
  useEffect(() => {
    handleBackRef.current = () => {
      if (activeTab === 'live' && (activeSong || activeSetlist)) {
        handleClearSong();
      }
    };
  });

  const handlePlaySetlist = (setlist: Setlist, startIndex: number = 0) => {
    setActiveSetlist(setlist);
    setSetlistIndex(startIndex);
    setEditModeOnOpen(false);
    setActiveTab('live');
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

  const handleSelectSongFromQueue = (song: Song, index: number) => {
    if (activeSetlist) {
      setSetlistIndex(index);
    } else {
      setActiveSong(song);
    }
  };

  const handleSaveSong = (data: SongInput) => {
    if (currentSong) {
      const updated = updateSong(currentSong.id, data);
      if (updated) {
        setActiveSong(updated);
      }
    } else {
      const newSong = createSong(data);
      if (!newSong) return;
      setActiveSong(newSong);
    }
    setIsDirty(false);

    const nav = pendingNavRef.current;
    if (nav) {
      pendingNavRef.current = null;
      if (nav.type === 'back') {
        if (activeSetlist) {
          setReturnToSetlistId(activeSetlist.id);
          setLibrarySubTab('setlists');
        }
        setTimeout(() => {
          doNavigateBack();
        }, 0);
      } else if (nav.type === 'tab') {
        setTimeout(() => {
          setActiveSong(null);
          setActiveSetlist(null);
          setSetlistIndex(0);
          setActiveTab(nav.tab);
        }, 0);
      }
    }
  };

  const handleCreateFromQuickAdd = (song: Song) => {
    setActiveSong(song);
    setEditModeOnOpen(true);
    setActiveTab('live');
    setIsDirty(false);
    history.pushState(null, '', '');
  };

  const handleDirtyChange = useCallback((dirty: boolean) => {
    setIsDirty(dirty);
  }, []);

  const handleTabChange = (tab: Tab) => {
    if (activeTab === 'live' && currentSong && isDirty) {
      setPendingNavigation({ type: 'tab', tab });
      return;
    }
    if (activeTab === 'live' && currentSong) {
      // Leaving Live tab with a song — clear song state
      setActiveSong(null);
      setActiveSetlist(null);
      setSetlistIndex(0);
    }
    setActiveTab(tab);
  };

  const handleDiscardChanges = () => {
    const nav = pendingNavigation;
    setPendingNavigation(null);
    pendingNavRef.current = null;
    setIsDirty(false);
    if (nav?.type === 'back') {
      if (activeSetlist) {
        setReturnToSetlistId(activeSetlist.id);
        setLibrarySubTab('setlists');
      }
      doNavigateBack();
    } else if (nav?.type === 'tab') {
      setActiveSong(null);
      setActiveSetlist(null);
      setSetlistIndex(0);
      setActiveTab(nav.tab);
    }
  };

  const handleSaveAndNavigate = () => {
    const nav = pendingNavigation;
    setPendingNavigation(null);
    pendingNavRef.current = nav;
    songViewRef.current?.save();
  };

  const handleRenameAsset = (id: string, name: string) => {
    updateAsset(id, { name });
  };

  const handleDeleteAsset = async (id: string) => {
    // Cascade: clear assetId from all attachments referencing this asset
    const links = assetLinkage[id] || [];
    let cascadeErrors = 0;
    if (isGuest) {
      for (const link of links) {
        const attachments = storage.getAttachments(link.songId);
        for (const att of attachments) {
          if (att.assetId === id) {
            storage.updateAttachment(link.songId, att.id, { assetId: undefined });
          }
        }
      }
    } else if (user?.uid) {
      for (const link of links) {
        try {
          const attachments = await firestoreGetAttachments(user.uid, link.songId);
          for (const att of attachments) {
            if (att.assetId === id) {
              await firestoreClearAttachmentAssetId(user.uid, link.songId, att.id).catch((err) => {
                console.error('Failed to unlink asset from attachment:', err);
                cascadeErrors++;
              });
            }
          }
        } catch {
          cascadeErrors++;
        }
      }
    }
    if (cascadeErrors > 0) {
      toast(`${cascadeErrors} attachment(s) could not be unlinked. They may still reference the deleted file.`);
    }
    deleteAsset(id);
    refreshAssetLinkage();
  };

  const handleCreateSongFromLive = () => {
    setActiveTab('library');
  };

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <OfflineBanner />
      <main className="pb-16">
        {activeTab === 'library' && (
          <LibraryTab
            songs={songs}
            songsLoading={songsLoading}
            songsError={songsError}
            deleteSong={deleteSong}
            refreshSongs={refreshSongs}
            onSelectSong={handleSelectSong}
            onEditSong={handleEditSong}
            onCreateSong={createSong}
            onQuickAddSong={handleCreateFromQuickAdd}
            isGuest={isGuest}
            onPlaySetlist={handlePlaySetlist}
            initialViewSetlistId={returnToSetlistId}
            onInitialViewConsumed={() => setReturnToSetlistId(null)}
            assets={assets}
            assetLinkage={assetLinkage}
            onRenameAsset={handleRenameAsset}
            onDeleteAsset={handleDeleteAsset}
            initialSubTab={librarySubTab}
            onSubTabChange={setLibrarySubTab}
          />
        )}
        {activeTab === 'live' && (
          currentSong ? (
            <LivePerformanceView
              song={currentSong}
              songs={songs}
              onBack={handleClearSong}
              onSave={handleSaveSong}
              setlist={activeSetlist}
              songIndex={setlistIndex}
              onPrevSong={handlePrevSong}
              onNextSong={handleNextSong}
              onDirtyChange={handleDirtyChange}
              onSelectSongFromQueue={handleSelectSongFromQueue}
              perfFontSize={perfSettings.fontSize}
              perfFontFamily={perfSettings.fontFamily}
              metronomeSound={perfSettings.metronomeSound}
              songViewRef={songViewRef}
              initialEditMode={editModeOnOpen}
            />
          ) : (
            <LiveTab
              hasSongs={songs.length > 0}
              onCreateSong={handleCreateSongFromLive}
            />
          )
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
      </main>

      {/* Hide bottom nav when in live mode with active song (full-screen overlays) */}
      {!(activeTab === 'live' && currentSong) && (
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
          setMigrationProgress(null);
        }
      }

      // Migrate existing attachments to assets (idempotent, skip if already done)
      const migrationDone = localStorage.getItem('metronotes_asset_migration_done') === 'true';
      if (!migrationDone) {
        const songs = await firestoreGetSongs(authValue.user!.uid);
        await migrateAttachmentsToAssets(authValue.user!.uid, songs);
        localStorage.setItem('metronotes_asset_migration_done', 'true');
      }

      setMigrationState('done');
    };
    runMigration();
  }, [authValue.authState, authValue.user]);

  if (authValue.authState === 'loading') {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="text-[var(--muted)]">Loading...</div>
      </div>
    );
  }

  if (authValue.authState === 'unauthenticated') {
    return (
      <AuthContext.Provider value={authValue}>
        <AuthScreen />
      </AuthContext.Provider>
    );
  }

  if (authValue.authState === 'unverified') {
    return (
      <AuthContext.Provider value={authValue}>
        <EmailVerificationScreen />
      </AuthContext.Provider>
    );
  }

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
