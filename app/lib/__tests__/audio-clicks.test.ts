import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AUDIO } from '../constants';

// ── Mock AudioContext primitives ─────────────────────────────────────────

function mockAudioParam() {
  return {
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
}

function mockOscillatorNode() {
  return {
    type: '' as OscillatorType,
    frequency: mockAudioParam(),
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
}

function mockGainNode() {
  return {
    gain: mockAudioParam(),
    connect: vi.fn(),
  };
}

function mockBiquadFilterNode() {
  return {
    type: '' as BiquadFilterType,
    frequency: mockAudioParam(),
    Q: mockAudioParam(),
    connect: vi.fn(),
  };
}

function mockBufferSourceNode() {
  return {
    buffer: null as AudioBuffer | null,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
}

function createMockAudioContext() {
  const oscillators: ReturnType<typeof mockOscillatorNode>[] = [];
  const gains: ReturnType<typeof mockGainNode>[] = [];
  const filters: ReturnType<typeof mockBiquadFilterNode>[] = [];
  const bufferSources: ReturnType<typeof mockBufferSourceNode>[] = [];

  const ctx = {
    destination: { id: 'destination' },
    sampleRate: 44100,
    createOscillator: vi.fn(() => {
      const osc = mockOscillatorNode();
      oscillators.push(osc);
      return osc;
    }),
    createGain: vi.fn(() => {
      const g = mockGainNode();
      gains.push(g);
      return g;
    }),
    createBiquadFilter: vi.fn(() => {
      const f = mockBiquadFilterNode();
      filters.push(f);
      return f;
    }),
    createBufferSource: vi.fn(() => {
      const s = mockBufferSourceNode();
      bufferSources.push(s);
      return s;
    }),
    createBuffer: vi.fn((_channels: number, length: number, sampleRate: number) => ({
      getChannelData: vi.fn(() => new Float32Array(length)),
      length,
      sampleRate,
    })),
  };

  return { ctx, oscillators, gains, filters, bufferSources };
}

// ── Import under test ────────────────────────────────────────────────────

import {
  createDefaultClick,
  createWoodClick,
  createCowbellClick,
  scheduleClick,
} from '../audio-clicks';

// ── Tests ────────────────────────────────────────────────────────────────

describe('createDefaultClick', () => {
  let mock: ReturnType<typeof createMockAudioContext>;

  beforeEach(() => {
    mock = createMockAudioContext();
  });

  it('creates oscillator and gain for accent beat', () => {
    createDefaultClick(mock.ctx as unknown as AudioContext, true, 1.0, false, 1);

    expect(mock.ctx.createOscillator).toHaveBeenCalledOnce();
    expect(mock.ctx.createGain).toHaveBeenCalledOnce();

    const osc = mock.oscillators[0];
    expect(osc.frequency.value).toBe(AUDIO.FREQUENCY.ACCENT);
    expect(osc.type).toBe('sine');

    const gain = mock.gains[0];
    // accent gain = 1 * volume(1) = 1
    expect(gain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(1, 1.001);
  });

  it('creates oscillator and gain for regular beat', () => {
    createDefaultClick(mock.ctx as unknown as AudioContext, false, 2.0, false, 1);

    const osc = mock.oscillators[0];
    expect(osc.frequency.value).toBe(AUDIO.FREQUENCY.REGULAR);

    const gain = mock.gains[0];
    // regular gain = 0.7 * volume(1) = 0.7
    expect(gain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.7, 2.001);
  });

  it('applies volume scaling', () => {
    createDefaultClick(mock.ctx as unknown as AudioContext, true, 0, false, 0.5);

    const gain = mock.gains[0];
    // accent gain = 1 * 0.5 = 0.5
    expect(gain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.5, 0.001);
  });

  it('does nothing when muted', () => {
    createDefaultClick(mock.ctx as unknown as AudioContext, true, 0, true, 1);

    expect(mock.ctx.createOscillator).not.toHaveBeenCalled();
    expect(mock.ctx.createGain).not.toHaveBeenCalled();
  });

  it('connects oscillator -> gain -> destination', () => {
    createDefaultClick(mock.ctx as unknown as AudioContext, false, 0, false);

    const osc = mock.oscillators[0];
    const gain = mock.gains[0];
    expect(osc.connect).toHaveBeenCalledWith(gain);
    expect(gain.connect).toHaveBeenCalledWith(mock.ctx.destination);
  });

  it('schedules start and stop with click duration', () => {
    const time = 5.0;
    createDefaultClick(mock.ctx as unknown as AudioContext, false, time, false);

    const osc = mock.oscillators[0];
    expect(osc.start).toHaveBeenCalledWith(time);
    expect(osc.stop).toHaveBeenCalledWith(time + AUDIO.CLICK_DURATION);
  });

  it('sets envelope: attack from 0, ramp up, then exponential decay', () => {
    const time = 1.0;
    createDefaultClick(mock.ctx as unknown as AudioContext, false, time, false, 1);

    const gain = mock.gains[0];
    expect(gain.gain.setValueAtTime).toHaveBeenCalledWith(0, time);
    expect(gain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.7, time + 0.001);
    expect(gain.gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(
      0.01,
      time + AUDIO.CLICK_DURATION
    );
  });
});

describe('createWoodClick', () => {
  let mock: ReturnType<typeof createMockAudioContext>;

  beforeEach(() => {
    mock = createMockAudioContext();
  });

  it('creates buffer source, bandpass filter, and gain', () => {
    createWoodClick(mock.ctx as unknown as AudioContext, false, 0, false, 1);

    expect(mock.ctx.createBuffer).toHaveBeenCalledOnce();
    expect(mock.ctx.createBufferSource).toHaveBeenCalledOnce();
    expect(mock.ctx.createBiquadFilter).toHaveBeenCalledOnce();
    expect(mock.ctx.createGain).toHaveBeenCalledOnce();
  });

  it('uses bandpass filter with accent frequency', () => {
    createWoodClick(mock.ctx as unknown as AudioContext, true, 0, false, 1);

    const filter = mock.filters[0];
    expect(filter.type).toBe('bandpass');
    expect(filter.frequency.value).toBe(1200);
    expect(filter.Q.value).toBe(3);
  });

  it('uses bandpass filter with regular frequency', () => {
    createWoodClick(mock.ctx as unknown as AudioContext, false, 0, false, 1);

    const filter = mock.filters[0];
    expect(filter.frequency.value).toBe(900);
  });

  it('connects source -> bandpass -> gain -> destination', () => {
    createWoodClick(mock.ctx as unknown as AudioContext, false, 0, false);

    const source = mock.bufferSources[0];
    const filter = mock.filters[0];
    const gain = mock.gains[0];
    expect(source.connect).toHaveBeenCalledWith(filter);
    expect(filter.connect).toHaveBeenCalledWith(gain);
    expect(gain.connect).toHaveBeenCalledWith(mock.ctx.destination);
  });

  it('applies volume scaling for accent', () => {
    createWoodClick(mock.ctx as unknown as AudioContext, true, 0, false, 0.5);

    const gain = mock.gains[0];
    // accent = 1.2 * 0.5 = 0.6
    expect(gain.gain.setValueAtTime).toHaveBeenCalledWith(0.6, 0);
  });

  it('applies volume scaling for regular', () => {
    createWoodClick(mock.ctx as unknown as AudioContext, false, 0, false, 0.5);

    const gain = mock.gains[0];
    // regular = 0.8 * 0.5 = 0.4
    expect(gain.gain.setValueAtTime).toHaveBeenCalledWith(0.4, 0);
  });

  it('does nothing when muted', () => {
    createWoodClick(mock.ctx as unknown as AudioContext, false, 0, true, 1);

    expect(mock.ctx.createBufferSource).not.toHaveBeenCalled();
  });

  it('creates a noise buffer of 50ms duration', () => {
    createWoodClick(mock.ctx as unknown as AudioContext, false, 0, false);

    const expectedLength = mock.ctx.sampleRate * 0.05;
    expect(mock.ctx.createBuffer).toHaveBeenCalledWith(1, expectedLength, mock.ctx.sampleRate);
  });
});

describe('createCowbellClick', () => {
  let mock: ReturnType<typeof createMockAudioContext>;

  beforeEach(() => {
    mock = createMockAudioContext();
  });

  it('creates two triangle oscillators', () => {
    createCowbellClick(mock.ctx as unknown as AudioContext, true, 0, false, 1);

    expect(mock.ctx.createOscillator).toHaveBeenCalledTimes(2);
    expect(mock.oscillators[0].type).toBe('triangle');
    expect(mock.oscillators[1].type).toBe('triangle');
  });

  it('sets accent frequencies for oscillators', () => {
    createCowbellClick(mock.ctx as unknown as AudioContext, true, 0, false, 1);

    expect(mock.oscillators[0].frequency.value).toBe(545);
    expect(mock.oscillators[1].frequency.value).toBe(820);
  });

  it('sets regular frequencies for oscillators', () => {
    createCowbellClick(mock.ctx as unknown as AudioContext, false, 0, false, 1);

    expect(mock.oscillators[0].frequency.value).toBe(520);
    expect(mock.oscillators[1].frequency.value).toBe(790);
  });

  it('creates bandpass and highpass filters', () => {
    createCowbellClick(mock.ctx as unknown as AudioContext, false, 0, false);

    expect(mock.ctx.createBiquadFilter).toHaveBeenCalledTimes(2);
    expect(mock.filters[0].type).toBe('bandpass');
    expect(mock.filters[0].frequency.value).toBe(700);
    expect(mock.filters[0].Q.value).toBe(1);
    expect(mock.filters[1].type).toBe('highpass');
    expect(mock.filters[1].frequency.value).toBe(300);
  });

  it('connects osc1,osc2 -> bandpass -> highpass -> gain -> destination', () => {
    createCowbellClick(mock.ctx as unknown as AudioContext, false, 0, false);

    const [osc1, osc2] = mock.oscillators;
    const [bandpass, highpass] = mock.filters;
    const gain = mock.gains[0];

    expect(osc1.connect).toHaveBeenCalledWith(bandpass);
    expect(osc2.connect).toHaveBeenCalledWith(bandpass);
    expect(bandpass.connect).toHaveBeenCalledWith(highpass);
    expect(highpass.connect).toHaveBeenCalledWith(gain);
    expect(gain.connect).toHaveBeenCalledWith(mock.ctx.destination);
  });

  it('applies volume scaling for accent', () => {
    createCowbellClick(mock.ctx as unknown as AudioContext, true, 0, false, 0.5);

    const gain = mock.gains[0];
    // accent = 0.6 * 0.5 = 0.3
    expect(gain.gain.setValueAtTime).toHaveBeenCalledWith(
      expect.closeTo(0.3, 5),
      0
    );
  });

  it('applies volume scaling for regular', () => {
    createCowbellClick(mock.ctx as unknown as AudioContext, false, 0, false, 0.5);

    const gain = mock.gains[0];
    // regular = 0.4 * 0.5 = 0.2
    expect(gain.gain.setValueAtTime).toHaveBeenCalledWith(
      expect.closeTo(0.2, 5),
      0
    );
  });

  it('does nothing when muted', () => {
    createCowbellClick(mock.ctx as unknown as AudioContext, false, 0, true);

    expect(mock.ctx.createOscillator).not.toHaveBeenCalled();
  });

  it('starts and stops both oscillators', () => {
    const time = 3.0;
    createCowbellClick(mock.ctx as unknown as AudioContext, false, time, false);

    const [osc1, osc2] = mock.oscillators;
    expect(osc1.start).toHaveBeenCalledWith(time);
    expect(osc2.start).toHaveBeenCalledWith(time);
    expect(osc1.stop).toHaveBeenCalledWith(time + 0.08);
    expect(osc2.stop).toHaveBeenCalledWith(time + 0.08);
  });
});

describe('scheduleClick', () => {
  let mock: ReturnType<typeof createMockAudioContext>;

  beforeEach(() => {
    mock = createMockAudioContext();
  });

  it('dispatches to createDefaultClick for "default" sound', () => {
    scheduleClick(mock.ctx as unknown as AudioContext, 0, 1.0, 'default', false, 1);

    // Default click creates one oscillator (sine)
    expect(mock.ctx.createOscillator).toHaveBeenCalledOnce();
    expect(mock.oscillators[0].type).toBe('sine');
  });

  it('dispatches to createWoodClick for "wood" sound', () => {
    scheduleClick(mock.ctx as unknown as AudioContext, 0, 1.0, 'wood', false, 1);

    // Wood click creates a buffer source, not an oscillator
    expect(mock.ctx.createBufferSource).toHaveBeenCalledOnce();
    expect(mock.ctx.createOscillator).not.toHaveBeenCalled();
  });

  it('dispatches to createCowbellClick for "cowbell" sound', () => {
    scheduleClick(mock.ctx as unknown as AudioContext, 0, 1.0, 'cowbell', false, 1);

    // Cowbell creates two oscillators (triangle)
    expect(mock.ctx.createOscillator).toHaveBeenCalledTimes(2);
    expect(mock.oscillators[0].type).toBe('triangle');
  });

  it('treats beat 0 as accent', () => {
    scheduleClick(mock.ctx as unknown as AudioContext, 0, 0, 'default', false, 1);

    // Accent uses AUDIO.FREQUENCY.ACCENT
    expect(mock.oscillators[0].frequency.value).toBe(AUDIO.FREQUENCY.ACCENT);
  });

  it('treats non-zero beats as regular', () => {
    scheduleClick(mock.ctx as unknown as AudioContext, 1, 0, 'default', false, 1);

    expect(mock.oscillators[0].frequency.value).toBe(AUDIO.FREQUENCY.REGULAR);
  });

  it('treats beat 3 as regular', () => {
    scheduleClick(mock.ctx as unknown as AudioContext, 3, 0, 'default', false, 1);

    expect(mock.oscillators[0].frequency.value).toBe(AUDIO.FREQUENCY.REGULAR);
  });

  it('passes muted flag through — no nodes created when muted', () => {
    scheduleClick(mock.ctx as unknown as AudioContext, 0, 0, 'default', true, 1);

    expect(mock.ctx.createOscillator).not.toHaveBeenCalled();
    expect(mock.ctx.createGain).not.toHaveBeenCalled();
  });

  it('passes volume through to gain node', () => {
    scheduleClick(mock.ctx as unknown as AudioContext, 0, 0, 'default', false, 0.3);

    const gain = mock.gains[0];
    // accent: 1 * 0.3 = 0.3
    expect(gain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      expect.closeTo(0.3, 5),
      expect.any(Number)
    );
  });
});
