'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  doc,
  onSnapshot as firestoreOnSnapshot,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { normalizeRoomCode } from '../lib/live-session/room-code';
import {
  getSignalingRoom,
  createPeerRequest,
  updatePeerAnswer,
  addPeerIceCandidate,
} from '../lib/live-session/signaling';
import { PeerConnectionManager } from '../lib/live-session/webrtc';
import { AssetTransferReceiver } from '../lib/live-session/transfer';
import { ClockSync } from '../lib/live-session/clock-sync';
import { SyncedMetronome } from '../lib/live-session/synced-metronome';
import {
  storeSessionAsset,
  clearSessionStorage,
  deleteSessionAssetsForSong,
  getAllSessionAssetKeys,
} from '../lib/live-session/session-storage';
import type {
  JoinedSession,
  QueueItem,
  HostMessage,
  MemberMessage,
  PeerStatus,
  TransferHeader,
  AssetManifest,
} from '../lib/live-session/protocol';
import type { MetronomeSound } from '../lib/audio-clicks';
import { generateId } from '../lib/utils';

export type JoinStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'reconnecting'
  | 'ended';

export type JoinResult = { ok: true } | { ok: false; error: string };

const MEMBER_SESSION_KEY = 'metronotes_member_session';
const MEMBER_SNAPSHOT_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

function saveMemberSnapshot(roomCode: string, displayName: string) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(MEMBER_SESSION_KEY, JSON.stringify({ roomCode, displayName, savedAt: Date.now() }));
  } catch { /* non-critical */ }
}

function loadMemberSnapshot(): { roomCode: string; displayName: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(MEMBER_SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    // Check TTL
    if (data.savedAt && Date.now() - data.savedAt > MEMBER_SNAPSHOT_TTL_MS) {
      sessionStorage.removeItem(MEMBER_SESSION_KEY);
      return null;
    }
    return { roomCode: data.roomCode, displayName: data.displayName };
  } catch {
    return null;
  }
}

function clearMemberSnapshot() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(MEMBER_SESSION_KEY);
}

export interface UseJoinSessionReturn {
  session: JoinedSession | null;
  join: (roomCode: string, displayName: string) => Promise<JoinResult>;
  leave: () => void;
  reconnect: () => void;
  connectionStatus: JoinStatus;
  error: string | null;
  // Asset tracking (Phase 3)
  pendingAssets: number;
  // Metronome sync (Phase 4)
  currentBeat: number;
  isBeating: boolean;
  clockSynced: boolean;
  setMetronomeSound: (sound: MetronomeSound) => void;
  setMetronomeVolume: (volume: number) => void;
  setMetronomeMuted: (muted: boolean) => void;
  // Per-song download status
  songDownloadStatus: Map<string, { total: number; received: number }>;
  // Session persistence (Phase 5)
  pendingRejoin: { roomCode: string; displayName: string } | null;
  clearPendingRejoin: () => void;
}

