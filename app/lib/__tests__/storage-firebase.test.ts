import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────

const mockRef = vi.hoisted(() => vi.fn());
const mockUploadBytes = vi.hoisted(() => vi.fn());
const mockGetDownloadURL = vi.hoisted(() => vi.fn());
const mockDeleteObject = vi.hoisted(() => vi.fn());
const mockFirebaseStorage = vi.hoisted(() => ({ id: 'mock-storage' }));

vi.mock('firebase/storage', () => ({
  ref: mockRef,
  uploadBytes: mockUploadBytes,
  getDownloadURL: mockGetDownloadURL,
  deleteObject: mockDeleteObject,
}));

vi.mock('../firebase', () => ({
  firebaseStorage: mockFirebaseStorage,
}));

// ── Import under test ────────────────────────────────────────────────────

import {
  uploadAttachmentFile,
  deleteAttachmentFile,
  getStoragePath,
} from '../storage-firebase';

// ── Tests ────────────────────────────────────────────────────────────────

describe('getStoragePath', () => {
  it('returns the correct path format', () => {
    expect(getStoragePath('user1', 'song1', 'att1')).toBe('users/user1/songs/song1/att1');
  });

  it('handles IDs with special characters', () => {
    expect(getStoragePath('u-1', 's_2', 'a.3')).toBe('users/u-1/songs/s_2/a.3');
  });
});

describe('uploadAttachmentFile', () => {
  const fakeRef = { id: 'fake-ref' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRef.mockReturnValue(fakeRef);
    mockUploadBytes.mockResolvedValue(undefined);
    mockGetDownloadURL.mockResolvedValue('https://storage.example.com/file.jpg');
  });

  it('creates ref with correct path', async () => {
    const blob = new Blob(['test'], { type: 'image/jpeg' });
    await uploadAttachmentFile('user1', 'song1', 'att1', blob);

    expect(mockRef).toHaveBeenCalledWith(mockFirebaseStorage, 'users/user1/songs/song1/att1');
  });

  it('uploads file with correct content type', async () => {
    const blob = new Blob(['test'], { type: 'image/png' });
    await uploadAttachmentFile('user1', 'song1', 'att1', blob, 'image/png');

    expect(mockUploadBytes).toHaveBeenCalledWith(fakeRef, blob, { contentType: 'image/png' });
  });

  it('uses default content type of image/jpeg', async () => {
    const blob = new Blob(['test']);
    await uploadAttachmentFile('user1', 'song1', 'att1', blob);

    expect(mockUploadBytes).toHaveBeenCalledWith(fakeRef, blob, { contentType: 'image/jpeg' });
  });

  it('returns the download URL', async () => {
    const blob = new Blob(['test']);
    const url = await uploadAttachmentFile('user1', 'song1', 'att1', blob);

    expect(url).toBe('https://storage.example.com/file.jpg');
    expect(mockGetDownloadURL).toHaveBeenCalledWith(fakeRef);
  });

  it('propagates upload errors', async () => {
    mockUploadBytes.mockRejectedValue(new Error('upload failed'));

    const blob = new Blob(['test']);
    await expect(uploadAttachmentFile('user1', 'song1', 'att1', blob)).rejects.toThrow(
      'upload failed'
    );
  });

  it('propagates getDownloadURL errors', async () => {
    mockGetDownloadURL.mockRejectedValue(new Error('url failed'));

    const blob = new Blob(['test']);
    await expect(uploadAttachmentFile('user1', 'song1', 'att1', blob)).rejects.toThrow(
      'url failed'
    );
  });
});

describe('deleteAttachmentFile', () => {
  const fakeRef = { id: 'fake-ref' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRef.mockReturnValue(fakeRef);
    mockDeleteObject.mockResolvedValue(undefined);
  });

  it('creates ref with correct path', async () => {
    await deleteAttachmentFile('user1', 'song1', 'att1');

    expect(mockRef).toHaveBeenCalledWith(mockFirebaseStorage, 'users/user1/songs/song1/att1');
  });

  it('calls deleteObject with the ref', async () => {
    await deleteAttachmentFile('user1', 'song1', 'att1');

    expect(mockDeleteObject).toHaveBeenCalledWith(fakeRef);
  });

  it('succeeds on successful deletion', async () => {
    await expect(deleteAttachmentFile('user1', 'song1', 'att1')).resolves.toBeUndefined();
  });

  it('gracefully handles storage/object-not-found error', async () => {
    const err = new Error('not found');
    (err as unknown as { code: string }).code = 'storage/object-not-found';
    mockDeleteObject.mockRejectedValue(err);

    // Should not throw
    await expect(deleteAttachmentFile('user1', 'song1', 'att1')).resolves.toBeUndefined();
  });

  it('rethrows other storage errors', async () => {
    const err = new Error('permission denied');
    (err as unknown as { code: string }).code = 'storage/unauthorized';
    mockDeleteObject.mockRejectedValue(err);

    await expect(deleteAttachmentFile('user1', 'song1', 'att1')).rejects.toThrow(
      'permission denied'
    );
  });

  it('rethrows errors without a code property', async () => {
    mockDeleteObject.mockRejectedValue(new Error('network error'));

    await expect(deleteAttachmentFile('user1', 'song1', 'att1')).rejects.toThrow('network error');
  });
});
