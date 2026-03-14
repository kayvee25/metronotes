// @vitest-environment node
import { AssetTransferSender, AssetTransferReceiver } from '../transfer';

// Helper: compute SHA-256 (same logic as transfer.ts)
async function sha256(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

describe('AssetTransferReceiver', () => {
  it('reassembles chunks received in order and fires onAssetComplete', async () => {
    const receiver = new AssetTransferReceiver();
    const onComplete = vi.fn();
    const onError = vi.fn();
    receiver.onAssetComplete = onComplete;
    receiver.onAssetError = onError;

    // Create test data
    const data = new Uint8Array([1, 2, 3]);
    const checksum = await sha256(data.buffer);

    // Single chunk
    receiver.handleChunk(
      { songId: 's1', assetId: 'a1', chunkIndex: 0, totalChunks: 1, checksum },
      data.buffer
    );

    // Wait for async reassembly
    await vi.waitFor(() => {
      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    expect(onComplete).toHaveBeenCalledWith('s1', 'a1', expect.any(ArrayBuffer));
    const result = new Uint8Array(onComplete.mock.calls[0][2]);
    expect(result).toEqual(new Uint8Array([1, 2, 3]));
    expect(onError).not.toHaveBeenCalled();

    receiver.destroy();
  });

  it('reassembles chunks received out of order', async () => {
    const receiver = new AssetTransferReceiver();
    const onComplete = vi.fn();
    receiver.onAssetComplete = onComplete;

    // Create 2 chunks worth of data
    const chunk0 = new Uint8Array([1, 2]);
    const chunk1 = new Uint8Array([3, 4]);
    const fullData = new Uint8Array([1, 2, 3, 4]);
    const checksum = await sha256(fullData.buffer);

    // Send chunk 1 first, then chunk 0
    receiver.handleChunk(
      { songId: 's1', assetId: 'a1', chunkIndex: 1, totalChunks: 2, checksum },
      chunk1.buffer
    );
    expect(onComplete).not.toHaveBeenCalled();

    receiver.handleChunk(
      { songId: 's1', assetId: 'a1', chunkIndex: 0, totalChunks: 2, checksum },
      chunk0.buffer
    );

    await vi.waitFor(() => {
      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    const result = new Uint8Array(onComplete.mock.calls[0][2]);
    expect(result).toEqual(new Uint8Array([1, 2, 3, 4]));

    receiver.destroy();
  });

  it('fires onAssetError on checksum mismatch', async () => {
    const receiver = new AssetTransferReceiver();
    const onComplete = vi.fn();
    const onError = vi.fn();
    receiver.onAssetComplete = onComplete;
    receiver.onAssetError = onError;

    const data = new Uint8Array([1, 2, 3]);

    receiver.handleChunk(
      { songId: 's1', assetId: 'a1', chunkIndex: 0, totalChunks: 1, checksum: 'wrong-checksum' },
      data.buffer
    );

    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledTimes(1);
    });

    expect(onError).toHaveBeenCalledWith('s1', 'a1', 'Checksum mismatch');
    expect(onComplete).not.toHaveBeenCalled();

    receiver.destroy();
  });

  it('handles duplicate chunks gracefully', async () => {
    const receiver = new AssetTransferReceiver();
    const onComplete = vi.fn();
    receiver.onAssetComplete = onComplete;

    const data = new Uint8Array([1, 2, 3]);
    const checksum = await sha256(data.buffer);
    const header = { songId: 's1', assetId: 'a1', chunkIndex: 0, totalChunks: 1, checksum };

    // Send same chunk twice — first triggers reassembly
    receiver.handleChunk(header, data.buffer);

    await vi.waitFor(() => {
      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    // Second send after reassembly — should not crash
    receiver.handleChunk(header, data.buffer);

    receiver.destroy();
  });
});

describe('AssetTransferSender', () => {
  it('sends asset data via sendBinary callback', async () => {
    const sendBinary = vi.fn();
    const sender = new AssetTransferSender(sendBinary);

    const data = new Uint8Array([1, 2, 3]);
    await sender.sendAsset('peer1', 'song1', 'asset1', data.buffer);

    expect(sendBinary).toHaveBeenCalled();
    const [peerId, header] = sendBinary.mock.calls[0];
    expect(peerId).toBe('peer1');
    expect(header).toMatchObject({
      songId: 'song1',
      assetId: 'asset1',
      chunkIndex: 0,
      totalChunks: 1,
    });
    expect(header.checksum).toBeDefined();

    sender.destroy();
  });

  it('cancelAllForPeer removes queued transfers', async () => {
    const sendBinary = vi.fn();
    const sender = new AssetTransferSender(sendBinary);

    const data = new Uint8Array([1]);

    // Queue up several transfers (MAX_CONCURRENT is 2, so 3rd+ will queue)
    const p1 = sender.sendAsset('peer1', 's1', 'a1', data.buffer);
    const p2 = sender.sendAsset('peer1', 's1', 'a2', data.buffer);
    sender.sendAsset('peer1', 's1', 'a3', data.buffer); // will be queued

    // Cancel all for peer1
    sender.cancelAllForPeer('peer1');

    await p1;
    await p2;

    sender.destroy();
  });
});
