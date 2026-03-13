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
import { ref, getBytes } from 'firebase/storage';
import { firebaseStorage } from '../lib/firebase';
import type { Song, Attachment, Asset } from '../types';

/** Serializable snapshot saved to sessionStorage for host restore on reload */
interface HostSessionSnapshot {
  roomCode: string;
  queue: QueueItem[];
  currentIndex: number | null;
  settings: SessionSettings;
  metronome: LiveSession['metronome'];
  storagePaths: Record<string, string>; // assetId → storagePath
  savedAt: number; // Date.now() timestamp
}

const HOST_SESSION_KEY = 'metronotes_host_session';
const SNAPSHOT_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

function saveHostSnapshot(session: LiveSession, storagePaths: Map<string, string>) {
  if (typeof window === 'undefined') return;
  const snapshot: HostSessionSnapshot = {
    roomCode: session.roomCode,
    queue: session.queue,
    currentIndex: session.currentIndex,
    settings: session.settings,
    metronome: session.metronome,
    storagePaths: Object.fromEntries(storagePaths),
    savedAt: Date.now(),
  };
  try {
    sessionStorage.setItem(HOST_SESSION_KEY, JSON.stringify(snapshot));
  } catch { /* quota exceeded — non-critical */ }
}

function loadHostSnapshot(): HostSessionSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(HOST_SESSION_KEY);
    if (!raw) return null;
    const snapshot = JSON.parse(raw) as HostSessionSnapshot;
    // Check TTL — discard stale snapshots
    if (snapshot.savedAt && Date.now() - snapshot.savedAt > SNAPSHOT_TTL_MS) {
      sessionStorage.removeItem(HOST_SESSION_KEY);
      return null;
    }
    return snapshot;
  } catch {
    return null;
  }
}

function clearHostSnapshot() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(HOST_SESSION_KEY);
}

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
  broadcastSongUpdate: (song: Song, attachments: Attachment[], newAssetsMap?: Map<string, Asset>) => void;
  // Cloud blob cache for GDrive etc.
  registerCloudBlob: (assetId: string, data: ArrayBuffer) => void;
  // Session persistence (Phase 5)
  pendingRestore: { roomCode: string; sessionName: string } | null;
  restoreSession: () => Promise<string>;
  clearPendingRestore: () => void;
}

