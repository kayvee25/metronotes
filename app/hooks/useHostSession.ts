'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { generateRoomCode } from '../lib/live-session/room-code';
import {
  createSignalingRoom,
  onPeerJoined,
  deleteSignalingRoom,
} from '../lib/live-session/signaling';
import { HostConnectionManager } from '../lib/live-session/webrtc';
import { AssetTransferSender } from '../lib/live-session/transfer';
import type {
  SessionSettings,
  PeerInfo,
  PeerStatus,
  LiveSession,
  QueueItem,
  HostMessage,
  MemberMessage,
  AssetManifest,
} from '../lib/live-session/protocol';
import {
  DEFAULT_SESSION_SETTINGS,
  DEFAULT_METRONOME_STATE as DEFAULT_METRO,
} from '../lib/live-session/protocol';
import type { Song, Attachment, Asset } from '../types';

export interface UseHostSessionReturn {
  session: LiveSession | null;
  startSession: (settings?: Partial<SessionSettings>) => Promise<string>;
  endSession: () => Promise<void>;
  peers: PeerInfo[];
  isActive: boolean;
  // Queue operations (Phase 3)
  addSongsToQueue: (
    songs: Song[],
    attachmentsMap: Map<string, Attachment[]>,
    assetsMap: Map<string, Asset>
  ) => void;
  removeSongFromQueue: (queueIndex: number) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  navigateToSong: (queueIndex: number) => void;
  currentSong: QueueItem | null;
  // Metronome (Phase 4)
  broadcastBeat: (beatNumber: number) => void;
  updateMetronomeState: (state: LiveSession['metronome']) => void;
  // Live edit propagation (Phase 4)
  broadcastSongUpdate: (song: Song, attachments: Attachment[]) => void;
}

