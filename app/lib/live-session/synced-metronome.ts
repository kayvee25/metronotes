/**
 * Synchronized metronome for live session members.
 *
 * Receives beat messages from the host (with network timestamps) and
 * schedules audio clicks at the correct local time using Web Audio API.
 *
 * The host's metronome runs normally via useMetronomeAudio. This class
 * is only used on the member side to play clicks in sync with the host.
 */

import { ClockSync } from './clock-sync';
import { scheduleClick, type MetronomeSound } from '../audio-clicks';
import type { MetronomeState } from './protocol';

// Buffer time (ms) added to scheduled clicks to absorb network jitter
const SCHEDULE_BUFFER_MS = 30;

export class SyncedMetronome {
  private clockSync: ClockSync;
  private audioCtx: AudioContext | null = null;
  private state: MetronomeState | null = null;
  private sound: MetronomeSound = 'default';
  private volume = 1;
  private muted = false;
  private destroyed = false;

  // Beat indicator state (for UI)
  private _currentBeat = 0;
  private _isBeating = false;
  private beatTimeout: ReturnType<typeof setTimeout> | null = null;

  onBeatUpdate: ((beat: number, isBeating: boolean) => void) | null = null;

  constructor(clockSync: ClockSync) {
    this.clockSync = clockSync;
  }

  setSound(sound: MetronomeSound): void {
    this.sound = sound;
  }

  setVolume(volume: number): void {
    this.volume = volume;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  /** Update metronome config from host's metronome-update message. */
  handleMetronomeUpdate(state: MetronomeState): void {
    this.state = state;
  }

  /** Schedule a click for a beat message from the host. */
  handleBeat(networkTime: number, beatNumber: number): void {
    if (this.destroyed || !this.state?.isPlaying) return;
    if (!this.clockSync.isSynced) return;

    // Convert network time to local time
    const localTime = this.clockSync.toLocalTime(networkTime);
    const now = performance.now();
    const delayMs = localTime - now + SCHEDULE_BUFFER_MS;

    // If the beat is too far in the past, skip it
    if (delayMs < -50) return;

    // Ensure AudioContext exists
    if (!this.audioCtx) {
      this.audioCtx = new AudioContext();
    }

    const ctx = this.audioCtx;
    const beatsPerMeasure = this.state.timeSignature[0];
    const beatInMeasure = beatNumber % beatsPerMeasure;

    // Schedule audio click
    const audioTime = ctx.currentTime + Math.max(0, delayMs / 1000);
    scheduleClick(ctx, beatInMeasure, audioTime, this.sound, this.muted, this.volume);

    // Update beat indicator (visual)
    const indicatorDelay = Math.max(0, delayMs);
    setTimeout(() => {
      if (this.destroyed) return;
      this._currentBeat = beatInMeasure;
      this._isBeating = true;
      this.onBeatUpdate?.(this._currentBeat, true);

      if (this.beatTimeout) clearTimeout(this.beatTimeout);
      this.beatTimeout = setTimeout(() => {
        this._isBeating = false;
        this.onBeatUpdate?.(this._currentBeat, false);
      }, 100);
    }, indicatorDelay);
  }

  get currentBeat(): number {
    return this._currentBeat;
  }

  get isBeating(): boolean {
    return this._isBeating;
  }

  stop(): void {
    this._currentBeat = 0;
    this._isBeating = false;
    if (this.beatTimeout) {
      clearTimeout(this.beatTimeout);
      this.beatTimeout = null;
    }
    this.onBeatUpdate?.(0, false);
  }

  destroy(): void {
    this.destroyed = true;
    this.stop();
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
    this.onBeatUpdate = null;
  }
}
