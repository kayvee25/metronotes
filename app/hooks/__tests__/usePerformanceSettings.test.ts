import { renderHook, act } from '@testing-library/react';

vi.mock('../../lib/constants', () => ({
  STORAGE_KEYS: {
    PERF_FONT_SIZE: 'metronotes_perf_font_size',
    PERF_FONT_FAMILY: 'metronotes_perf_font_family',
    METRONOME_SOUND: 'metronotes_metronome_sound',
    KEEP_SCREEN_ON: 'metronotes_keep_screen_on',
  },
}));

import { usePerformanceSettings } from '../usePerformanceSettings';

// Mock localStorage
const localStorageStore: Record<string, string> = {};
const mockLocalStorage = {
  getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { localStorageStore[key] = value; }),
  removeItem: vi.fn((key: string) => { delete localStorageStore[key]; }),
};
Object.defineProperty(globalThis, 'localStorage', { value: mockLocalStorage, writable: true });

describe('usePerformanceSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]);
  });

  describe('default values', () => {
    it('returns default fontSize of md', () => {
      const { result } = renderHook(() => usePerformanceSettings());
      expect(result.current.fontSize).toBe('md');
    });

    it('returns default fontFamily of mono', () => {
      const { result } = renderHook(() => usePerformanceSettings());
      expect(result.current.fontFamily).toBe('mono');
    });

    it('returns default metronomeSound of default', () => {
      const { result } = renderHook(() => usePerformanceSettings());
      expect(result.current.metronomeSound).toBe('default');
    });

    it('returns default keepScreenOn of false', () => {
      const { result } = renderHook(() => usePerformanceSettings());
      expect(result.current.keepScreenOn).toBe(false);
    });
  });

  describe('reading from localStorage', () => {
    it('reads fontSize from localStorage', () => {
      localStorageStore['metronotes_perf_font_size'] = 'lg';
      const { result } = renderHook(() => usePerformanceSettings());
      expect(result.current.fontSize).toBe('lg');
    });

    it('reads fontFamily from localStorage', () => {
      localStorageStore['metronotes_perf_font_family'] = 'serif';
      const { result } = renderHook(() => usePerformanceSettings());
      expect(result.current.fontFamily).toBe('serif');
    });

    it('reads metronomeSound from localStorage', () => {
      localStorageStore['metronotes_metronome_sound'] = 'wood';
      const { result } = renderHook(() => usePerformanceSettings());
      expect(result.current.metronomeSound).toBe('wood');
    });

    it('reads keepScreenOn from localStorage', () => {
      localStorageStore['metronotes_keep_screen_on'] = 'true';
      const { result } = renderHook(() => usePerformanceSettings());
      expect(result.current.keepScreenOn).toBe(true);
    });

    it('falls back to default for invalid fontSize', () => {
      localStorageStore['metronotes_perf_font_size'] = 'xxl';
      const { result } = renderHook(() => usePerformanceSettings());
      expect(result.current.fontSize).toBe('md');
    });

    it('falls back to default for invalid fontFamily', () => {
      localStorageStore['metronotes_perf_font_family'] = 'comic-sans';
      const { result } = renderHook(() => usePerformanceSettings());
      expect(result.current.fontFamily).toBe('mono');
    });

    it('falls back to default for invalid metronomeSound', () => {
      localStorageStore['metronotes_metronome_sound'] = 'trumpet';
      const { result } = renderHook(() => usePerformanceSettings());
      expect(result.current.metronomeSound).toBe('default');
    });

    it('treats non-true keepScreenOn string as false', () => {
      localStorageStore['metronotes_keep_screen_on'] = 'false';
      const { result } = renderHook(() => usePerformanceSettings());
      expect(result.current.keepScreenOn).toBe(false);
    });
  });

  describe('setFontSize', () => {
    it('updates state and writes to localStorage', () => {
      const { result } = renderHook(() => usePerformanceSettings());

      act(() => {
        result.current.setFontSize('xl');
      });

      expect(result.current.fontSize).toBe('xl');
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('metronotes_perf_font_size', 'xl');
    });
  });

  describe('setFontFamily', () => {
    it('updates state and writes to localStorage', () => {
      const { result } = renderHook(() => usePerformanceSettings());

      act(() => {
        result.current.setFontFamily('sans');
      });

      expect(result.current.fontFamily).toBe('sans');
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('metronotes_perf_font_family', 'sans');
    });
  });

  describe('setMetronomeSound', () => {
    it('updates state and writes to localStorage', () => {
      const { result } = renderHook(() => usePerformanceSettings());

      act(() => {
        result.current.setMetronomeSound('cowbell');
      });

      expect(result.current.metronomeSound).toBe('cowbell');
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('metronotes_metronome_sound', 'cowbell');
    });
  });

  describe('setKeepScreenOn', () => {
    it('updates state and writes to localStorage with string true', () => {
      const { result } = renderHook(() => usePerformanceSettings());

      act(() => {
        result.current.setKeepScreenOn(true);
      });

      expect(result.current.keepScreenOn).toBe(true);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('metronotes_keep_screen_on', 'true');
    });

    it('updates state and writes to localStorage with string false', () => {
      localStorageStore['metronotes_keep_screen_on'] = 'true';
      const { result } = renderHook(() => usePerformanceSettings());

      act(() => {
        result.current.setKeepScreenOn(false);
      });

      expect(result.current.keepScreenOn).toBe(false);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('metronotes_keep_screen_on', 'false');
    });
  });
});
