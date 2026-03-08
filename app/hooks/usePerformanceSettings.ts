'use client';

import { useState } from 'react';
import { MetronomeSound } from './useMetronomeAudio';
import { STORAGE_KEYS } from '../lib/constants';

export type FontSize = 'sm' | 'md' | 'lg' | 'xl';
export type FontFamily = 'mono' | 'sans' | 'serif';

export interface PerformanceSettings {
  fontSize: FontSize;
  fontFamily: FontFamily;
  metronomeSound: MetronomeSound;
  keepScreenOn: boolean;
}

function loadSetting<T>(key: string, fallback: T, validate?: (v: string) => boolean): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const saved = localStorage.getItem(key);
    if (saved !== null && (!validate || validate(saved))) {
      return saved as unknown as T;
    }
  } catch {}
  return fallback;
}

function loadBoolean(key: string, fallback: boolean): boolean {
  if (typeof window === 'undefined') return fallback;
  try {
    const saved = localStorage.getItem(key);
    if (saved !== null) return saved === 'true';
  } catch {}
  return fallback;
}

export function usePerformanceSettings() {
  const [fontSize, setFontSizeState] = useState<FontSize>(() =>
    loadSetting(STORAGE_KEYS.PERF_FONT_SIZE, 'md', v => ['sm', 'md', 'lg', 'xl'].includes(v))
  );
  const [fontFamily, setFontFamilyState] = useState<FontFamily>(() =>
    loadSetting(STORAGE_KEYS.PERF_FONT_FAMILY, 'mono', v => ['mono', 'sans', 'serif'].includes(v))
  );
  const [metronomeSound, setMetronomeSoundState] = useState<MetronomeSound>(() =>
    loadSetting(STORAGE_KEYS.METRONOME_SOUND, 'default', v => ['default', 'wood', 'cowbell'].includes(v))
  );
  const [keepScreenOn, setKeepScreenOnState] = useState<boolean>(() =>
    loadBoolean(STORAGE_KEYS.KEEP_SCREEN_ON, false)
  );

  const setFontSize = (v: FontSize) => {
    setFontSizeState(v);
    try { localStorage.setItem(STORAGE_KEYS.PERF_FONT_SIZE, v); } catch {}
  };
  const setFontFamily = (v: FontFamily) => {
    setFontFamilyState(v);
    try { localStorage.setItem(STORAGE_KEYS.PERF_FONT_FAMILY, v); } catch {}
  };
  const setMetronomeSound = (v: MetronomeSound) => {
    setMetronomeSoundState(v);
    try { localStorage.setItem(STORAGE_KEYS.METRONOME_SOUND, v); } catch {}
  };
  const setKeepScreenOn = (v: boolean) => {
    setKeepScreenOnState(v);
    try { localStorage.setItem(STORAGE_KEYS.KEEP_SCREEN_ON, String(v)); } catch {}
  };

  return {
    fontSize, setFontSize,
    fontFamily, setFontFamily,
    metronomeSound, setMetronomeSound,
    keepScreenOn, setKeepScreenOn,
  };
}
