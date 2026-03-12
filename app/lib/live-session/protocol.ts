import type { Song, Attachment } from '../../types';

// --- Session Queue ---

export interface QueueItem {
  queueIndex: number; // position in queue (0-based)
  songId: string;
  song: Song;
  attachments: Attachment[];
}

// --- Metronome State ---

export interface MetronomeState {
  bpm: number;
  timeSignature: [number, number];
  isPlaying: boolean;
  networkTimeAtLastBeat: number;
  beatNumber: number;
}

// --- Session Settings ---

export interface SessionSettings {
  sessionName: string;
  metronomeEnabled: boolean;
  waitForSync: boolean;
  allowLateJoin: boolean;
  prefetchWindow: number; // default: 3
}

// --- Asset Manifest ---

export interface AssetManifest {
  id: string;
  name: string;
  type: string;
  size: number;
  checksum: string;
}

// --- Host → Member Messages ---

export type HostMessage =
  | {
      type: 'session-state';
      queue: QueueItem[];
      currentIndex: number | null;
      metronome: MetronomeState;
      settings: SessionSettings;
    }
  | { type: 'song-change'; index: number }
  | { type: 'queue-update'; queue: QueueItem[] }
  | { type: 'song-update'; song: Song; attachments: Attachment[] }
  | { type: 'metronome-update'; metronome: MetronomeState }
  | { type: 'beat'; networkTime: number; beatNumber: number }
  | { type: 'clock-sync-response'; t1: number; t2: number; t3: number }
  | { type: 'asset-manifest'; songId: string; assets: AssetManifest[] }
  | { type: 'session-end' };

// --- Member → Host Messages ---

export type MemberMessage =
  | { type: 'join'; displayName: string }
  | { type: 'clock-sync-request'; t1: number }
  | { type: 'asset-request'; songId: string; assetId: string }
  | { type: 'asset-received'; songId: string; assetId: string };

// --- Peer Info (host tracks per-member) ---

export type PeerStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'reconnecting';

export interface PeerInfo {
  peerId: string;
  displayName: string;
  status: PeerStatus;
  downloadProgress: { currentWindow: number; totalWindow: number };
}

// --- Session State (host) ---

export interface LiveSession {
  roomCode: string;
  queue: QueueItem[];
  currentIndex: number | null;
  metronome: MetronomeState;
  settings: SessionSettings;
  peers: Map<string, PeerInfo>;
  createdAt: string;
}

// --- Joined Session (member) ---

export interface JoinedSession {
  roomCode: string;
  queue: QueueItem[];
  currentIndex: number | null;
  metronome: MetronomeState;
  connectionStatus: PeerStatus;
}

// --- Binary Transfer Header ---

export interface TransferHeader {
  songId: string;
  assetId: string;
  chunkIndex: number;
  totalChunks: number;
  checksum: string;
}

// --- Default values ---

export const DEFAULT_SESSION_SETTINGS: SessionSettings = {
  sessionName: 'Live Session',
  metronomeEnabled: true,
  waitForSync: false,
  allowLateJoin: true,
  prefetchWindow: 3,
};

export const DEFAULT_METRONOME_STATE: MetronomeState = {
  bpm: 120,
  timeSignature: [4, 4],
  isPlaying: false,
  networkTimeAtLastBeat: 0,
  beatNumber: 0,
};
