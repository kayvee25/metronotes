import { ClockSync } from '../clock-sync';

describe('ClockSync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calculates offset from known t1, t2, t3, t4 values', () => {
    let capturedOffset: number | undefined;
    const sendRequest = vi.fn();
    const onSynced = vi.fn((offset: number) => {
      capturedOffset = offset;
    });

    const clock = new ClockSync(sendRequest, onSynced);
    clock.startSync();

    // Simulate 7 sync responses with known timing
    // offset = ((t2 - t1) + (t3 - t4)) / 2
    // If host is 100ms ahead: t2 = t1 + 100, t3 = t4 + 100
    // With zero network delay: t1 = t4, so offset = ((t1+100 - t1) + (t4+100 - t4)) / 2 = 100
    const mockNow = vi.spyOn(performance, 'now');

    for (let i = 0; i < 7; i++) {
      expect(sendRequest).toHaveBeenCalled();
      const t1 = 1000 + i * 500;

      // When handleResponse is called, performance.now() returns t4
      const t4 = t1 + 10; // 10ms round trip
      mockNow.mockReturnValue(t4);

      // Host clock is 100ms ahead
      const t2 = t1 + 100 + 5; // host received at t1 + offset + half RTT
      const t3 = t1 + 100 + 5; // host sent back immediately

      clock.handleResponse(t1, t2, t3);

      if (i < 6) {
        // Advance timer for next sample
        vi.advanceTimersByTime(500);
      }
    }

    expect(onSynced).toHaveBeenCalledTimes(1);
    expect(capturedOffset).toBeDefined();
    // The offset should be approximately 100ms
    expect(Math.abs(capturedOffset! - 100)).toBeLessThan(1);

    clock.destroy();
    mockNow.mockRestore();
  });

  it('getNetworkTime and toLocalTime are inverses', () => {
    const sendRequest = vi.fn();
    const onSynced = vi.fn();
    const clock = new ClockSync(sendRequest, onSynced);

    // Manually set offset by feeding 7 identical samples
    const mockNow = vi.spyOn(performance, 'now');
    clock.startSync();

    for (let i = 0; i < 7; i++) {
      const t1 = 1000;
      mockNow.mockReturnValue(1010); // t4
      clock.handleResponse(t1, 1050, 1050); // host 50ms ahead, 10ms RTT
      if (i < 6) vi.advanceTimersByTime(500);
    }

    // Now test round-trip
    mockNow.mockReturnValue(2000);
    const networkTime = clock.getNetworkTime();
    const localTime = clock.toLocalTime(networkTime);
    expect(Math.abs(localTime - 2000)).toBeLessThan(0.001);

    clock.destroy();
    mockNow.mockRestore();
  });

  it('uses median offset to reject outliers', () => {
    const sendRequest = vi.fn();
    const onSynced = vi.fn();
    const clock = new ClockSync(sendRequest, onSynced);
    const mockNow = vi.spyOn(performance, 'now');

    clock.startSync();

    // Send 7 samples: 6 consistent (offset ~50) + 1 outlier (offset ~5000)
    for (let i = 0; i < 7; i++) {
      const t1 = 1000;
      mockNow.mockReturnValue(1010); // t4 = t1 + 10

      if (i === 3) {
        // Outlier: host appears 5000ms ahead
        clock.handleResponse(t1, 6010, 6010);
      } else {
        // Normal: host 50ms ahead
        clock.handleResponse(t1, 1055, 1055);
      }

      if (i < 6) vi.advanceTimersByTime(500);
    }

    expect(onSynced).toHaveBeenCalledTimes(1);
    const offset = onSynced.mock.calls[0][0];
    // Median should be ~50, not skewed by the 5000 outlier
    expect(Math.abs(offset - 50)).toBeLessThan(5);

    clock.destroy();
    mockNow.mockRestore();
  });

  it('fires onSynced after enough samples', () => {
    const sendRequest = vi.fn();
    const onSynced = vi.fn();
    const clock = new ClockSync(sendRequest, onSynced);
    const mockNow = vi.spyOn(performance, 'now');

    clock.startSync();

    // After 6 samples, should NOT be synced yet
    for (let i = 0; i < 6; i++) {
      mockNow.mockReturnValue(1010);
      clock.handleResponse(1000, 1050, 1050);
      vi.advanceTimersByTime(500);
    }
    expect(onSynced).not.toHaveBeenCalled();
    expect(clock.isSynced).toBe(false);

    // 7th sample triggers sync
    mockNow.mockReturnValue(1010);
    clock.handleResponse(1000, 1050, 1050);
    expect(onSynced).toHaveBeenCalledTimes(1);
    expect(clock.isSynced).toBe(true);

    clock.destroy();
    mockNow.mockRestore();
  });

  it('destroy stops further processing', () => {
    const sendRequest = vi.fn();
    const onSynced = vi.fn();
    const clock = new ClockSync(sendRequest, onSynced);
    const mockNow = vi.spyOn(performance, 'now');

    clock.startSync();
    clock.destroy();

    mockNow.mockReturnValue(1010);
    clock.handleResponse(1000, 1050, 1050);

    // Should not schedule more samples
    vi.advanceTimersByTime(5000);
    expect(sendRequest).toHaveBeenCalledTimes(1); // Only the initial call

    mockNow.mockRestore();
  });
});
