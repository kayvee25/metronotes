/**
 * NTP-lite clock synchronization for live session metronome.
 *
 * Measures the time offset between host and member using round-trip
 * timing over the WebRTC data channel:
 *
 *   Member sends:  { t1: performance.now() }
 *   Host responds:  { t1, t2: performance.now(), t3: performance.now() }
 *   Member receives at t4 = performance.now()
 *
 *   RTT    = (t4 - t1) - (t3 - t2)
 *   offset = ((t2 - t1) + (t3 - t4)) / 2
 *
 * Multiple samples are taken and the median offset is used to
 * reduce jitter. Re-sync runs periodically to correct drift.
 */

const SYNC_SAMPLES = 7;
const SYNC_INTERVAL_MS = 500; // between samples
const PERIODIC_RESYNC_MS = 30_000;

export class ClockSync {
  private sendRequest: (t1: number) => void;
  private onSynced: (offset: number) => void;

  private samples: number[] = [];
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private resyncTimer: ReturnType<typeof setInterval> | null = null;
  private _offset = 0;
  private _synced = false;
  private destroyed = false;

  constructor(
    sendRequest: (t1: number) => void,
    onSynced: (offset: number) => void
  ) {
    this.sendRequest = sendRequest;
    this.onSynced = onSynced;
  }

  /** Start initial clock sync (member calls this after connection). */
  startSync(): void {
    this.samples = [];
    this.sendSample();
  }

  /** Handle a clock-sync-response from the host. */
  handleResponse(t1: number, t2: number, t3: number): void {
    if (this.destroyed) return;

    const t4 = performance.now();
    const offset = ((t2 - t1) + (t3 - t4)) / 2;

    this.samples.push(offset);

    if (this.samples.length < SYNC_SAMPLES) {
      // Schedule next sample
      this.syncTimer = setTimeout(() => {
        if (!this.destroyed) this.sendSample();
      }, SYNC_INTERVAL_MS);
    } else {
      // Compute median offset
      const sorted = [...this.samples].sort((a, b) => a - b);
      this._offset = sorted[Math.floor(sorted.length / 2)];
      this._synced = true;
      this.onSynced(this._offset);
    }
  }

  /** Convert local time to network (host) time. */
  getNetworkTime(): number {
    return performance.now() + this._offset;
  }

  /** Convert network (host) time to local time. */
  toLocalTime(networkTime: number): number {
    return networkTime - this._offset;
  }

  get offset(): number {
    return this._offset;
  }

  get isSynced(): boolean {
    return this._synced;
  }

  /** Start periodic re-sync to correct drift. */
  startPeriodicResync(intervalMs: number = PERIODIC_RESYNC_MS): void {
    this.stopPeriodicResync();
    this.resyncTimer = setInterval(() => {
      if (!this.destroyed) this.startSync();
    }, intervalMs);
  }

  stopPeriodicResync(): void {
    if (this.resyncTimer) {
      clearInterval(this.resyncTimer);
      this.resyncTimer = null;
    }
  }

  destroy(): void {
    this.destroyed = true;
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
    this.stopPeriodicResync();
  }

  private sendSample(): void {
    const t1 = performance.now();
    this.sendRequest(t1);
  }
}
