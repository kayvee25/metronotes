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
} from '../lib/live-session/session-storage';
import type {
  JoinedSession,
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

export interface UseJoinSessionReturn {
  session: JoinedSession | null;
  join: (roomCode: string, displayName: string) => Promise<JoinResult>;
  leave: () => void;
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
}

export function useJoinSession(): UseJoinSessionReturn {
  const [session, setSession] = useState<JoinedSession | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<JoinStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [pendingAssets, setPendingAssets] = useState(0);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [isBeating, setIsBeating] = useState(false);
  const [clockSynced, setClockSynced] = useState(false);

  const managerRef = useRef<PeerConnectionManager | null>(null);
  const receiverRef = useRef<AssetTransferReceiver | null>(null);
  const clockSyncRef = useRef<ClockSync | null>(null);
  const syncedMetronomeRef = useRef<SyncedMetronome | null>(null);
  const unsubSignalingRef = useRef<(() => void) | null>(null);
  const destroyedRef = useRef(false);

  // Track which assets we've received or are receiving
  const receivedAssetsRef = useRef(new Set<string>()); // assetId
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
    receivedAssetsRef.current.clear();
    pendingManifestsRef.current.clear();
  }, []);

  // Request missing assets from a manifest
  const requestMissingAssets = useCallback(
    (songId: string, manifests: AssetManifest[]) => {
      const manager = managerRef.current;
      if (!manager) return;

      let newPending = 0;
      for (const manifest of manifests) {
        if (receivedAssetsRef.current.has(manifest.id)) continue;

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

          // Store in IndexedDB
          await storeSessionAsset(songId, assetId, data).catch(() => {});

          // Notify host
          const ackMsg: MemberMessage = {
            type: 'asset-received',
            songId,
            assetId,
          };
          manager.send(JSON.stringify(ackMsg));
        };

        receiver.onAssetError = (songId, assetId, error) => {
          console.warn(`[session] Asset transfer error: ${songId}/${assetId}: ${error}`);
          setPendingAssets((prev) => Math.max(0, prev - 1));
          // Could retry here
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
            }

            if (parsed.type === 'queue-update') {
              setSession((prev) => {
                if (!prev) return prev;
                return { ...prev, queue: parsed.queue };
              });
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
            }

            if (parsed.type === 'asset-manifest') {
              pendingManifestsRef.current.set(parsed.songId, parsed.assets);
              requestMissingAssets(parsed.songId, parsed.assets);
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
          receiver.handleChunk(header as TransferHeader, data);
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
    setSession(null);
    setConnectionStatus('idle');
    setError(null);
    setPendingAssets(0);
    setCurrentBeat(0);
    setIsBeating(false);
    setClockSynced(false);
  }, [cleanup]);

  const setMetronomeSound = useCallback((sound: MetronomeSound) => {
    syncedMetronomeRef.current?.setSound(sound);
  }, []);

  const setMetronomeVolume = useCallback((volume: number) => {
    syncedMetronomeRef.current?.setVolume(volume);
  }, []);

  const setMetronomeMuted = useCallback((muted: boolean) => {
    syncedMetronomeRef.current?.setMuted(muted);
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
    connectionStatus,
    error,
    pendingAssets,
    currentBeat,
    isBeating,
    clockSynced,
    setMetronomeSound,
    setMetronomeVolume,
    setMetronomeMuted,
  };
}
