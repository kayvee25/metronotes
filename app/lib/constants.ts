// Musical keys
export const MUSICAL_KEYS = [
  'C',
  'C#/Db',
  'D',
  'D#/Eb',
  'E',
  'F',
  'F#/Gb',
  'G',
  'G#/Ab',
  'A',
  'A#/Bb',
  'B',
  'Cm',
  'C#m/Dbm',
  'Dm',
  'D#m/Ebm',
  'Em',
  'Fm',
  'F#m/Gbm',
  'Gm',
  'G#m/Abm',
  'Am',
  'A#m/Bbm',
  'Bm'
];

export const TIME_SIGNATURES = ['2/4', '3/4', '4/4', '5/4', '6/4', '7/4', '6/8', '7/8', '9/8', '12/8'];

// Metronome constraints
export const BPM = {
  MIN: 30,
  MAX: 400,
  DEFAULT: 120,
} as const;

// Time signature constraints
export const TIME_SIGNATURE = {
  DEFAULT: '4/4',
  NUMERATOR: {
    MIN: 1,
    MAX: 16,
    DEFAULT: 4,
  },
  DENOMINATOR: {
    OPTIONS: [2, 4, 8, 12, 16] as const,
    DEFAULT: 4,
  },
} as const;

// Audio settings
export const AUDIO = {
  DEFAULT_VOLUME: 0.7,
  SCHEDULE_AHEAD_TIME: 0.1,
  CLICK_DURATION: 0.1,
  FREQUENCY: {
    ACCENT: 800 * Math.pow(2, 7 / 12), // ~1346 Hz
    REGULAR: 600 * Math.pow(2, 7 / 12), // ~1009 Hz
  },
  MAX_AUDIO_SIZE: 10 * 1024 * 1024, // 10MB per audio file
  ACCEPTED_AUDIO_TYPES: ['audio/mpeg'] as readonly string[],
} as const;

// Animation durations (ms)
export const ANIMATION = {
  BEAT_INDICATOR_MS: 100,
  PAGE_TRANSITION_MS: 150,
  TOAST_AUTO_DISMISS_MS: 4000,
  TOAST_EXIT_MS: 200,
  EDITOR_FOCUS_DELAY_MS: 100,
  PAGE_SETTLE_MS: 20,
} as const;

export const GUEST = {
  MAX_SONGS: 3,
} as const;

// localStorage keys — single source of truth
export const STORAGE_KEYS = {
  SONGS: 'metronotes_songs',
  SETLISTS: 'metronotes_setlists',
  DARK_MODE: 'metronotes_dark_mode',
  GUEST_MODE: 'metronotes_guest_mode',
  PERF_FONT_SIZE: 'metronotes_perf_font_size',
  PERF_FONT_FAMILY: 'metronotes_perf_font_family',
  METRONOME_SOUND: 'metronotes_metronome_sound',
  KEEP_SCREEN_ON: 'metronotes_keep_screen_on',
  ASSETS: 'metronotes_assets',
  attachments: (songId: string) => `metronotes_attachments_${songId}`,
} as const;
