'use client';

import {
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  updateDoc,
  collection,
  getDocs,
  onSnapshot,
  arrayUnion,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { generateId } from '../utils';

// --- Types ---

export interface SignalingRoom {
  hostId: string;
  createdAt: string;
  expiresAt: string;
  offer: RTCSessionDescriptionInit | null;
  iceCandidates: RTCIceCandidateInit[];
}

export interface PeerSignaling {
  peerId: string;
  answer: RTCSessionDescriptionInit;
  iceCandidates: RTCIceCandidateInit[];
}

// --- Constants ---

const SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

// --- Operations ---

export async function createSignalingRoom(
  roomCode: string,
  offer: RTCSessionDescriptionInit
): Promise<string> {
  const hostId = generateId();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

  await setDoc(doc(db, 'sessions', roomCode), {
    hostId,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    offer: JSON.parse(JSON.stringify(offer)), // strip non-serializable fields
    iceCandidates: [],
    _serverCreatedAt: serverTimestamp(),
  });

  return hostId;
}

export async function updateSignalingRoomOffer(
  roomCode: string,
  offer: RTCSessionDescriptionInit
): Promise<void> {
  await updateDoc(doc(db, 'sessions', roomCode), {
    offer: JSON.parse(JSON.stringify(offer)),
    iceCandidates: [],
  });
}

export async function addHostIceCandidate(
  roomCode: string,
  candidate: RTCIceCandidateInit
): Promise<void> {
  await updateDoc(doc(db, 'sessions', roomCode), {
    iceCandidates: arrayUnion(JSON.parse(JSON.stringify(candidate))),
  });
}

export async function getSignalingRoom(
  roomCode: string
): Promise<SignalingRoom | null> {
  const snap = await getDoc(doc(db, 'sessions', roomCode));
  if (!snap.exists()) return null;

  const data = snap.data();

  // Check expiry
  if (data.expiresAt && new Date(data.expiresAt).getTime() < Date.now()) {
    // Stale room — clean up silently
    await deleteSignalingRoom(roomCode).catch(() => {});
    return null;
  }

  return {
    hostId: data.hostId,
    createdAt: data.createdAt,
    expiresAt: data.expiresAt,
    offer: data.offer ?? null,
    iceCandidates: data.iceCandidates ?? [],
  };
}

/**
 * Create an initial peer signaling doc (empty answer).
 * This is the first write when a peer requests to join — host sees it and creates an offer.
 */
export async function createPeerRequest(
  roomCode: string,
  peerId: string
): Promise<void> {
  await setDoc(doc(db, 'sessions', roomCode, 'peers', peerId), {
    peerId,
    answer: { type: 'answer', sdp: '' },
    iceCandidates: [],
  });
}

/**
 * Update the peer doc with the real answer (merge to preserve host-written fields like offer/hostIceCandidates).
 */
export async function updatePeerAnswer(
  roomCode: string,
  peerId: string,
  answer: RTCSessionDescriptionInit
): Promise<void> {
  await updateDoc(doc(db, 'sessions', roomCode, 'peers', peerId), {
    answer: JSON.parse(JSON.stringify(answer)),
  });
}

export async function addPeerIceCandidate(
  roomCode: string,
  peerId: string,
  candidate: RTCIceCandidateInit
): Promise<void> {
  await updateDoc(doc(db, 'sessions', roomCode, 'peers', peerId), {
    iceCandidates: arrayUnion(JSON.parse(JSON.stringify(candidate))),
  });
}

/**
 * Listen for new peers joining the signaling room.
 * Returns an unsubscribe function.
 */
export function onPeerJoined(
  roomCode: string,
  callback: (peer: PeerSignaling) => void
): () => void {
  const seenPeers = new Set<string>();
  const peersRef = collection(db, 'sessions', roomCode, 'peers');

  return onSnapshot(peersRef, (snapshot) => {
    for (const change of snapshot.docChanges()) {
      if (change.type === 'added' || change.type === 'modified') {
        const data = change.doc.data();
        const peerId = data.peerId as string;
        // Only fire callback for newly seen peers or ICE candidate updates
        if (!seenPeers.has(peerId) || change.type === 'modified') {
          seenPeers.add(peerId);
          callback({
            peerId,
            answer: data.answer,
            iceCandidates: data.iceCandidates ?? [],
          });
        }
      }
    }
  });
}

/**
 * Delete the signaling room and all peer documents.
 */
export async function deleteSignalingRoom(roomCode: string): Promise<void> {
  // Delete all peer docs first
  const peersRef = collection(db, 'sessions', roomCode, 'peers');
  const peersSnap = await getDocs(peersRef);
  const deletePromises = peersSnap.docs.map((peerDoc) =>
    deleteDoc(peerDoc.ref)
  );
  await Promise.all(deletePromises);

  // Delete session doc
  await deleteDoc(doc(db, 'sessions', roomCode));
}