export function useJoinSession(): UseJoinSessionReturn {
  const [session, setSession] = useState<JoinedSession | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<JoinStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [pendingAssets, setPendingAssets] = useState(0);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [isBeating, setIsBeating] = useState(false);
  const [clockSynced, setClockSynced] = useState(false);
  const [songDownloadStatus, setSongDownloadStatus] = useState<Map<string, { total: number; received: number }>>(new Map());
  const [pendingRejoin, setPendingRejoin] = useState<{ roomCode: string; displayName: string } | null>(() => {
    return loadMemberSnapshot();
  });

  const managerRef = useRef<PeerConnectionManager | null>(null);
  const receiverRef = useRef<AssetTransferReceiver | null>(null);
  const clockSyncRef = useRef<ClockSync | null>(null);
  const syncedMetronomeRef = useRef<SyncedMetronome | null>(null);
  const unsubSignalingRef = useRef<(() => void) | null>(null);
  const destroyedRef = useRef(false);

  // Store last join params for reconnection
  const lastJoinRef = useRef<{ roomCode: string; displayName: string } | null>(null);

  // Track which assets we've requested or received
  const requestedAssetsRef = useRef(new Set<string>()); // assetId — requested but not yet received
  const receivedAssetsRef = useRef(new Set<string>()); // assetId — fully received
  const pendingManifestsRef = useRef(new Map<string, AssetManifest[]>()); // songId → manifests

  const cleanup = useCallback(() => {
    if (syncedMetronomeRef.current) {
      syncedMetronomeRef.current.destroy();
      syncedMetronomeRef.current = null;
    }
    if (clockSyncRef.current) {
      clockSyncRef.current.destroy();
      clockSyncRef.current = null;
    }
    if (managerRef.current) {
      managerRef.current.destroy();
      managerRef.current = null;
    }
    if (receiverRef.current) {
      receiverRef.current.destroy();
      receiverRef.current = null;
    }
    if (unsubSignalingRef.current) {
      unsubSignalingRef.current();
      unsubSignalingRef.current = null;
    }
    requestedAssetsRef.current.clear();
    receivedAssetsRef.current.clear();
    pendingManifestsRef.current.clear();
  }, []);

  // Request missing assets after receiving a manifest
  const requestMissingAssets = useCallback(
    (songId: string, manifests: AssetManifest[]) => {
      const manager = managerRef.current;
      if (!manager) return;

      let newPending = 0;
      for (const manifest of manifests) {
        // Skip if already requested or received
        if (requestedAssetsRef.current.has(manifest.id)) continue;
        if (receivedAssetsRef.current.has(manifest.id)) continue;

        requestedAssetsRef.current.add(manifest.id);
        const requestMsg: MemberMessage = {
          type: 'asset-request',
          songId,
          assetId: manifest.id,
        };
        manager.send(JSON.stringify(requestMsg));
        newPending++;
      }

      if (newPending > 0) {
        setPendingAssets((prev) => prev + newPending);
      }
    },
    []
  );

  const join = useCallback(
    async (rawCode: string, displayName: string): Promise<JoinResult> => {
      const code = normalizeRoomCode(rawCode);
      if (!code) {
        const msg = 'Invalid room code';
        setError(msg);
        return { ok: false, error: msg };
      }

      cleanup();
      destroyedRef.current = false;
      setError(null);
      setPendingAssets(0);
      setConnectionStatus('connecting');
      lastJoinRef.current = { roomCode: code, displayName };
      saveMemberSnapshot(code, displayName);
      setPendingRejoin(null);

      // Pre-populate receivedAssetsRef from IndexedDB cache (for rejoin scenarios)
      try {
        const cachedKeys = await getAllSessionAssetKeys();
        for (const key of cachedKeys) {
          const assetId = key.split(':')[1];
          if (assetId) {
            receivedAssetsRef.current.add(assetId);
          }
        }
      } catch {
        // IndexedDB unavailable — all assets will be re-requested
      }

      try {
        // Check if room exists
        const room = await getSignalingRoom(code);
        if (!room) {
          const msg = 'Room not found or expired';
          setError(msg);
          setConnectionStatus('idle');
          return { ok: false, error: msg };
        }

        const manager = new PeerConnectionManager();
        managerRef.current = manager;

        // Set up asset transfer receiver
        const receiver = new AssetTransferReceiver();
        receiverRef.current = receiver;

        receiver.onAssetComplete = async (songId, assetId, data) => {
          if (destroyedRef.current) return;
          receivedAssetsRef.current.add(assetId);
          setPendingAssets((prev) => Math.max(0, prev - 1));
          // Update per-song download status (compute from ref for robustness)
          setSongDownloadStatus((prev) => {
            const next = new Map(prev);
            const manifests = pendingManifestsRef.current.get(songId);
            if (manifests) {
              const received = manifests.filter(a => receivedAssetsRef.current.has(a.id)).length;
              next.set(songId, { total: manifests.length, received });
            }
            return next;
          });

          // Store in IndexedDB
          await storeSessionAsset(songId, assetId, data).catch((err) => {
            console.error(`[member] Failed to store asset:`, err);
          });

          // Notify host
          const ackMsg: MemberMessage = {
            type: 'asset-received',
            songId,
            assetId,
          };
          manager.send(JSON.stringify(ackMsg));
        };

        const retriedAssetsRef = new Set<string>();
        receiver.onAssetError = (songId, assetId, error) => {
          console.warn(`[member] Asset transfer error: ${songId}/${assetId}: ${error}`);

          // Retry once on checksum mismatch
          if (error === 'Checksum mismatch' && !retriedAssetsRef.has(assetId)) {
            retriedAssetsRef.add(assetId);
            requestedAssetsRef.current.delete(assetId);
            const manifests = pendingManifestsRef.current.get(songId);
            const manifest = manifests?.find(m => m.id === assetId);
            if (manifest) {
              requestMissingAssets(songId, [manifest]);
              return;
            }
          }

          // Give up — mark as received so spinner doesn't hang
          // (attachment may still render via Firebase storageUrl fallback)
          receivedAssetsRef.current.add(assetId);
          setPendingAssets((prev) => Math.max(0, prev - 1));
          setSongDownloadStatus((prev) => {
            const next = new Map(prev);
            const manifests = pendingManifestsRef.current.get(songId);
            if (manifests) {
              const received = manifests.filter(a => receivedAssetsRef.current.has(a.id)).length;
              next.set(songId, { total: manifests.length, received });
            }
            return next;
          });
        };

        // Process asset manifests embedded in queue items
        const processQueueManifests = (queue: QueueItem[]) => {
          for (const item of queue) {
            if (item.assets && item.assets.length > 0) {
              pendingManifestsRef.current.set(item.songId, item.assets);
              const alreadyReceived = item.assets.filter(a => receivedAssetsRef.current.has(a.id)).length;
              setSongDownloadStatus((prev) => {
                const next = new Map(prev);
                next.set(item.songId, { total: item.assets!.length, received: alreadyReceived });
                return next;
              });
              requestMissingAssets(item.songId, item.assets);
            }
          }
        };

        // Handle messages from host
        manager.onMessage = (message) => {
          if (destroyedRef.current) return;
          try {
            const parsed: HostMessage = JSON.parse(message);

            if (parsed.type === 'session-end') {
              setConnectionStatus('ended');
              setSession(null);
              clearSessionStorage().catch(() => {});
              clearMemberSnapshot();
              cleanup();
              return;
            }

            if (parsed.type === 'session-state') {
              setSession({
                roomCode: code,
                queue: parsed.queue,
                currentIndex: parsed.currentIndex,
                metronome: parsed.metronome,
                connectionStatus: 'connected',
              });
              processQueueManifests(parsed.queue);
            }

            if (parsed.type === 'queue-update') {
              setSession((prev) => {
                if (!prev) return prev;
                // Diff queue to clean up assets for removed songs
                const prevSongIds = new Set(prev.queue.map(q => q.songId));
                const newSongIds = new Set(parsed.queue.map((q: { songId: string }) => q.songId));
                for (const songId of prevSongIds) {
                  if (!newSongIds.has(songId)) {
                    deleteSessionAssetsForSong(songId).catch(() => {});
                  }
                }
                return { ...prev, queue: parsed.queue };
              });
              processQueueManifests(parsed.queue);
            }

            if (parsed.type === 'song-change') {
              setSession((prev) => {
                if (!prev) return prev;
                return { ...prev, currentIndex: parsed.index };
              });
            }

            if (parsed.type === 'song-update') {
              setSession((prev) => {
                if (!prev) return prev;
                const updatedQueue = prev.queue.map((item) => {
                  if (item.songId === parsed.song.id) {
                    return { ...item, song: parsed.song, attachments: parsed.attachments };
                  }
                  return item;
                });
                return { ...prev, queue: updatedQueue };
              });
              // Process any asset manifests included in the update
              if (parsed.assets && parsed.assets.length > 0) {
                processQueueManifests([{ queueIndex: 0, songId: parsed.song.id, song: parsed.song, attachments: parsed.attachments, assets: parsed.assets }]);
              }
            }

            if (parsed.type === 'metronome-update') {
              setSession((prev) => {
                if (!prev) return prev;
                return { ...prev, metronome: parsed.metronome };
              });
              syncedMetronomeRef.current?.handleMetronomeUpdate(parsed.metronome);
              // Stop synced metronome if host stopped
              if (!parsed.metronome.isPlaying) {
                syncedMetronomeRef.current?.stop();
              }
            }

            if (parsed.type === 'clock-sync-response') {
              clockSyncRef.current?.handleResponse(parsed.t1, parsed.t2, parsed.t3);
            }

            if (parsed.type === 'beat') {
              syncedMetronomeRef.current?.handleBeat(parsed.networkTime, parsed.beatNumber);
            }
          } catch {
            // Non-JSON — ignore
          }
        };

        // Handle binary messages (asset chunks)
        manager.onBinaryMessage = (header, data) => {
          if (destroyedRef.current) return;
          const h = header as TransferHeader;
          receiver.handleChunk(h, data);
        };

        manager.onStatusChange = (status: PeerStatus) => {
          if (destroyedRef.current) return;
          setConnectionStatus(status);
        };

        manager.onChannelOpen = () => {
          if (destroyedRef.current) return;

          // Send join message
          const joinMsg: MemberMessage = {
            type: 'join',
            displayName,
          };
          manager.send(JSON.stringify(joinMsg));

          // Initialize clock sync
          const clockSync = new ClockSync(
            (t1) => {
              const syncMsg: MemberMessage = { type: 'clock-sync-request', t1 };
              manager.send(JSON.stringify(syncMsg));
            },
            () => {
              if (destroyedRef.current) return;
              setClockSynced(true);
            }
          );
          clockSyncRef.current = clockSync;
          clockSync.startSync();
          clockSync.startPeriodicResync();

          // Initialize synced metronome
          const syncedMet = new SyncedMetronome(clockSync);
          syncedMet.onBeatUpdate = (beat, beating) => {
            if (destroyedRef.current) return;
            setCurrentBeat(beat);
            setIsBeating(beating);
          };
          syncedMetronomeRef.current = syncedMet;
        };

        // Write a peer request doc (empty answer triggers host to create offer)
        const peerId = generateId();
        await createPeerRequest(code, peerId);

        // Listen for host to write offer into our peer doc
        let offerProcessed = false;
        let lastIceCandidateCount = 0;

        const peerDocRef = doc(db, 'sessions', code, 'peers', peerId);

        unsubSignalingRef.current = firestoreOnSnapshot(
          peerDocRef,
          async (snap) => {
            if (destroyedRef.current) return;
            const data = snap.data();
            if (!data?.offer?.sdp) return;

            // Process new host ICE candidates
            const hostCandidates: RTCIceCandidateInit[] =
              data.hostIceCandidates ?? [];
            if (hostCandidates.length > lastIceCandidateCount) {
              const newCandidates = hostCandidates.slice(
                lastIceCandidateCount
              );
              lastIceCandidateCount = hostCandidates.length;
              for (const candidate of newCandidates) {
                manager.addIceCandidate(candidate);
              }
            }

            // Only process offer once
            if (offerProcessed) return;
            offerProcessed = true;

            // Forward peer ICE candidates to our doc
            manager.onIceCandidate = async (candidate) => {
              await addPeerIceCandidate(code, peerId, candidate).catch(
                () => {}
              );
            };

            try {
              const answer = await manager.createAnswer(data.offer);
              await updatePeerAnswer(code, peerId, answer);

              // Stop listening for signaling once connected
              const waitForOpen = setInterval(() => {
                if (destroyedRef.current) {
                  clearInterval(waitForOpen);
                  return;
                }
                if (manager.getStatus() === 'connected') {
                  clearInterval(waitForOpen);
                  if (unsubSignalingRef.current) {
                    unsubSignalingRef.current();
                    unsubSignalingRef.current = null;
                  }
                }
              }, 100);

              setTimeout(() => clearInterval(waitForOpen), 15000);
            } catch {
              offerProcessed = false;
              setError('Failed to connect to host');
              setConnectionStatus('idle');
            }
          }
        );

        return { ok: true };
      } catch {
        const msg = 'Failed to join session';
        setError(msg);
        setConnectionStatus('idle');
        return { ok: false, error: msg };
      }
    },
    [cleanup, requestMissingAssets]
  );

  const leave = useCallback(() => {
    destroyedRef.current = true;
    cleanup();
    clearSessionStorage().catch(() => {});
    clearMemberSnapshot();
    setSession(null);
    setConnectionStatus('idle');
    setError(null);
    setPendingAssets(0);
    setCurrentBeat(0);
    setIsBeating(false);
    setClockSynced(false);
    setSongDownloadStatus(new Map());
  }, [cleanup]);

  const reconnect = useCallback(() => {
    const params = lastJoinRef.current;
    if (!params) return;
    join(params.roomCode, params.displayName);
  }, [join]);

  const setMetronomeSound = useCallback((sound: MetronomeSound) => {
    syncedMetronomeRef.current?.setSound(sound);
  }, []);

  const setMetronomeVolume = useCallback((volume: number) => {
    syncedMetronomeRef.current?.setVolume(volume);
  }, []);

  const setMetronomeMuted = useCallback((muted: boolean) => {
    syncedMetronomeRef.current?.setMuted(muted);
  }, []);

  const clearPendingRejoin = useCallback(() => {
    clearMemberSnapshot();
    clearSessionStorage().catch(() => {});
    setPendingRejoin(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      destroyedRef.current = true;
      cleanup();
    };
  }, [cleanup]);

  return {
    session,
    join,
    leave,
    reconnect,
    connectionStatus,
    error,
    pendingAssets,
    currentBeat,
    isBeating,
    clockSynced,
    setMetronomeSound,
    setMetronomeVolume,
    setMetronomeMuted,
    songDownloadStatus,
    pendingRejoin,
    clearPendingRejoin,
  };
}