export function useHostSession(): UseHostSessionReturn {
  const [session, setSession] = useState<LiveSession | null>(null);
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [pendingRestore, setPendingRestore] = useState<{ roomCode: string; sessionName: string } | null>(() => {
    const snapshot = loadHostSnapshot();
    if (!snapshot) return null;
    return { roomCode: snapshot.roomCode, sessionName: snapshot.settings.sessionName };
  });

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
    // Persist to sessionStorage for restore on reload
    if (session) {
      saveHostSnapshot(session, storagePathsRef.current);
    }
  }, [session]);

  // Store assets map ref for binary transfer when peers request assets
  const assetsMapRef = useRef<Map<string, Asset>>(new Map());
  // Map assetId → storagePath for Firebase Storage SDK downloads
  const storagePathsRef = useRef<Map<string, string>>(new Map());
  // Cache for cloud-downloaded blobs (GDrive etc.) — assetId → ArrayBuffer
  const blobCacheRef = useRef<Map<string, ArrayBuffer>>(new Map());

  const registerCloudBlob = useCallback((assetId: string, data: ArrayBuffer) => {
    blobCacheRef.current.set(assetId, data);
  }, []);

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

  // Enrich queue items with asset manifests from assetsMapRef
  const enrichQueueWithManifests = useCallback((queue: QueueItem[]): QueueItem[] => {
    return queue.map((item) => {
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
              checksum: '',
            });
          }
        }
      }
      return manifests.length > 0 ? { ...item, assets: manifests } : item;
    });
  }, []);

  // Send current session state to a specific peer (used on join and reconnect)
  const sendSessionState = useCallback((peerId: string) => {
    const manager = managerRef.current;
    const s = sessionRef.current;
    if (!manager || !s) return;

    const msg: HostMessage = {
      type: 'session-state',
      queue: enrichQueueWithManifests(s.queue),
      currentIndex: s.currentIndex,
      metronome: s.metronome,
      settings: s.settings,
    };
    manager.sendToPeer(peerId, JSON.stringify(msg));
  }, [enrichQueueWithManifests]);

  // Fetch binary data for an asset and send it to a peer
  const sendAssetToPeer = useCallback(
    async (peerId: string, songId: string, asset: Asset) => {
      const sender = senderRef.current;
      if (!sender) {
        console.warn(`[host] sendAssetToPeer: no sender`);
        return;
      }

      try {
        let data: ArrayBuffer | undefined;

        // Inline assets (richtext, drawing) — serialize from memory
        if (asset.content || asset.drawingData) {
          const json = JSON.stringify(asset.content || asset.drawingData);
          data = new TextEncoder().encode(json).buffer as ArrayBuffer;
        } else if (['richtext', 'drawing'].includes(asset.type)) {
          // Fallback: inline asset without content on the Asset object — check queue attachments
          const session = sessionRef.current;
          if (session) {
            const queueItem = session.queue.find(q => q.songId === songId);
            const att = queueItem?.attachments.find(a => a.assetId === asset.id);
            if (att?.content || att?.drawingData) {
              const json = JSON.stringify(att.content || att.drawingData);
              data = new TextEncoder().encode(json).buffer as ArrayBuffer;
            }
          }
          if (!data) {
            console.warn(`[host] Inline asset ${asset.id} (${asset.type}) has no content`);
            return;
          }
        } else {
          // Check cloud blob cache first (GDrive downloads)
          const cached = blobCacheRef.current.get(asset.id);
          if (cached) {
            data = cached;
          } else {
            // Binary assets (image, pdf, audio) — download via Firebase SDK
            const storagePath = storagePathsRef.current.get(asset.id);
            if (!storagePath) {
              console.warn(`[host] Asset ${asset.id} has no storagePath, type=${asset.type}`);
              return;
            }
            const storageRef = ref(firebaseStorage, storagePath);
            data = await getBytes(storageRef);
          }
        }

        await sender.sendAsset(peerId, songId, asset.id, data);
      } catch (err) {
        console.error(`[host] sendAssetToPeer failed:`, err);
      }
    },
    []
  );

  const startSession = useCallback(
    async (settings?: Partial<SessionSettings>, existingRoomCode?: string): Promise<string> => {
      if (managerRef.current) {
        throw new Error('Session already active');
      }

      destroyedRef.current = false;
      const code = existingRoomCode || generateRoomCode();
      roomCodeRef.current = code;

      const mergedSettings: SessionSettings = {
        ...DEFAULT_SESSION_SETTINGS,
        ...settings,
      };

      const manager = new HostConnectionManager();
      managerRef.current = manager;

      // Set up asset transfer sender with backpressure
      const sender = new AssetTransferSender(
        (peerId, header, payload) => {
          manager.sendBinaryToPeer(peerId, header, payload);
        },
        (peerId) => manager.getBinaryBufferedAmount(peerId),
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
            // Send current session state (includes asset manifests in queue items)
            sendSessionState(peerId);
          }

          if (parsed.type === 'asset-request') {
            const asset = assetsMapRef.current.get(parsed.assetId);
            if (asset) {
              sendAssetToPeer(peerId, parsed.songId, asset);
            } else {
              console.warn(`[host] asset-request for unknown asset ${parsed.assetId} (song ${parsed.songId})`);
            }
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
    [updatePeerInfo, removePeer, sendSessionState, sendAssetToPeer]
  );

  // --- Queue Operations ---

  const addSongsToQueue = useCallback(
    (
      songs: Song[],
      attachmentsMap: Map<string, Attachment[]>,
      newAssetsMap: Map<string, Asset>
    ) => {
      // Update assets ref — for inline types (richtext/drawing), ensure content is populated
      // from the attachment data if not already on the Asset object
      for (const [id, asset] of newAssetsMap) {
        let enriched = asset;
        if ((asset.type === 'richtext' && !asset.content) || (asset.type === 'drawing' && !asset.drawingData)) {
          for (const [, atts] of attachmentsMap) {
            const att = atts.find(a => a.assetId === id);
            if (att) {
              if (asset.type === 'richtext' && att.content) {
                enriched = { ...asset, content: att.content };
              } else if (asset.type === 'drawing' && att.drawingData) {
                enriched = { ...asset, drawingData: att.drawingData };
              }
              break;
            }
          }
        }
        assetsMapRef.current.set(id, enriched);
        if (enriched.storagePath) {
          storagePathsRef.current.set(id, enriched.storagePath);
        }
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

        // Send queue update to all peers (with manifests embedded)
        const manager = managerRef.current;
        if (manager) {
          const msg: HostMessage = {
            type: 'queue-update',
            queue: enrichQueueWithManifests(updatedQueue),
          };
          manager.sendToAll(JSON.stringify(msg));
        }

        return updatedSession;
      });
    },
    [enrichQueueWithManifests]
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
        if (newCurrentIndex !== prev.currentIndex) {
          const navMsg: HostMessage = { type: 'song-change', index: newCurrentIndex ?? 0 };
          manager.sendToAll(JSON.stringify(navMsg));
        }
      }

      return { ...prev, queue: reindexed, currentIndex: newCurrentIndex };
    });
  }, []);

  const navigateToSong = useCallback((queueIndex: number) => {
    setSession((prev) => {
      if (!prev) return prev;
      if (queueIndex < 0 || queueIndex >= prev.queue.length) return prev;

      const manager = managerRef.current;
      if (manager) {
        const msg: HostMessage = { type: 'song-change', index: queueIndex };
        manager.sendToAll(JSON.stringify(msg));
      }

      return { ...prev, currentIndex: queueIndex };
    });
  }, []);

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

  const broadcastSongUpdate = useCallback((song: Song, attachments: Attachment[], newAssetsMap?: Map<string, Asset>) => {
    const manager = managerRef.current;
    if (!manager) return;

    // Update assets ref — enrich inline types with content from attachments if needed
    if (newAssetsMap) {
      for (const [id, asset] of newAssetsMap) {
        let enriched = asset;
        if ((asset.type === 'richtext' && !asset.content) || (asset.type === 'drawing' && !asset.drawingData)) {
          const att = attachments.find(a => a.assetId === id);
          if (att) {
            if (asset.type === 'richtext' && att.content) {
              enriched = { ...asset, content: att.content };
            } else if (asset.type === 'drawing' && att.drawingData) {
              enriched = { ...asset, drawingData: att.drawingData };
            }
          }
        }
        assetsMapRef.current.set(id, enriched);
        if (enriched.storagePath) {
          storagePathsRef.current.set(id, enriched.storagePath);
        }
      }
    }

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

    // Build manifests for all assets
    const manifests: AssetManifest[] = [];
    for (const att of attachments) {
      if (att.assetId) {
        const asset = assetsMapRef.current.get(att.assetId);
        if (asset) {
          manifests.push({ id: asset.id, name: asset.name, type: asset.type, size: asset.size ?? 0, checksum: '' });
        }
      }
    }

    // Broadcast song data + manifests to all members
    const msg: HostMessage = { type: 'song-update', song, attachments, assets: manifests.length > 0 ? manifests : undefined };
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
    storagePathsRef.current.clear();
    blobCacheRef.current.clear();
    clearHostSnapshot();
    setSession(null);
    setPeers([]);
  }, []);

  // Restore a session from sessionStorage snapshot
  const restoreSession = useCallback(async (): Promise<string> => {
    const snapshot = loadHostSnapshot();
    if (!snapshot) throw new Error('No session to restore');

    setPendingRestore(null);

    // Clean up old Firestore room before recreating (it may have stale peer docs)
    await deleteSignalingRoom(snapshot.roomCode).catch(() => {});

    // Rebuild assetsMapRef from queue attachments (content/drawingData are on attachments)
    for (const item of snapshot.queue) {
      for (const att of item.attachments) {
        if (att.assetId) {
          assetsMapRef.current.set(att.assetId, {
            id: att.assetId,
            name: att.name || `${att.type} asset`,
            type: att.type as Asset['type'],
            mimeType: null,
            size: null,
            storageUrl: null,
            storagePath: snapshot.storagePaths[att.assetId] ?? null,
            content: att.content,
            drawingData: att.drawingData,
            createdAt: '',
            updatedAt: '',
          });
        }
      }
    }

    // Rebuild storagePathsRef from snapshot
    for (const [assetId, path] of Object.entries(snapshot.storagePaths)) {
      storagePathsRef.current.set(assetId, path);
    }

    // Reuse the SAME room code so members can rejoin
    const code = await startSession(snapshot.settings, snapshot.roomCode);

    // Seed with snapshot queue/index/metronome
    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        queue: snapshot.queue,
        currentIndex: snapshot.currentIndex,
        metronome: snapshot.metronome,
      };
    });

    return code;
  }, [startSession]);

  const clearPendingRestore = useCallback(() => {
    // Clean up stale Firestore room when user dismisses restore
    const snapshot = loadHostSnapshot();
    if (snapshot?.roomCode) {
      deleteSignalingRoom(snapshot.roomCode).catch(() => {});
    }
    clearHostSnapshot();
    setPendingRestore(null);
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
    registerCloudBlob,
    pendingRestore,
    restoreSession,
    clearPendingRestore,
  };
}
