/**
 * WebRTC connection managers for live session host and peer.
 *
 * Host maintains a star topology — one RTCPeerConnection per member.
 * Each connection has two data channels:
 *   - "control" (ordered, reliable) for JSON messages
 *   - "binary" (unordered, maxRetransmits: 3) for chunked asset transfer
 */

import type { PeerStatus } from './protocol';

// --- ICE Configuration ---

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

const RTC_CONFIG: RTCConfiguration = { iceServers: ICE_SERVERS };

// --- Reconnect Constants ---

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000]; // exponential backoff
const DISCONNECT_TIMEOUT_MS = 60_000;

// --- Binary Message Framing ---
// Binary messages are sent as: 4-byte header length (uint32 BE) + header JSON + payload

export function frameBinaryMessage(
  header: object,
  payload: ArrayBuffer
): ArrayBuffer {
  const headerJson = JSON.stringify(header);
  const headerBytes = new TextEncoder().encode(headerJson);
  const frame = new ArrayBuffer(4 + headerBytes.length + payload.byteLength);
  const view = new DataView(frame);
  view.setUint32(0, headerBytes.length, false); // big-endian
  new Uint8Array(frame, 4, headerBytes.length).set(headerBytes);
  new Uint8Array(frame, 4 + headerBytes.length).set(
    new Uint8Array(payload)
  );
  return frame;
}

export function parseBinaryMessage(
  data: ArrayBuffer
): { header: object; payload: ArrayBuffer } {
  const view = new DataView(data);
  const headerLen = view.getUint32(0, false);
  const headerBytes = new Uint8Array(data, 4, headerLen);
  const headerJson = new TextDecoder().decode(headerBytes);
  const header = JSON.parse(headerJson);
  const payload = data.slice(4 + headerLen);
  return { header, payload };
}

// --- Peer Connection Wrapper ---

interface ManagedPeer {
  peerId: string;
  connection: RTCPeerConnection;
  controlChannel: RTCDataChannel | null;
  binaryChannel: RTCDataChannel | null;
  status: PeerStatus;
  reconnectAttempt: number;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  disconnectTimer: ReturnType<typeof setTimeout> | null;
}

// =============================================================================
// Host Connection Manager
// =============================================================================

export class HostConnectionManager {
  private peers = new Map<string, ManagedPeer>();
  private destroyed = false;

  // Callbacks — set by consumer
  onMessage: ((peerId: string, message: string) => void) | null = null;
  onBinaryMessage:
    | ((peerId: string, header: object, data: ArrayBuffer) => void)
    | null = null;
  onPeerStatusChange:
    | ((peerId: string, status: PeerStatus) => void)
    | null = null;
  onIceCandidate:
    | ((peerId: string, candidate: RTCIceCandidateInit) => void)
    | null = null;
  onBinaryChannelReady: ((peerId: string) => void) | null = null;

