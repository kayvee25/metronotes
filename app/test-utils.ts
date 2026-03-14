import { renderHook } from '@testing-library/react';
import type { Song, Setlist, Attachment, Asset } from './types';

export { renderHook };

let idCounter = 0;

function nextId(): string {
  return `test-id-${++idCounter}`;
}

export function resetIdCounter(): void {
  idCounter = 0;
}

const NOW = '2026-01-01T00:00:00.000Z';

export function makeSong(overrides?: Partial<Song>): Song {
  return {
    id: nextId(),
    name: 'Test Song',
    bpm: 120,
    timeSignature: '4/4',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

export function makeSetlist(overrides?: Partial<Setlist>): Setlist {
  return {
    id: nextId(),
    name: 'Test Setlist',
    songIds: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

export function makeAttachment(overrides?: Partial<Attachment>): Attachment {
  return {
    id: nextId(),
    type: 'richtext',
    order: 0,
    isDefault: false,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

export function makeAsset(overrides?: Partial<Asset>): Asset {
  return {
    id: nextId(),
    name: 'Test Asset',
    type: 'image',
    mimeType: 'image/jpeg',
    size: 1024,
    storageUrl: 'https://example.com/test.jpg',
    storagePath: 'users/test/assets/test.jpg',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}
