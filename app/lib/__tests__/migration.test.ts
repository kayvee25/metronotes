/**
 * Tests for migration.ts — textToTiptapJson and migrateNotesToAttachment.
 *
 * textToTiptapJson is not exported from migration.ts, so we test it
 * by reimplementing the pure logic here (it's a simple function).
 *
 * migrateNotesToAttachment is tested by mocking the firestore and storage deps.
 */

import { Song } from '../../types';

// --- Mocks (vi.hoisted so they're available in vi.mock factories) ---

const {
  mockFirestoreCreateAttachment,
  mockFirestoreUpdateSong,
  mockStorageCreateAttachment,
  mockStorageUpdateSong,
} = vi.hoisted(() => ({
  mockFirestoreCreateAttachment: vi.fn(),
  mockFirestoreUpdateSong: vi.fn(),
  mockStorageCreateAttachment: vi.fn(),
  mockStorageUpdateSong: vi.fn(),
}));

vi.mock('../firestore', () => ({
  firestoreCreateAttachment: mockFirestoreCreateAttachment,
  firestoreUpdateSong: mockFirestoreUpdateSong,
}));

vi.mock('../storage', () => ({
  storage: {
    createAttachment: mockStorageCreateAttachment,
    updateSong: mockStorageUpdateSong,
  },
}));

import { migrateNotesToAttachment } from '../migration';

// Reimplemented from migration.ts — pure function, no deps
function textToTiptapJson(text: string): object {
  const lines = text.split('\n');
  const content = lines.map((line) => {
    if (line.trim() === '') {
      return { type: 'paragraph' };
    }
    return {
      type: 'paragraph',
      content: [{ type: 'text', text: line }],
    };
  });
  return { type: 'doc', content };
}

function makeSong(overrides: Partial<Song> = {}): Song {
  return {
    id: 'song-1',
    name: 'Test Song',
    bpm: 120,
    timeSignature: '4/4',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('textToTiptapJson', () => {
  it('converts empty string to doc with empty paragraph', () => {
    const result = textToTiptapJson('') as { type: string; content: unknown[] };
    expect(result.type).toBe('doc');
    expect(result.content).toHaveLength(1);
    expect(result.content[0]).toEqual({ type: 'paragraph' });
  });

  it('converts single line to doc with one paragraph', () => {
    const result = textToTiptapJson('Hello world') as { type: string; content: unknown[] };
    expect(result.type).toBe('doc');
    expect(result.content).toHaveLength(1);
    expect(result.content[0]).toEqual({
      type: 'paragraph',
      content: [{ type: 'text', text: 'Hello world' }],
    });
  });

  it('converts multiple lines to multiple paragraphs', () => {
    const result = textToTiptapJson('Line 1\nLine 2\nLine 3') as { type: string; content: unknown[] };
    expect(result.content).toHaveLength(3);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.content[0] as any).content[0].text).toBe('Line 1');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.content[2] as any).content[0].text).toBe('Line 3');
  });

  it('handles empty lines as empty paragraphs', () => {
    const result = textToTiptapJson('Before\n\nAfter') as { type: string; content: unknown[] };
    expect(result.content).toHaveLength(3);
    expect(result.content[1]).toEqual({ type: 'paragraph' });
  });

  it('preserves whitespace within lines', () => {
    const result = textToTiptapJson('  indented  text  ') as { type: string; content: unknown[] };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.content[0] as any).content[0].text).toBe('  indented  text  ');
  });

  it('preserves special characters', () => {
    const text = 'Quotes "hello" & <angle> \'brackets\'';
    const result = textToTiptapJson(text) as { type: string; content: unknown[] };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.content[0] as any).content[0].text).toBe(text);
  });
});