  /**
   * Create a new peer connection and generate an offer for a specific peer.
   * The host creates one RTCPeerConnection per joining member.
   */
  async createOfferForPeer(peerId: string): Promise<RTCSessionDescriptionInit> {
    if (this.destroyed) throw new Error('Manager destroyed');

    const connection = new RTCPeerConnection(RTC_CONFIG);

    // Create data channels (host creates, peer receives via ondatachannel)
    const controlChannel = connection.createDataChannel('control', {
      ordered: true,
    });
    const binaryChannel = connection.createDataChannel('binary', {
      ordered: true,
    });

    const peer: ManagedPeer = {
      peerId,
      connection,
      controlChannel,
      binaryChannel,
      status: 'connecting',
      reconnectAttempt: 0,
      reconnectTimer: null,
      disconnectTimer: null,
    };

    this.peers.set(peerId, peer);
    this.wireChannelEvents(peer, controlChannel, binaryChannel);
    this.wireConnectionEvents(peer);

    // Wire ICE candidate forwarding before creating offer
    // (ICE gathering starts on setLocalDescription)
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        this.onIceCandidate?.(peerId, event.candidate.toJSON());
      }
    };

    const offer = await connection.createOffer();
    await connection.setLocalDescription(offer);

    return connection.localDescription!.toJSON();
  }

  async handlePeerAnswer(
    peerId: string,
    answer: RTCSessionDescriptionInit
  ): Promise<void> {
    const peer = this.peers.get(peerId);
    if (!peer) return;

    if (peer.connection.signalingState === 'have-local-offer') {
      await peer.connection.setRemoteDescription(
        new RTCSessionDescription(answer)
      );
    }
  }

  addIceCandidate(peerId: string, candidate: RTCIceCandidateInit): void {
    const peer = this.peers.get(peerId);
    if (!peer) return;
    peer.connection.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {
      // ICE candidate may arrive after connection is closed — safe to ignore
    });
  }

  sendToAll(message: string): void {
    for (const peer of this.peers.values()) {
      this.sendToPeerChannel(peer, message);
    }
  }

  sendToPeer(peerId: string, message: string): void {
    const peer = this.peers.get(peerId);
    if (peer) this.sendToPeerChannel(peer, message);
  }

  sendBinaryToPeer(
    peerId: string,
    header: object,
    payload: ArrayBuffer
  ): boolean {
    const peer = this.peers.get(peerId);
    if (!peer?.binaryChannel || peer.binaryChannel.readyState !== 'open')
      return false;
    const frame = frameBinaryMessage(header, payload);
    peer.binaryChannel.send(frame);
    return true;
  }

  disconnectPeer(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (!peer) return;
    this.cleanupPeer(peer);
    this.peers.delete(peerId);
  }

  getPeerIds(): string[] {
    return Array.from(this.peers.keys());
  }

  getBinaryBufferedAmount(peerId: string): number {
    const peer = this.peers.get(peerId);
    return peer?.binaryChannel?.bufferedAmount ?? 0;
  }

  getPeerStatus(peerId: string): PeerStatus | null {
    return this.peers.get(peerId)?.status ?? null;
  }

  isBinaryReady(peerId: string): boolean {
    const peer = this.peers.get(peerId);
    return peer?.binaryChannel?.readyState === 'open';
  }

  destroy(): void {
    this.destroyed = true;
    for (const peer of this.peers.values()) {
      this.cleanupPeer(peer);
    }
    this.peers.clear();
    this.onMessage = null;
    this.onBinaryMessage = null;
    this.onPeerStatusChange = null;
    this.onIceCandidate = null;
    this.onBinaryChannelReady = null;
  }

  // --- Private ---

  private sendToPeerChannel(peer: ManagedPeer, message: string): void {
    if (peer.controlChannel?.readyState === 'open') {
      peer.controlChannel.send(message);
    }
  }

  private wireChannelEvents(
    peer: ManagedPeer,
    controlChannel: RTCDataChannel,
    binaryChannel: RTCDataChannel
  ): void {
    controlChannel.onopen = () => {
      this.updatePeerStatus(peer, 'connected');
    };
    controlChannel.onmessage = (event) => {
      this.onMessage?.(peer.peerId, event.data);
    };

    binaryChannel.binaryType = 'arraybuffer';
    binaryChannel.onopen = () => {
      this.onBinaryChannelReady?.(peer.peerId);
    };
    binaryChannel.onmessage = (event) => {
      const { header, payload } = parseBinaryMessage(event.data);
      this.onBinaryMessage?.(peer.peerId, header, payload);
    };
  }

  private wireConnectionEvents(peer: ManagedPeer): void {
    peer.connection.oniceconnectionstatechange = () => {
      const state = peer.connection.iceConnectionState;
      if (state === 'disconnected') {
        this.handleDisconnect(peer);
      } else if (state === 'failed' || state === 'closed') {
        this.updatePeerStatus(peer, 'disconnected');
      } else if (state === 'connected' || state === 'completed') {
        peer.reconnectAttempt = 0;
        this.clearTimers(peer);
        this.updatePeerStatus(peer, 'connected');
      }
    };
  }

  private handleDisconnect(peer: ManagedPeer): void {
    if (peer.status === 'disconnected') return;
    this.updatePeerStatus(peer, 'reconnecting');

    // Start disconnect timeout
    peer.disconnectTimer = setTimeout(() => {
      this.updatePeerStatus(peer, 'disconnected');
    }, DISCONNECT_TIMEOUT_MS);
  }

  private updatePeerStatus(peer: ManagedPeer, status: PeerStatus): void {
    if (peer.status === status) return;
    peer.status = status;
    this.onPeerStatusChange?.(peer.peerId, status);

    if (status === 'connected' || status === 'disconnected') {
      this.clearTimers(peer);
    }
  }

  private clearTimers(peer: ManagedPeer): void {
    if (peer.reconnectTimer) {
      clearTimeout(peer.reconnectTimer);
      peer.reconnectTimer = null;
    }
    if (peer.disconnectTimer) {
      clearTimeout(peer.disconnectTimer);
      peer.disconnectTimer = null;
    }
  }

  private cleanupPeer(peer: ManagedPeer): void {
    this.clearTimers(peer);
    peer.controlChannel?.close();
    peer.binaryChannel?.close();
    peer.connection.close();
  }
}

