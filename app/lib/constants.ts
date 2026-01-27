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
} as const;

// Animation durations (ms)
export const ANIMATION = {
  BEAT_INDICATOR_MS: 100,
} as const;