export function useHostSession(): UseHostSessionReturn {
  const [session, setSession] = useState<LiveSession | null>(null);
  const [peers, setPeers] = useState<PeerInfo[]>([]);

  const managerRef = useRef<HostConnectionManager | null>(null);
  const senderRef = useRef<AssetTransferSender | null>(null);
  const unsubSignalingRef = useRef<(() => void) | null>(null);
  const roomCodeRef = useRef<string | null>(null);
  const peerStageRef = useRef(new Map<string, 'offer-sent' | 'answer-received'>());
  const destroyedRef = useRef(false);

  // Keep a ref copy of session for use in callbacks that shouldn't re-create on session change
  const sessionRef = useRef<LiveSession | null>(null);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // Store assets map ref for binary transfer when peers request assets
  const assetsMapRef = useRef<Map<string, Asset>>(new Map());

  const updatePeerInfo = useCallback(
    (peerId: string, update: Partial<PeerInfo>) => {
      setPeers((prev) => {
        const idx = prev.findIndex((p) => p.peerId === peerId);
        if (idx === -1) {
          const newPeer: PeerInfo = {
            peerId,
            displayName: '',
            status: 'connecting',
            downloadProgress: { currentWindow: 0, totalWindow: 0 },
            ...update,
          };
          return [...prev, newPeer];
        }
        const updated = [...prev];
        updated[idx] = { ...updated[idx], ...update };
        return updated;
      });
    },
    []
  );

  const removePeer = useCallback((peerId: string) => {
    setPeers((prev) => prev.filter((p) => p.peerId !== peerId));
  }, []);

  // Send current session state to a specific peer (used on join and reconnect)
  const sendSessionState = useCallback((peerId: string) => {
    const manager = managerRef.current;
    const s = sessionRef.current;
    if (!manager || !s) return;

    const msg: HostMessage = {
      type: 'session-state',
      queue: s.queue,
      currentIndex: s.currentIndex,
      metronome: s.metronome,
      settings: s.settings,
    };
    manager.sendToPeer(peerId, JSON.stringify(msg));
  }, []);

  // Fetch binary data for an asset and send it to a peer
  const sendAssetToPeer = useCallback(
    async (peerId: string, songId: string, asset: Asset) => {
      const sender = senderRef.current;
      if (!sender) return;

      try {
        let data: ArrayBuffer;

        if (asset.storageUrl) {
          // Binary asset — fetch from storage URL
          const response = await fetch(asset.storageUrl);
          data = await response.arrayBuffer();
        } else if (asset.content || asset.drawingData) {
          // Inline content — serialize to JSON
          const json = JSON.stringify(asset.content || asset.drawingData);
          data = new TextEncoder().encode(json).buffer as ArrayBuffer;
        } else {
          return; // No data to transfer
        }

        await sender.sendAsset(peerId, songId, asset.id, data);
      } catch {
        // Transfer failed — peer can re-request
      }
    },
    []
  );

  // Send asset manifests for songs in the prefetch window to a specific peer
  const sendAssetManifests = useCallback(
    (peerId: string, queue: QueueItem[], currentIndex: number | null, prefetchWindow: number) => {
      const manager = managerRef.current;
      if (!manager) return;

      const startIdx = currentIndex ?? 0;
      const endIdx = Math.min(startIdx + prefetchWindow, queue.length);

      for (let i = startIdx; i < endIdx; i++) {
        const item = queue[i];
        const manifests: AssetManifest[] = [];

        for (const att of item.attachments) {
          if (att.assetId) {
            const asset = assetsMapRef.current.get(att.assetId);
            if (asset) {
              manifests.push({
                id: asset.id,
                name: asset.name,
                type: asset.type,
                size: asset.size ?? 0,
                checksum: '', // computed at transfer time
              });
            }
          }
        }

        if (manifests.length > 0) {
          const msg: HostMessage = {
            type: 'asset-manifest',
            songId: item.songId,
            assets: manifests,
          };
          manager.sendToPeer(peerId, JSON.stringify(msg));
        }
      }
    },
    []
  );

  const startSession = useCallback(
    async (settings?: Partial<SessionSettings>): Promise<string> => {
      if (managerRef.current) {
        throw new Error('Session already active');
      }

      destroyedRef.current = false;
      const code = generateRoomCode();
      roomCodeRef.current = code;

      const mergedSettings: SessionSettings = {
        ...DEFAULT_SESSION_SETTINGS,
        ...settings,
      };

      const manager = new HostConnectionManager();
      managerRef.current = manager;

      // Set up asset transfer sender
      const sender = new AssetTransferSender(
        (peerId, header, payload) => {
          manager.sendBinaryToPeer(peerId, header, payload);
        }
      );
      senderRef.current = sender;

      // Handle incoming messages from peers
      manager.onMessage = (peerId, message) => {
        try {
          const parsed: MemberMessage = JSON.parse(message);

          if (parsed.type === 'join') {
            updatePeerInfo(peerId, {
              displayName: parsed.displayName,
              status: 'connected',
            });
            // Send current session state to newly joined peer
            sendSessionState(peerId);
            // Send asset manifests for prefetch window
            const s = sessionRef.current;
            if (s && s.queue.length > 0) {
              sendAssetManifests(peerId, s.queue, s.currentIndex, s.settings.prefetchWindow);
            }
          }

          if (parsed.type === 'asset-request') {
            const asset = assetsMapRef.current.get(parsed.assetId);
            if (asset) {
              sendAssetToPeer(peerId, parsed.songId, asset);
            }
          }

          if (parsed.type === 'asset-received') {
            // Could track download progress here
          }

          if (parsed.type === 'clock-sync-request') {
            const t2 = performance.now();
            const response: HostMessage = {
              type: 'clock-sync-response',
              t1: parsed.t1,
              t2,
              t3: performance.now(),
            };
            manager.sendToPeer(peerId, JSON.stringify(response));
          }
        } catch {
          // Non-JSON message — ignore
        }
      };

      // Forward host ICE candidates to peer's signaling doc
      manager.onIceCandidate = (peerId, candidate) => {
        if (destroyedRef.current) return;
        const peerDocRef = doc(db, 'sessions', code, 'peers', peerId);
        updateDoc(peerDocRef, {
          hostIceCandidates: arrayUnion(
            JSON.parse(JSON.stringify(candidate))
          ),
        }).catch(() => {});
      };

      manager.onPeerStatusChange = (peerId, status: PeerStatus) => {
        updatePeerInfo(peerId, { status });
        if (status === 'disconnected') {
          sender.cancelAllForPeer(peerId);
          setTimeout(() => {
            if (destroyedRef.current) return;
            removePeer(peerId);
            manager.disconnectPeer(peerId);
          }, 5000);
        }
      };

      // Create signaling room in Firestore
      await createSignalingRoom(code, {
        type: 'offer',
        sdp: '',
      } as RTCSessionDescriptionInit);

      // Listen for peers joining via Firestore signaling
      const peerStage = peerStageRef.current;
      peerStage.clear();

      unsubSignalingRef.current = onPeerJoined(code, async (peerSignaling) => {
        if (destroyedRef.current) return;
        const { peerId } = peerSignaling;
        const stage = peerStage.get(peerId);

        // Stage 1: New peer requesting connection
        if (!stage && (!peerSignaling.answer || !peerSignaling.answer.sdp)) {
          peerStage.set(peerId, 'offer-sent');
          updatePeerInfo(peerId, { status: 'connecting' });

          try {
            const offer = await manager.createOfferForPeer(peerId);
            const peerDocRef = doc(db, 'sessions', code, 'peers', peerId);
            await updateDoc(peerDocRef, {
              offer: JSON.parse(JSON.stringify(offer)),
            });
          } catch {
            peerStage.delete(peerId);
          }
          return;
        }

        // Stage 2: Peer sent answer back
        if (stage === 'offer-sent' && peerSignaling.answer?.sdp) {
          peerStage.set(peerId, 'answer-received');

          try {
            await manager.handlePeerAnswer(peerId, peerSignaling.answer);
            for (const candidate of peerSignaling.iceCandidates) {
              manager.addIceCandidate(peerId, candidate);
            }
          } catch {
            // Handshake failed — peer will timeout
          }
          return;
        }

        // Stage 3: Post-handshake ICE trickle
        if (stage === 'answer-received') {
          for (const candidate of peerSignaling.iceCandidates) {
            manager.addIceCandidate(peerId, candidate);
          }
        }
      });

      // Set session state
      const newSession: LiveSession = {
        roomCode: code,
        queue: [],
        currentIndex: null,
        metronome: DEFAULT_METRO,
        settings: mergedSettings,
        peers: new Map(),
        createdAt: new Date().toISOString(),
      };
      setSession(newSession);

      return code;
    },
    [updatePeerInfo, removePeer, sendSessionState, sendAssetManifests, sendAssetToPeer]
  );

  // --- Queue Operations ---

  const addSongsToQueue = useCallback(
    (
      songs: Song[],
      attachmentsMap: Map<string, Attachment[]>,
      newAssetsMap: Map<string, Asset>
    ) => {
      // Update assets ref with any new assets
      for (const [id, asset] of newAssetsMap) {
        assetsMapRef.current.set(id, asset);
      }

      setSession((prev) => {
        if (!prev) return prev;

        const startIndex = prev.queue.length;
        const newItems: QueueItem[] = songs.map((song, i) => ({
          queueIndex: startIndex + i,
          songId: song.id,
          song,
          attachments: attachmentsMap.get(song.id) ?? [],
        }));

        const updatedQueue = [...prev.queue, ...newItems];
        const updatedSession = {
          ...prev,
          queue: updatedQueue,
          // Auto-navigate to first song if queue was empty
          currentIndex: prev.currentIndex ?? (updatedQueue.length > 0 ? 0 : null),
        };

        // Send queue update to all peers
        const manager = managerRef.current;
        if (manager) {
          const msg: HostMessage = {
            type: 'queue-update',
            queue: updatedQueue,
          };
          manager.sendToAll(JSON.stringify(msg));

          // Send asset manifests for new songs to all connected peers
          const peerIds = manager.getPeerIds();
          for (const peerId of peerIds) {
            if (manager.getPeerStatus(peerId) === 'connected') {
              sendAssetManifests(
                peerId,
                updatedQueue,
                updatedSession.currentIndex,
                prev.settings.prefetchWindow
              );
            }
          }
        }

        return updatedSession;
      });
    },
    [sendAssetManifests]
  );

  const removeSongFromQueue = useCallback((queueIndex: number) => {
    setSession((prev) => {
      if (!prev) return prev;
      if (queueIndex < 0 || queueIndex >= prev.queue.length) return prev;

      const updatedQueue = prev.queue
        .filter((_, i) => i !== queueIndex)
        .map((item, i) => ({ ...item, queueIndex: i }));

      // Adjust currentIndex
      let newCurrentIndex = prev.currentIndex;
      if (newCurrentIndex !== null) {
        if (queueIndex < newCurrentIndex) {
          newCurrentIndex--;
        } else if (queueIndex === newCurrentIndex) {
          // Current song removed — stay at same index or go to end
          if (newCurrentIndex >= updatedQueue.length) {
            newCurrentIndex = updatedQueue.length > 0 ? updatedQueue.length - 1 : null;
          }
        }
      }

      // Send update to peers
      const manager = managerRef.current;
      if (manager) {
        const msg: HostMessage = { type: 'queue-update', queue: updatedQueue };
        manager.sendToAll(JSON.stringify(msg));
        if (newCurrentIndex !== prev.currentIndex) {
          const navMsg: HostMessage = { type: 'song-change', index: newCurrentIndex ?? 0 };
          manager.sendToAll(JSON.stringify(navMsg));
        }
      }

      return { ...prev, queue: updatedQueue, currentIndex: newCurrentIndex };
    });
  }, []);

  const reorderQueue = useCallback((fromIndex: number, toIndex: number) => {
    setSession((prev) => {
      if (!prev) return prev;
      if (fromIndex === toIndex) return prev;

      const updatedQueue = [...prev.queue];
      const [moved] = updatedQueue.splice(fromIndex, 1);
      updatedQueue.splice(toIndex, 0, moved);
      // Re-index
      const reindexed = updatedQueue.map((item, i) => ({ ...item, queueIndex: i }));

      // Adjust currentIndex to follow the current song
      let newCurrentIndex = prev.currentIndex;
      if (newCurrentIndex !== null) {
        if (newCurrentIndex === fromIndex) {
          newCurrentIndex = toIndex;
        } else if (fromIndex < newCurrentIndex && toIndex >= newCurrentIndex) {
          newCurrentIndex--;
        } else if (fromIndex > newCurrentIndex && toIndex <= newCurrentIndex) {
          newCurrentIndex++;
        }
      }

      const manager = managerRef.current;
      if (manager) {
        const msg: HostMessage = { type: 'queue-update', queue: reindexed };
        manager.sendToAll(JSON.stringify(msg));
      }

      return { ...prev, queue: reindexed, currentIndex: newCurrentIndex };
    });
  }, []);

  const navigateToSong = useCallback((queueIndex: number) => {
    setSession((prev) => {
      if (!prev) return prev;
      if (queueIndex < 0 || queueIndex >= prev.queue.length) return prev;

      // Send song-change immediately (never debounced)
      const manager = managerRef.current;
      if (manager) {
        const msg: HostMessage = { type: 'song-change', index: queueIndex };
        manager.sendToAll(JSON.stringify(msg));

        // Send asset manifests for the new prefetch window
        const peerIds = manager.getPeerIds();
        for (const peerId of peerIds) {
          if (manager.getPeerStatus(peerId) === 'connected') {
            sendAssetManifests(
              peerId,
              prev.queue,
              queueIndex,
              prev.settings.prefetchWindow
            );
          }
        }
      }

      return { ...prev, currentIndex: queueIndex };
    });
  }, [sendAssetManifests]);

  const currentSong = session?.currentIndex !== null && session?.currentIndex !== undefined
    ? session.queue[session.currentIndex] ?? null
    : null;

  // --- Metronome sync (Phase 4) ---

  const broadcastBeat = useCallback((beatNumber: number) => {
    const manager = managerRef.current;
    if (!manager) return;
    const msg: HostMessage = {
      type: 'beat',
      networkTime: performance.now(),
      beatNumber,
    };
    manager.sendToAll(JSON.stringify(msg));
  }, []);

  const updateMetronomeState = useCallback((metronome: LiveSession['metronome']) => {
    setSession((prev) => {
      if (!prev) return prev;
      return { ...prev, metronome };
    });

    const manager = managerRef.current;
    if (!manager) return;
    const msg: HostMessage = { type: 'metronome-update', metronome };
    manager.sendToAll(JSON.stringify(msg));
  }, []);

  const broadcastSongUpdate = useCallback((song: Song, attachments: Attachment[]) => {
    const manager = managerRef.current;
    if (!manager) return;

    // Update the song in the queue locally
    setSession((prev) => {
      if (!prev) return prev;
      const updatedQueue = prev.queue.map((item) => {
        if (item.songId === song.id) {
          return { ...item, song, attachments };
        }
        return item;
      });
      return { ...prev, queue: updatedQueue };
    });

    // Broadcast to all members
    const msg: HostMessage = { type: 'song-update', song, attachments };
    manager.sendToAll(JSON.stringify(msg));
  }, []);

  const endSession = useCallback(async () => {
    destroyedRef.current = true;
    const manager = managerRef.current;
    const sender = senderRef.current;
    const code = roomCodeRef.current;

    if (manager) {
      const endMsg: HostMessage = { type: 'session-end' };
      manager.sendToAll(JSON.stringify(endMsg));
      await new Promise((resolve) => setTimeout(resolve, 100));
      manager.destroy();
      managerRef.current = null;
    }

    if (sender) {
      sender.destroy();
      senderRef.current = null;
    }

    if (unsubSignalingRef.current) {
      unsubSignalingRef.current();
      unsubSignalingRef.current = null;
    }

    if (code) {
      await deleteSignalingRoom(code).catch(() => {});
      roomCodeRef.current = null;
    }

    peerStageRef.current.clear();
    assetsMapRef.current.clear();
    setSession(null);
    setPeers([]);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (managerRef.current) {
        managerRef.current.destroy();
        managerRef.current = null;
      }
      if (senderRef.current) {
        senderRef.current.destroy();
        senderRef.current = null;
      }
      if (unsubSignalingRef.current) {
        unsubSignalingRef.current();
        unsubSignalingRef.current = null;
      }
      if (roomCodeRef.current) {
        deleteSignalingRoom(roomCodeRef.current).catch(() => {});
      }
      destroyedRef.current = true;
    };
  }, []);

  return {
    session,
    startSession,
    endSession,
    peers,
    isActive: session !== null,
    addSongsToQueue,
    removeSongFromQueue,
    reorderQueue,
    navigateToSong,
    currentSong,
    broadcastBeat,
    updateMetronomeState,
    broadcastSongUpdate,
  };
}
