/**
 * Chunked binary asset transfer over WebRTC data channels.
 *
 * Sender splits an asset into 16KB chunks with TransferHeader metadata.
 * Receiver reassembles chunks and verifies SHA-256 checksum on completion.
 */

import type { TransferHeader } from './protocol';

// 16KB chunk size — small enough for reliable delivery over unordered data channel
const CHUNK_SIZE = 16 * 1024;

// Max concurrent transfers per peer
const MAX_CONCURRENT = 2;

// --- Checksum ---

async function sha256(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// =============================================================================
// Asset Transfer Sender (host side)
// =============================================================================

interface PendingTransfer {
  peerId: string;
  songId: string;
  assetId: string;
  data: ArrayBuffer;
  resolve: () => void;
  reject: (err: Error) => void;
}

export class AssetTransferSender {
  private sendBinary: (peerId: string, header: object, payload: ArrayBuffer) => void;
  private activeTransfers = new Map<string, number>(); // peerId → count
  private queue: PendingTransfer[] = [];
  private cancelled = new Set<string>(); // "peerId:assetId"

  constructor(
    sendBinary: (peerId: string, header: object, payload: ArrayBuffer) => void
  ) {
    this.sendBinary = sendBinary;
  }

  async sendAsset(
    peerId: string,
    songId: string,
    assetId: string,
    data: ArrayBuffer
  ): Promise<void> {
    const active = this.activeTransfers.get(peerId) ?? 0;
    if (active >= MAX_CONCURRENT) {
      // Queue and wait
      return new Promise((resolve, reject) => {
        this.queue.push({ peerId, songId, assetId, data, resolve, reject });
      });
    }

    await this.doTransfer(peerId, songId, assetId, data);
  }

  cancelTransfer(peerId: string, assetId: string): void {
    this.cancelled.add(`${peerId}:${assetId}`);
    // Remove from queue
    this.queue = this.queue.filter(
      (t) => !(t.peerId === peerId && t.assetId === assetId)
    );
  }

  cancelAllForPeer(peerId: string): void {
    this.queue = this.queue.filter((t) => t.peerId !== peerId);
    this.activeTransfers.delete(peerId);
  }

  destroy(): void {
    this.queue = [];
    this.activeTransfers.clear();
    this.cancelled.clear();
  }

  private async doTransfer(
    peerId: string,
    songId: string,
    assetId: string,
    data: ArrayBuffer
  ): Promise<void> {
    const key = `${peerId}:${assetId}`;
    this.activeTransfers.set(
      peerId,
      (this.activeTransfers.get(peerId) ?? 0) + 1
    );

    try {
      const checksum = await sha256(data);
      const totalChunks = Math.ceil(data.byteLength / CHUNK_SIZE) || 1;

      for (let i = 0; i < totalChunks; i++) {
        if (this.cancelled.has(key)) {
          this.cancelled.delete(key);
          return;
        }

        const offset = i * CHUNK_SIZE;
        const chunk = data.slice(offset, offset + CHUNK_SIZE);

        const header: TransferHeader = {
          songId,
          assetId,
          chunkIndex: i,
          totalChunks,
          checksum,
        };

        this.sendBinary(peerId, header, chunk);
      }
    } finally {
      const count = (this.activeTransfers.get(peerId) ?? 1) - 1;
      if (count <= 0) {
        this.activeTransfers.delete(peerId);
      } else {
        this.activeTransfers.set(peerId, count);
      }
      this.drainQueue(peerId);
    }
  }

  private drainQueue(peerId: string): void {
    const active = this.activeTransfers.get(peerId) ?? 0;
    if (active >= MAX_CONCURRENT) return;

    const idx = this.queue.findIndex((t) => t.peerId === peerId);
    if (idx === -1) return;

    const next = this.queue.splice(idx, 1)[0];
    this.doTransfer(next.peerId, next.songId, next.assetId, next.data)
      .then(next.resolve)
      .catch(next.reject);
  }
}

// =============================================================================
// Asset Transfer Receiver (member side)
// =============================================================================

interface ReceivingAsset {
  songId: string;
  assetId: string;
  totalChunks: number;
  checksum: string;
  chunks: Map<number, ArrayBuffer>;
}

export class AssetTransferReceiver {
  private receiving = new Map<string, ReceivingAsset>(); // assetId → state
  private destroyed = false;

  // Called when a complete asset has been reassembled and verified
  onAssetComplete:
    | ((songId: string, assetId: string, data: ArrayBuffer) => void)
    | null = null;

  // Called when checksum verification fails
  onAssetError:
    | ((songId: string, assetId: string, error: string) => void)
    | null = null;

  handleChunk(header: TransferHeader, data: ArrayBuffer): void {
    if (this.destroyed) return;

    const { songId, assetId, chunkIndex, totalChunks, checksum } = header;
    const key = assetId;

    let state = this.receiving.get(key);
    if (!state) {
      state = {
        songId,
        assetId,
        totalChunks,
        checksum,
        chunks: new Map(),
      };
      this.receiving.set(key, state);
    }

    state.chunks.set(chunkIndex, data);

    // Check if all chunks received
    if (state.chunks.size === state.totalChunks) {
      this.reassemble(state);
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.receiving.clear();
    this.onAssetComplete = null;
    this.onAssetError = null;
  }

  private async reassemble(state: ReceivingAsset): Promise<void> {
    this.receiving.delete(state.assetId);

    // Concatenate chunks in order
    let totalSize = 0;
    for (let i = 0; i < state.totalChunks; i++) {
      const chunk = state.chunks.get(i);
      if (!chunk) {
        this.onAssetError?.(
          state.songId,
          state.assetId,
          `Missing chunk ${i}`
        );
        return;
      }
      totalSize += chunk.byteLength;
    }

    const assembled = new ArrayBuffer(totalSize);
    const view = new Uint8Array(assembled);
    let offset = 0;
    for (let i = 0; i < state.totalChunks; i++) {
      const chunk = new Uint8Array(state.chunks.get(i)!);
      view.set(chunk, offset);
      offset += chunk.byteLength;
    }

    // Verify checksum
    const actualChecksum = await sha256(assembled);
    if (actualChecksum !== state.checksum) {
      this.onAssetError?.(
        state.songId,
        state.assetId,
        'Checksum mismatch'
      );
      return;
    }

    this.onAssetComplete?.(state.songId, state.assetId, assembled);
  }
}
