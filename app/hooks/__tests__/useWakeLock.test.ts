import { renderHook, act } from '@testing-library/react';
import { useWakeLock } from '../useWakeLock';

describe('useWakeLock', () => {
  let mockRelease: ReturnType<typeof vi.fn>;
  let mockRequest: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockRelease = vi.fn().mockResolvedValue(undefined);
    mockRequest = vi.fn().mockResolvedValue({ release: mockRelease });

    Object.defineProperty(navigator, 'wakeLock', {
      value: { request: mockRequest },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not request wake lock when enabled is false', () => {
    renderHook(() => useWakeLock(false, true));
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('does not request wake lock when active is false', () => {
    renderHook(() => useWakeLock(true, false));
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('does not request wake lock when both are false', () => {
    renderHook(() => useWakeLock(false, false));
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('requests wake lock when both enabled and active are true', async () => {
    renderHook(() => useWakeLock(true, true));

    // Let the async request resolve
    await vi.waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith('screen');
    });
  });

  it('releases wake lock when enabled changes to false', async () => {
    const { rerender } = renderHook(
      ({ enabled, active }) => useWakeLock(enabled, active),
      { initialProps: { enabled: true, active: true } }
    );

    await vi.waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith('screen');
    });

    rerender({ enabled: false, active: true });

    expect(mockRelease).toHaveBeenCalled();
  });

  it('releases wake lock when active changes to false', async () => {
    const { rerender } = renderHook(
      ({ enabled, active }) => useWakeLock(enabled, active),
      { initialProps: { enabled: true, active: true } }
    );

    await vi.waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith('screen');
    });

    rerender({ enabled: true, active: false });

    expect(mockRelease).toHaveBeenCalled();
  });

  it('releases wake lock on unmount', async () => {
    const { unmount } = renderHook(() => useWakeLock(true, true));

    await vi.waitFor(() => {
      expect(mockRequest).toHaveBeenCalled();
    });

    unmount();

    expect(mockRelease).toHaveBeenCalled();
  });

  it('handles missing navigator.wakeLock gracefully', () => {
    Object.defineProperty(navigator, 'wakeLock', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    expect(() => {
      renderHook(() => useWakeLock(true, true));
    }).not.toThrow();
  });

  it('handles wakeLock.request rejection gracefully', async () => {
    mockRequest.mockRejectedValue(new Error('Not allowed'));

    expect(() => {
      renderHook(() => useWakeLock(true, true));
    }).not.toThrow();

    // Let the async rejection settle
    await vi.waitFor(() => {
      expect(mockRequest).toHaveBeenCalled();
    });
  });

  it('re-acquires wake lock on visibilitychange when visible', async () => {
    renderHook(() => useWakeLock(true, true));

    await vi.waitFor(() => {
      expect(mockRequest).toHaveBeenCalledTimes(1);
    });

    // Simulate tab becoming hidden then visible
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
      writable: true,
    });

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await vi.waitFor(() => {
      expect(mockRequest).toHaveBeenCalledTimes(2);
    });
  });

  it('does not re-acquire on visibilitychange when hidden', async () => {
    renderHook(() => useWakeLock(true, true));

    await vi.waitFor(() => {
      expect(mockRequest).toHaveBeenCalledTimes(1);
    });

    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true,
      writable: true,
    });

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Should still only have been called once
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it('removes visibilitychange listener on unmount', async () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');

    const { unmount } = renderHook(() => useWakeLock(true, true));

    await vi.waitFor(() => {
      expect(mockRequest).toHaveBeenCalled();
    });

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    removeSpy.mockRestore();
  });
});
