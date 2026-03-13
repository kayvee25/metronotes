'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { SongViewHandle } from './SongView';
import LibraryTab, { LibrarySubTab } from './LibraryTab';
import LiveTab from './LiveTab';
import LivePerformanceView from './live/LivePerformanceView';
import Settings from './Settings';
import BottomNav, { Tab } from './BottomNav';
import AuthScreen from './AuthScreen';
import { useSessionAttachments } from '../hooks/useSessionAttachments';
import EmailVerificationScreen from './EmailVerificationScreen';
import { Song, Setlist, SongInput, Attachment, Asset } from '../types';
import { useSongs } from '../hooks/useSongs';
import { useAssets } from '../hooks/useAssets';
import { useHostSession } from '../hooks/useHostSession';
import { useJoinSession } from '../hooks/useJoinSession';
import { useAuthProvider, useAuth, AuthContext } from '../hooks/useAuth';
import { usePerformanceSettings } from '../hooks/usePerformanceSettings';
import { useWakeLock } from '../hooks/useWakeLock';
import { useAssetLinkage } from '../hooks/useAssetLinkage';
import { migrateLocalToFirestore, firestoreGetSongs, firestoreGetAttachments } from '../lib/firestore';
import { migrateAttachmentsToAssets, migrateGuestAttachmentsToAssets, migrateAssetStoragePaths } from '../lib/asset-migration';
import { storage } from '../lib/storage';
import { STORAGE_KEYS } from '../lib/constants';
import { fetchCloudBlob } from '../lib/cloud-providers/fetch-cloud-blob';
import { isCloudLinked } from '../lib/cloud-providers/types';
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

  // Live session hooks (lifted to App level for cross-tab access)
  const hostSession = useHostSession();
  const joinSession = useJoinSession();

  // Member performance view: derive song + attachments from join session
  const memberQueueItem = useMemo(() => {
    if (joinSession.connectionStatus !== 'connected' || !joinSession.session) return null;
    const idx = joinSession.session.currentIndex;
    if (idx == null) return null;
    return joinSession.session.queue[idx] ?? null;
  }, [joinSession.connectionStatus, joinSession.session]);

  const memberSong: Song | null = useMemo(() => {
    if (!memberQueueItem) return null;
    return memberQueueItem.song;
  }, [memberQueueItem]);

  // Allow member to go back to waiting room from performance view
  const [memberShowPerformance, setMemberShowPerformance] = useState(true);
  // Auto-show performance view when host changes songs
  const prevMemberSongIdRef = useRef<string | null>(null);
  if (memberSong?.id !== prevMemberSongIdRef.current) {
    prevMemberSongIdRef.current = memberSong?.id ?? null;
    if (memberSong) {
      setMemberShowPerformance(true);
    }
  }

  const memberAttachmentsMeta = useMemo(
    () => memberQueueItem?.attachments ?? [],
    [memberQueueItem]
  );

  const { resolvedAttachments: memberAttachments } =
    useSessionAttachments(memberSong?.id ?? null, memberAttachmentsMeta);

  const memberSessionQueue = useMemo(() => {
    if (!joinSession.session) return undefined;
    return joinSession.session.queue.map(q => ({ id: q.songId, name: q.song.name, artist: q.song.artist }));
  }, [joinSession.session]);

  const memberSessionQueueIndex = joinSession.session?.currentIndex ?? undefined;

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

  // Keep screen on during performance mode or active session
  const isPerforming = activeTab === 'live' && activeSong != null;
  const isInSession = hostSession.isActive || (joinSession.connectionStatus !== 'idle' && joinSession.connectionStatus !== 'ended');
  useWakeLock(perfSettings.keepScreenOn, isPerforming || isInSession);

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
    // If in a live session, stay on the live tab (go back to dashboard)
    if (activeTab === 'live' && hostSession.isActive) {
      setActiveSong(null);
      setActiveSetlist(null);
      setSetlistIndex(0);
      setIsDirty(false);
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
    // In a live session, also update session currentIndex so members follow
    if (hostSession.isActive) {
      hostSession.navigateToSong(index);
      setActiveSong(song);
      return;
    }
    if (activeSetlist) {
      setSetlistIndex(index);
    } else {
      setActiveSong(song);
    }
  };

  const handleSaveSong = async (data: SongInput) => {
    let savedSong: Song | undefined;
    if (currentSong) {
      const updated = await updateSong(currentSong.id, data);
      if (updated) {
        setActiveSong(updated);
        savedSong = updated;
      }
    } else {
      const newSong = await createSong(data);
      if (!newSong) return;
      setActiveSong(newSong);
      savedSong = newSong;
    }
    setIsDirty(false);

    // Broadcast song update to session members if song is in queue
    if (savedSong && hostSession.isActive && hostSession.session?.queue.some(q => q.songId === savedSong!.id)) {
      const songId = savedSong.id;
      const song = savedSong;
      (async () => {
        try {
          let atts: Attachment[];
          if (isGuest) {
            atts = storage.getAttachments(songId);
          } else if (user?.uid) {
            atts = await firestoreGetAttachments(user.uid, songId);
          } else {
            atts = [];
          }
          // Build assets map for any new/updated attachments
          const songAssetsMap = new Map<string, Asset>();
          for (const att of atts) {
            if (att.assetId) {
              const asset = assets.find(a => a.id === att.assetId);
              if (asset) {
                songAssetsMap.set(asset.id, asset);
              }
            }
          }
          hostSession.broadcastSongUpdate(song, atts, songAssetsMap);
        } catch {
          // Non-critical — members will have stale data until next navigate
        }
      })();
    }

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

  const handleRenameAsset = async (id: string, name: string) => {
    await updateAsset(id, { name });
  };

  const handleDeleteAsset = async (id: string) => {
    // Cascade: clear assetId from all attachments referencing this asset
    const { firestoreClearAttachmentAssetId, firestoreGetAttachments: getAtts } = await import('../lib/firestore');
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
          const attachments = await getAtts(user.uid, link.songId);
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
    await deleteAsset(id);
    refreshAssetLinkage();
  };

  const handleCreateSongFromLive = () => {
    setActiveTab('library');
  };

  // Add songs to live session queue (from Library)
  const handleAddSongsToSession = useCallback(
    async (songsToAdd: Song[]) => {
      if (!hostSession.isActive) return;

      // Load attachments for each song
      const attachmentsMap = new Map<string, Attachment[]>();
      const assetsMap = new Map<string, Asset>();

      for (const song of songsToAdd) {
        try {
          let atts: Attachment[];
          if (isGuest) {
            atts = storage.getAttachments(song.id);
          } else if (user?.uid) {
            atts = await firestoreGetAttachments(user.uid, song.id);
          } else {
            atts = [];
          }

          // For cloud-linked attachments without an assetId, download the blob
          // and create a synthetic asset so it flows through the transfer pipeline
          for (let i = 0; i < atts.length; i++) {
            const att = atts[i];
            if (!att.assetId && isCloudLinked(att)) {
              try {
                const blob = await fetchCloudBlob(att.cloudProvider!, att.cloudFileId!, att.id);
                const arrayBuffer = await blob.arrayBuffer();
                const syntheticId = crypto.randomUUID();
                const syntheticAsset: Asset = {
                  id: syntheticId,
                  name: att.cloudFileName || att.name || `${att.type} asset`,
                  type: att.type as Asset['type'],
                  mimeType: att.cloudMimeType || blob.type || null,
                  size: arrayBuffer.byteLength,
                  storageUrl: null,
                  storagePath: null,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                };
                assetsMap.set(syntheticId, syntheticAsset);
                hostSession.registerCloudBlob(syntheticId, arrayBuffer);
                // Tag the attachment so enrichQueueWithManifests picks it up
                atts[i] = { ...att, assetId: syntheticId };
              } catch {
                // Cloud auth unavailable or download failed — skip this attachment
              }
            }
          }

          attachmentsMap.set(song.id, atts);

          // Collect referenced assets
          for (const att of atts) {
            if (att.assetId) {
              const asset = assets.find(a => a.id === att.assetId);
              if (asset) {
                assetsMap.set(asset.id, asset);
              }
            }
          }
        } catch {
          attachmentsMap.set(song.id, []);
        }
      }

      hostSession.addSongsToQueue(songsToAdd, attachmentsMap, assetsMap);
      toast(`Added ${songsToAdd.length} song${songsToAdd.length > 1 ? 's' : ''} to session`, 'success');
    },
    [hostSession, isGuest, user?.uid, assets, toast]
  );

  const handleSwitchToLibrary = () => {
    setActiveTab('library');
  };

  const handleHostNavigateToSong = useCallback((queueIndex: number) => {
    hostSession.navigateToSong(queueIndex);
    const queueItem = hostSession.session?.queue[queueIndex];
    if (queueItem) {
      const song = songs.find(s => s.id === queueItem.songId);
      if (song) {
        setActiveSong(song);
        setActiveSetlist(null);
        setEditModeOnOpen(false);
        setIsDirty(false);
        history.pushState(null, '', '');
      }
    }
  }, [hostSession, songs]);

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
            isHostingSession={hostSession.isActive}
            connectedPeerCount={hostSession.peers.filter(p => p.status === 'connected').length}
            onAddSongsToSession={handleAddSongsToSession}
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
              sessionQueue={hostSession.isActive ? hostSession.session?.queue.map(q => ({ id: q.songId, name: q.song.name, artist: q.song.artist })) : undefined}
              sessionQueueIndex={hostSession.isActive ? (hostSession.session?.currentIndex ?? undefined) : undefined}
              onBeat={hostSession.isActive ? hostSession.broadcastBeat : undefined}
              onMetronomeStateChange={hostSession.isActive ? (state) => {
                hostSession.updateMetronomeState({
                  ...state,
                  networkTimeAtLastBeat: performance.now(),
                  beatNumber: 0,
                });
              } : undefined}
            />
          ) : memberSong && memberShowPerformance ? (
            <div className="relative h-full">
              <LivePerformanceView
                song={memberSong}
                songs={[]}
                onBack={() => setMemberShowPerformance(false)}
                onSave={() => {/* read-only */}}
                setlist={null}
                songIndex={0}
                onPrevSong={() => {}}
                onNextSong={() => {}}
                onDirtyChange={() => {}}
                onSelectSongFromQueue={() => {}}
                perfFontSize={perfSettings.fontSize}
                perfFontFamily={perfSettings.fontFamily}
                metronomeSound={perfSettings.metronomeSound}
                readOnly
                externalAttachments={memberAttachments}
                sessionQueue={memberSessionQueue}
                sessionQueueIndex={memberSessionQueueIndex}
                externalTransport={{
                  currentBeat: joinSession.currentBeat,
                  isBeating: joinSession.isBeating,
                  isPlaying: joinSession.session?.metronome?.isPlaying ?? false,
                }}
              />
              {/* Reconnection banner overlay for member performance view */}
              {joinSession.connectionStatus === 'reconnecting' && (
                <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/30 backdrop-blur-sm">
                  <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin shrink-0" />
                  <span className="text-sm font-medium text-amber-400">
                    Connection lost — Reconnecting...
                  </span>
                </div>
              )}
              {joinSession.connectionStatus === 'disconnected' && (
                <div className="absolute top-0 left-0 right-0 z-50 flex flex-col items-center gap-2 px-4 py-3 bg-red-500/10 border-b border-red-500/30 backdrop-blur-sm">
                  <span className="text-sm font-medium text-red-400">
                    Disconnected
                  </span>
                  <button
                    onClick={joinSession.reconnect}
                    className="px-4 py-1.5 rounded-lg bg-[var(--accent)] text-white text-sm font-semibold hover:brightness-110 active:scale-95 transition-all"
                  >
                    Tap to rejoin
                  </button>
                </div>
              )}
            </div>
          ) : (
            <LiveTab
              hasSongs={songs.length > 0}
              songs={songs}
              onCreateSong={handleCreateSongFromLive}
              hostSession={hostSession}
              joinSession={joinSession}
              onAddSongsToSession={handleAddSongsToSession}
              onNavigateToSong={handleHostNavigateToSong}
              onMemberShowPerformance={memberSong ? () => setMemberShowPerformance(true) : undefined}
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

      {/* Hide bottom nav when in live mode with active song or member performance view */}
      {!(activeTab === 'live' && (currentSong || (memberSong && memberShowPerformance))) && (
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

      // Patch existing assets missing storagePath (idempotent)
      const storagePathMigrationDone = localStorage.getItem('metronotes_asset_storagepath_done') === 'true';
      if (!storagePathMigrationDone) {
        const songs = await firestoreGetSongs(authValue.user!.uid);
        await migrateAssetStoragePaths(authValue.user!.uid, songs);
        localStorage.setItem('metronotes_asset_storagepath_done', 'true');
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
