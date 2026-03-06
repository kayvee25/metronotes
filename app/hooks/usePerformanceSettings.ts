'use client';

import { useState } from 'react';
import { MetronomeSound } from './useMetronomeAudio';

export type FontSize = 'sm' | 'md' | 'lg' | 'xl';
export type FontFamily = 'mono' | 'sans' | 'serif';

export interface PerformanceSettings {
  fontSize: FontSize;
  fontFamily: FontFamily;
  metronomeSound: MetronomeSound;
  keepScreenOn: boolean;
}

const STORAGE_KEYS = {
  fontSize: 'metronotes_perf_font_size',
  fontFamily: 'metronotes_perf_font_family',
  metronomeSound: 'metronotes_metronome_sound',
  keepScreenOn: 'metronotes_keep_screen_on',
} as const;

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
    loadSetting(STORAGE_KEYS.fontSize, 'md', v => ['sm', 'md', 'lg', 'xl'].includes(v))
  );
  const [fontFamily, setFontFamilyState] = useState<FontFamily>(() =>
    loadSetting(STORAGE_KEYS.fontFamily, 'mono', v => ['mono', 'sans', 'serif'].includes(v))
  );
  const [metronomeSound, setMetronomeSoundState] = useState<MetronomeSound>(() =>
    loadSetting(STORAGE_KEYS.metronomeSound, 'default', v => ['default', 'wood', 'cowbell'].includes(v))
  );
  const [keepScreenOn, setKeepScreenOnState] = useState<boolean>(() =>
    loadBoolean(STORAGE_KEYS.keepScreenOn, false)
  );

  const setFontSize = (v: FontSize) => {
    setFontSizeState(v);
    try { localStorage.setItem(STORAGE_KEYS.fontSize, v); } catch {}
  };
  const setFontFamily = (v: FontFamily) => {
    setFontFamilyState(v);
    try { localStorage.setItem(STORAGE_KEYS.fontFamily, v); } catch {}
  };
  const setMetronomeSound = (v: MetronomeSound) => {
    setMetronomeSoundState(v);
    try { localStorage.setItem(STORAGE_KEYS.metronomeSound, v); } catch {}
  };
  const setKeepScreenOn = (v: boolean) => {
    setKeepScreenOnState(v);
    try { localStorage.setItem(STORAGE_KEYS.keepScreenOn, String(v)); } catch {}
  };

  return {
    fontSize, setFontSize,
    fontFamily, setFontFamily,
    metronomeSound, setMetronomeSound,
    keepScreenOn, setKeepScreenOn,
  };
}
