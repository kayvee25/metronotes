import { Song } from '../types';

export type SongSortOption = 'name-az' | 'name-za' | 'bpm-low' | 'bpm-high' | 'recent-added' | 'recent-updated';

const SORT_STORAGE_KEY = 'metronotes_songs_sort';

const VALID_OPTIONS: SongSortOption[] = ['name-az', 'name-za', 'bpm-low', 'bpm-high', 'recent-added', 'recent-updated'];

export function sortSongs(songs: Song[], sort: SongSortOption): Song[] {
  const sorted = [...songs];
  switch (sort) {
    case 'name-az':
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case 'name-za':
      return sorted.sort((a, b) => b.name.localeCompare(a.name));
    case 'bpm-low':
      return sorted.sort((a, b) => a.bpm - b.bpm);
    case 'bpm-high':
      return sorted.sort((a, b) => b.bpm - a.bpm);
    case 'recent-added':
      return sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case 'recent-updated':
      return sorted.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    default:
      return sorted;
  }
}

export function getSavedSortOption(): SongSortOption {
  if (typeof window === 'undefined') return 'name-az';
  try {
    const saved = localStorage.getItem(SORT_STORAGE_KEY);
    if (saved && VALID_OPTIONS.includes(saved as SongSortOption)) {
      return saved as SongSortOption;
    }
  } catch { /* ignore */ }
  return 'name-az';
}
