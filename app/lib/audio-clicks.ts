'use client';

import { AUDIO } from './constants';

export type MetronomeSound = 'default' | 'wood' | 'cowbell';

// Create default sine click
export function createDefaultClick(
  ctx: AudioContext,
  isAccent: boolean,
  scheduledTime: number,
  muted: boolean,
  volume: number = 1
): void {
  if (muted) return;
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.frequency.value = isAccent ? AUDIO.FREQUENCY.ACCENT : AUDIO.FREQUENCY.REGULAR;
  oscillator.type = 'sine';

  const targetGain = (isAccent ? 1 : 0.7) * volume;

  gainNode.gain.setValueAtTime(0, scheduledTime);
  gainNode.gain.linearRampToValueAtTime(targetGain, scheduledTime + 0.001);
  gainNode.gain.exponentialRampToValueAtTime(0.01, scheduledTime + AUDIO.CLICK_DURATION);

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.start(scheduledTime);
  oscillator.stop(scheduledTime + AUDIO.CLICK_DURATION);
}

// Create wood block sound: noise burst through bandpass filter
export function createWoodClick(
  ctx: AudioContext,
  isAccent: boolean,
  scheduledTime: number,
  muted: boolean,
  volume: number = 1
): void {
  if (muted) return;
  const bufferSize = ctx.sampleRate * 0.05; // 50ms
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const bandpass = ctx.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.value = isAccent ? 1200 : 900;
  bandpass.Q.value = 3;

  const gainNode = ctx.createGain();
  const targetGain = (isAccent ? 1.2 : 0.8) * volume;

  gainNode.gain.setValueAtTime(targetGain, scheduledTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, scheduledTime + 0.06);

  source.connect(bandpass);
  bandpass.connect(gainNode);
  gainNode.connect(ctx.destination);

  source.start(scheduledTime);
  source.stop(scheduledTime + 0.06);
}

// Create cowbell sound: two detuned triangle oscillators with warm filtering
export function createCowbellClick(
  ctx: AudioContext,
  isAccent: boolean,
  scheduledTime: number,
  muted: boolean,
  volume: number = 1
): void {
  if (muted) return;
  const targetGain = (isAccent ? 0.6 : 0.4) * volume;

  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  osc1.type = 'triangle';
  osc2.type = 'triangle';
  osc1.frequency.value = isAccent ? 545 : 520;
  osc2.frequency.value = isAccent ? 820 : 790;

  // Gentle bandpass to shape the tone without harsh ringing
  const bandpass = ctx.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.value = 700;
  bandpass.Q.value = 1;

  // Highpass to remove low-end mud
  const highpass = ctx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 300;

  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(targetGain, scheduledTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, scheduledTime + 0.08);

  osc1.connect(bandpass);
  osc2.connect(bandpass);
  bandpass.connect(highpass);
  highpass.connect(gainNode);
  gainNode.connect(ctx.destination);

  osc1.start(scheduledTime);
  osc2.start(scheduledTime);
  osc1.stop(scheduledTime + 0.08);
  osc2.stop(scheduledTime + 0.08);
}

// Dispatcher: schedule the right click sound based on sound type
export function scheduleClick(
  ctx: AudioContext,
  beat: number,
  time: number,
  sound: MetronomeSound,
  muted: boolean,
  volume: number = 1
): void {
  const isAccent = beat === 0;

  switch (sound) {
    case 'wood':
      createWoodClick(ctx, isAccent, time, muted, volume);
      break;
    case 'cowbell':
      createCowbellClick(ctx, isAccent, time, muted, volume);
      break;
    default:
      createDefaultClick(ctx, isAccent, time, muted, volume);
      break;
  }
}