// =============================================================================
// Peer Connection Manager (for band members joining a session)
// =============================================================================

export class PeerConnectionManager {
  private connection: RTCPeerConnection | null = null;
  private controlChannel: RTCDataChannel | null = null;
  private binaryChannel: RTCDataChannel | null = null;
  private status: PeerStatus = 'connecting';
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private disconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  // Callbacks
  onMessage: ((message: string) => void) | null = null;
  onBinaryMessage:
    | ((header: object, data: ArrayBuffer) => void)
    | null = null;
  onStatusChange: ((status: PeerStatus) => void) | null = null;
  onIceCandidate: ((candidate: RTCIceCandidateInit) => void) | null = null;
  onChannelOpen: (() => void) | null = null;

  async createAnswer(
    offer: RTCSessionDescriptionInit
  ): Promise<RTCSessionDescriptionInit> {
    if (this.destroyed) throw new Error('Manager destroyed');

    const connection = new RTCPeerConnection(RTC_CONFIG);
    this.connection = connection;

    // Listen for data channels created by the host
    connection.ondatachannel = (event) => {
      const channel = event.channel;
      if (channel.label === 'control') {
        this.controlChannel = channel;
        channel.onopen = () => {
          this.updateStatus('connected');
          this.onChannelOpen?.();
        };
        channel.onmessage = (e) => {
          this.onMessage?.(e.data);
        };
      } else if (channel.label === 'binary') {
        this.binaryChannel = channel;
        channel.binaryType = 'arraybuffer';
        channel.onmessage = (e) => {
          const { header, payload } = parseBinaryMessage(e.data);
          this.onBinaryMessage?.(header, payload);
        };
      }
    };

    connection.onicecandidate = (event) => {
      if (event.candidate) {
        this.onIceCandidate?.(event.candidate.toJSON());
      }
    };

    connection.oniceconnectionstatechange = () => {
      const state = connection.iceConnectionState;
      if (state === 'disconnected') {
        this.handleDisconnect();
      } else if (state === 'failed' || state === 'closed') {
        this.updateStatus('disconnected');
      } else if (state === 'connected' || state === 'completed') {
        this.reconnectAttempt = 0;
        this.clearTimers();
        this.updateStatus('connected');
      }
    };

    await connection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await connection.createAnswer();
    await connection.setLocalDescription(answer);

    return connection.localDescription!.toJSON();
  }

  addIceCandidate(candidate: RTCIceCandidateInit): void {
    this.connection
      ?.addIceCandidate(new RTCIceCandidate(candidate))
      .catch(() => {});
  }

  send(message: string): void {
    if (this.controlChannel?.readyState === 'open') {
      this.controlChannel.send(message);
    }
  }

  sendBinary(header: object, payload: ArrayBuffer): void {
    if (this.binaryChannel?.readyState === 'open') {
      const frame = frameBinaryMessage(header, payload);
      this.binaryChannel.send(frame);
    }
  }

  getStatus(): PeerStatus {
    return this.status;
  }

  destroy(): void {
    this.destroyed = true;
    this.clearTimers();
    this.controlChannel?.close();
    this.binaryChannel?.close();
    this.connection?.close();
    this.connection = null;
    this.controlChannel = null;
    this.binaryChannel = null;
    this.onMessage = null;
    this.onBinaryMessage = null;
    this.onStatusChange = null;
    this.onIceCandidate = null;
    this.onChannelOpen = null;
  }

  // --- Private ---

  private handleDisconnect(): void {
    if (this.status === 'disconnected') return;
    this.updateStatus('reconnecting');

    this.disconnectTimer = setTimeout(() => {
      this.updateStatus('disconnected');
    }, DISCONNECT_TIMEOUT_MS);

    this.attemptReconnect();
  }

  private attemptReconnect(): void {
    if (
      this.reconnectAttempt >= RECONNECT_DELAYS.length ||
      this.destroyed
    )
      return;

    const delay = RECONNECT_DELAYS[this.reconnectAttempt];
    this.reconnectAttempt++;

    this.reconnectTimer = setTimeout(() => {
      // WebRTC ICE agent handles reconnection internally when network is restored.
      // We just track the state and timeout. If ICE reconnects, the
      // oniceconnectionstatechange handler will fire with 'connected'.
      if (this.status === 'reconnecting') {
        this.attemptReconnect();
      }
    }, delay);
  }

  private updateStatus(status: PeerStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.onStatusChange?.(status);

    if (status === 'connected' || status === 'disconnected') {
      this.clearTimers();
    }
  }

  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.disconnectTimer) {
      clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
    }
  }
}
