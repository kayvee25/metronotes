import { sortSongs, getSavedSortOption, SongSortOption } from '../song-sort';
import { Song } from '../../types';

function makeSong(overrides: Partial<Song> = {}): Song {
  return {
    id: 'song-1',
    name: 'Untitled',
    bpm: 120,
    timeSignature: '4/4',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const songs: Song[] = [
  makeSong({ id: '1', name: 'Cherry', bpm: 100, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-03T00:00:00Z' }),
  makeSong({ id: '2', name: 'apple', bpm: 140, createdAt: '2026-01-03T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }),
  makeSong({ id: '3', name: 'Banana', bpm: 80, createdAt: '2026-01-02T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z' }),
];

describe('sortSongs', () => {
  it('sorts by name A-Z (case-insensitive via localeCompare)', () => {
    const result = sortSongs(songs, 'name-az');
    expect(result.map((s) => s.name)).toEqual(['apple', 'Banana', 'Cherry']);
  });

  it('sorts by name Z-A (case-insensitive via localeCompare)', () => {
    const result = sortSongs(songs, 'name-za');
    expect(result.map((s) => s.name)).toEqual(['Cherry', 'Banana', 'apple']);
  });

  it('sorts by BPM low to high', () => {
    const result = sortSongs(songs, 'bpm-low');
    expect(result.map((s) => s.bpm)).toEqual([80, 100, 140]);
  });

  it('sorts by BPM high to low', () => {
    const result = sortSongs(songs, 'bpm-high');
    expect(result.map((s) => s.bpm)).toEqual([140, 100, 80]);
  });

  it('sorts by recently added (newest first)', () => {
    const result = sortSongs(songs, 'recent-added');
    expect(result.map((s) => s.id)).toEqual(['2', '3', '1']);
  });

  it('sorts by recently updated (newest first)', () => {
    const result = sortSongs(songs, 'recent-updated');
    expect(result.map((s) => s.id)).toEqual(['1', '3', '2']);
  });

  it('does not mutate the original array', () => {
    const original = [...songs];
    sortSongs(songs, 'name-az');
    expect(songs).toEqual(original);
  });

  it('returns empty array when given empty array', () => {
    expect(sortSongs([], 'name-az')).toEqual([]);
  });

  it('returns single-element array unchanged', () => {
    const single = [makeSong({ id: 'only', name: 'Solo' })];
    const result = sortSongs(single, 'bpm-high');
    expect(result).toEqual(single);
  });

  it('handles songs with same BPM (preserves relative order)', () => {
    const sameBpm = [
      makeSong({ id: 'a', name: 'Alpha', bpm: 120 }),
      makeSong({ id: 'b', name: 'Beta', bpm: 120 }),
      makeSong({ id: 'c', name: 'Charlie', bpm: 120 }),
    ];
    const resultLow = sortSongs(sameBpm, 'bpm-low');
    expect(resultLow.map((s) => s.id)).toEqual(['a', 'b', 'c']);

    const resultHigh = sortSongs(sameBpm, 'bpm-high');
    expect(resultHigh.map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('handles songs with same name (stable order)', () => {
    const sameName = [
      makeSong({ id: 'x', name: 'Dup' }),
      makeSong({ id: 'y', name: 'Dup' }),
    ];
    const result = sortSongs(sameName, 'name-az');
    expect(result.map((s) => s.id)).toEqual(['x', 'y']);
  });

  it('handles songs with same createdAt (stable order)', () => {
    const sameDate = [
      makeSong({ id: 'p', createdAt: '2026-01-01T00:00:00Z' }),
      makeSong({ id: 'q', createdAt: '2026-01-01T00:00:00Z' }),
    ];
    const result = sortSongs(sameDate, 'recent-added');
    expect(result.map((s) => s.id)).toEqual(['p', 'q']);
  });

  it('handles mixed case names correctly for A-Z', () => {
    const mixed = [
      makeSong({ id: '1', name: 'zebra' }),
      makeSong({ id: '2', name: 'Apple' }),
      makeSong({ id: '3', name: 'banana' }),
    ];
    const result = sortSongs(mixed, 'name-az');
    expect(result.map((s) => s.name)).toEqual(['Apple', 'banana', 'zebra']);
  });

  it('returns a copy for an unknown sort option (default branch)', () => {
    const result = sortSongs(songs, 'unknown' as SongSortOption);
    expect(result).toEqual(songs);
    expect(result).not.toBe(songs);
  });
});

describe('getSavedSortOption', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns name-az when nothing is saved', () => {
    expect(getSavedSortOption()).toBe('name-az');
  });

  it.each<SongSortOption>([
    'name-az',
    'name-za',
    'bpm-low',
    'bpm-high',
    'recent-added',
    'recent-updated',
  ])('returns %s when saved as %s', (option) => {
    localStorage.setItem('metronotes_songs_sort', option);
    expect(getSavedSortOption()).toBe(option);
  });

  it('returns name-az for an invalid saved value', () => {
    localStorage.setItem('metronotes_songs_sort', 'invalid-sort');
    expect(getSavedSortOption()).toBe('name-az');
  });

  it('returns name-az for an empty string', () => {
    localStorage.setItem('metronotes_songs_sort', '');
    expect(getSavedSortOption()).toBe('name-az');
  });

  it('returns name-az when localStorage throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('localStorage disabled');
    });
    expect(getSavedSortOption()).toBe('name-az');
    spy.mockRestore();
  });
});