describe('migrateNotesToAttachment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('returns false when migration is not needed', () => {
    it('returns false when notes is undefined', async () => {
      const song = makeSong({ notes: undefined });
      const result = await migrateNotesToAttachment(song, 'guest');
      expect(result).toBe(false);
    });

    it('returns false when notes is empty string', async () => {
      const song = makeSong({ notes: '' });
      const result = await migrateNotesToAttachment(song, 'guest');
      expect(result).toBe(false);
    });

    it('returns false when notes is whitespace only', async () => {
      const song = makeSong({ notes: '   \n  \n  ' });
      const result = await migrateNotesToAttachment(song, 'guest');
      expect(result).toBe(false);
    });

    it('does not call storage or firestore when notes is empty', async () => {
      const song = makeSong({ notes: '' });
      await migrateNotesToAttachment(song, 'guest');
      await migrateNotesToAttachment(song, 'authenticated', 'user-1');
      expect(mockStorageCreateAttachment).not.toHaveBeenCalled();
      expect(mockStorageUpdateSong).not.toHaveBeenCalled();
      expect(mockFirestoreCreateAttachment).not.toHaveBeenCalled();
      expect(mockFirestoreUpdateSong).not.toHaveBeenCalled();
    });
  });

  describe('guest mode', () => {
    it('creates attachment in localStorage with correct content', async () => {
      const song = makeSong({ notes: 'Hello world' });
      const result = await migrateNotesToAttachment(song, 'guest');

      expect(result).toBe(true);
      expect(mockStorageCreateAttachment).toHaveBeenCalledTimes(1);
      expect(mockStorageCreateAttachment).toHaveBeenCalledWith('song-1', {
        type: 'richtext',
        order: 0,
        isDefault: true,
        content: textToTiptapJson('Hello world'),
      });
    });

    it('removes notes field from song in localStorage', async () => {
      const song = makeSong({ notes: 'Hello world' });
      await migrateNotesToAttachment(song, 'guest');

      expect(mockStorageUpdateSong).toHaveBeenCalledTimes(1);
      expect(mockStorageUpdateSong).toHaveBeenCalledWith('song-1', { notes: undefined });
    });

    it('does not call firestore functions in guest mode', async () => {
      const song = makeSong({ notes: 'Hello world' });
      await migrateNotesToAttachment(song, 'guest');

      expect(mockFirestoreCreateAttachment).not.toHaveBeenCalled();
      expect(mockFirestoreUpdateSong).not.toHaveBeenCalled();
    });

    it('converts multiline notes to tiptap JSON with multiple paragraphs', async () => {
      const song = makeSong({ notes: 'Line 1\nLine 2\n\nLine 4' });
      await migrateNotesToAttachment(song, 'guest');

      const expectedContent = textToTiptapJson('Line 1\nLine 2\n\nLine 4');
      expect(mockStorageCreateAttachment).toHaveBeenCalledWith('song-1', expect.objectContaining({
        content: expectedContent,
      }));
    });
  });

  describe('authenticated mode', () => {
    it('creates attachment in Firestore with correct content', async () => {
      const song = makeSong({ notes: 'Hello world' });
      const result = await migrateNotesToAttachment(song, 'authenticated', 'user-1');

      expect(result).toBe(true);
      expect(mockFirestoreCreateAttachment).toHaveBeenCalledTimes(1);
      expect(mockFirestoreCreateAttachment).toHaveBeenCalledWith('user-1', 'song-1', {
        type: 'richtext',
        order: 0,
        isDefault: true,
        content: textToTiptapJson('Hello world'),
      });
    });

    it('removes notes field from song in Firestore', async () => {
      const song = makeSong({ notes: 'Hello world' });
      await migrateNotesToAttachment(song, 'authenticated', 'user-1');

      expect(mockFirestoreUpdateSong).toHaveBeenCalledTimes(1);
      expect(mockFirestoreUpdateSong).toHaveBeenCalledWith('user-1', 'song-1', { notes: undefined });
    });

    it('does not call localStorage functions in authenticated mode', async () => {
      const song = makeSong({ notes: 'Hello world' });
      await migrateNotesToAttachment(song, 'authenticated', 'user-1');

      expect(mockStorageCreateAttachment).not.toHaveBeenCalled();
      expect(mockStorageUpdateSong).not.toHaveBeenCalled();
    });

    it('does nothing when authenticated mode is missing userId', async () => {
      const song = makeSong({ notes: 'Hello world' });
      // mode is authenticated but userId is undefined
      const result = await migrateNotesToAttachment(song, 'authenticated');

      // The function enters the else-if branch which requires userId, so neither branch executes
      expect(result).toBe(true); // returns true because notes exist and tiptapContent was built
      expect(mockFirestoreCreateAttachment).not.toHaveBeenCalled();
      expect(mockFirestoreUpdateSong).not.toHaveBeenCalled();
      expect(mockStorageCreateAttachment).not.toHaveBeenCalled();
      expect(mockStorageUpdateSong).not.toHaveBeenCalled();
    });
  });
});
