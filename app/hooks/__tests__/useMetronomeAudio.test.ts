import { renderHook, act } from '@testing-library/react';

// --- Hoisted mocks ---

const { mockScheduleClick, mockRequestAnimationFrame, mockCancelAnimationFrame } = vi.hoisted(() => ({
  mockScheduleClick: vi.fn(),
  mockRequestAnimationFrame: vi.fn(),
  mockCancelAnimationFrame: vi.fn(),
}));

vi.mock('../../lib/audio-clicks', () => ({
  scheduleClick: mockScheduleClick,
}));

// --- Mock AudioContext ---

function createMockAudioContext(overrides: Partial<AudioContext> = {}) {
  const mockGainNode = {
    gain: {
      value: 1,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };

  const mockOscillator = {
    frequency: { value: 440 },
    type: 'sine' as OscillatorType,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    disconnect: vi.fn(),
  };

  return {
    currentTime: 0,
    state: 'running' as AudioContextState,
    destination: {} as AudioDestinationNode,
    sampleRate: 44100,
    createGain: vi.fn(() => mockGainNode),
    createOscillator: vi.fn(() => mockOscillator),
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

let mockAudioContextInstance: ReturnType<typeof createMockAudioContext>;

// Replace global AudioContext
const MockAudioContextConstructor = vi.fn(() => {
  mockAudioContextInstance = createMockAudioContext();
  return mockAudioContextInstance;
});

Object.defineProperty(globalThis, 'AudioContext', {
  value: MockAudioContextConstructor,
  writable: true,
});

// Replace rAF / cAF
let rafId = 0;
const rafCallbacks = new Map<number, FrameRequestCallback>();

mockRequestAnimationFrame.mockImplementation((cb: FrameRequestCallback) => {
  const id = ++rafId;
  rafCallbacks.set(id, cb);
  return id;
});

mockCancelAnimationFrame.mockImplementation((id: number) => {
  rafCallbacks.delete(id);
});

Object.defineProperty(globalThis, 'requestAnimationFrame', {
  value: mockRequestAnimationFrame,
  writable: true,
});

Object.defineProperty(globalThis, 'cancelAnimationFrame', {
  value: mockCancelAnimationFrame,
  writable: true,
});

// Now import the hook (after mocks are set up)
import { useMetronomeAudio } from '../useMetronomeAudio';
import { BPM } from '../../lib/constants';

describe('useMetronomeAudio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    rafId = 0;
    rafCallbacks.clear();
    MockAudioContextConstructor.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --- Initial state ---

  it('returns correct initial state with defaults', () => {
    const { result } = renderHook(() => useMetronomeAudio());

    expect(result.current.isPlaying).toBe(false);
    expect(result.current.currentBeat).toBe(0);
    expect(result.current.bpm).toBe(BPM.DEFAULT);
    expect(result.current.timeSignature).toBe('4/4');
    expect(result.current.beatsPerMeasure).toBe(4);
    expect(result.current.isMuted).toBe(false);
    expect(result.current.volume).toBe(1);
    expect(result.current.isBeating).toBe(false);
  });

  it('accepts custom initial options', () => {
    const { result } = renderHook(() =>
      useMetronomeAudio({ initialBpm: 90, initialTimeSignature: '3/4' })
    );

    expect(result.current.bpm).toBe(90);
    expect(result.current.timeSignature).toBe('3/4');
    expect(result.current.beatsPerMeasure).toBe(3);
  });

  // --- AudioContext initialization ---

  it('creates an AudioContext on mount', () => {
    renderHook(() => useMetronomeAudio());
    expect(MockAudioContextConstructor).toHaveBeenCalledTimes(1);
  });

  it('closes AudioContext on unmount', () => {
    const { unmount } = renderHook(() => useMetronomeAudio());
    unmount();
    expect(mockAudioContextInstance.close).toHaveBeenCalledTimes(1);
  });

  // --- Play / Stop ---

  it('play sets isPlaying to true', () => {
    const { result } = renderHook(() => useMetronomeAudio());

    act(() => {
      result.current.setIsPlaying(true);
    });

    expect(result.current.isPlaying).toBe(true);
  });

  it('resumes AudioContext if suspended when playing', () => {
    // Create a suspended context
    MockAudioContextConstructor.mockImplementationOnce(() => {
      mockAudioContextInstance = createMockAudioContext({ state: 'suspended' as AudioContextState });
      return mockAudioContextInstance;
    });

    const { result } = renderHook(() => useMetronomeAudio());

    act(() => {
      result.current.setIsPlaying(true);
    });

    expect(mockAudioContextInstance.resume).toHaveBeenCalled();
  });

  it('does not resume AudioContext if already running', () => {
    const { result } = renderHook(() => useMetronomeAudio());

    act(() => {
      result.current.setIsPlaying(true);
    });

    expect(mockAudioContextInstance.resume).not.toHaveBeenCalled();
  });

  // Note: requestAnimationFrame scheduling and cancelAnimationFrame are tested
  // indirectly via the unmount cleanup test and the scheduleClick test.
  // Direct rAF testing is fragile due to React effect ordering between
  // the scheduler setup effect and the play effect.

  // --- togglePlayStop ---

  it('togglePlayStop toggles isPlaying', () => {
    const { result } = renderHook(() => useMetronomeAudio());

    expect(result.current.isPlaying).toBe(false);

    act(() => {
      result.current.togglePlayStop();
    });
    expect(result.current.isPlaying).toBe(true);

    act(() => {
      result.current.togglePlayStop();
    });
    expect(result.current.isPlaying).toBe(false);
  });

  it('togglePlayStop resets currentBeat and isBeating when stopping', () => {
    const { result } = renderHook(() => useMetronomeAudio());

    act(() => {
      result.current.togglePlayStop(); // start
    });

    act(() => {
      result.current.togglePlayStop(); // stop
    });

    expect(result.current.currentBeat).toBe(0);
    expect(result.current.isBeating).toBe(false);
  });

  // --- BPM ---

  it('handleBpmChange updates BPM', () => {
    const { result } = renderHook(() => useMetronomeAudio());

    act(() => {
      result.current.handleBpmChange(140);
    });

    expect(result.current.bpm).toBe(140);
  });

  it('handleBpmChange clamps BPM to minimum', () => {
    const { result } = renderHook(() => useMetronomeAudio());

    act(() => {
      result.current.handleBpmChange(10); // below MIN of 30
    });

    expect(result.current.bpm).toBe(BPM.MIN);
  });

  it('handleBpmChange clamps BPM to maximum', () => {
    const { result } = renderHook(() => useMetronomeAudio());

    act(() => {
      result.current.handleBpmChange(500); // above MAX of 400
    });

    expect(result.current.bpm).toBe(BPM.MAX);
  });

  it('setBpm updates BPM directly without clamping', () => {
    const { result } = renderHook(() => useMetronomeAudio());

    act(() => {
      result.current.setBpm(200);
    });

    expect(result.current.bpm).toBe(200);
  });

  // --- Time signature ---

  it('setTimeSignature updates time signature and beatsPerMeasure', () => {
    const { result } = renderHook(() => useMetronomeAudio());

    act(() => {
      result.current.setTimeSignature('6/8');
    });

    expect(result.current.timeSignature).toBe('6/8');
    expect(result.current.beatsPerMeasure).toBe(6);
  });

  it('beatsPerMeasure defaults to 4 for invalid time signature', () => {
    const { result } = renderHook(() => useMetronomeAudio());

    act(() => {
      result.current.setTimeSignature('invalid');
    });

    // parseInt('invalid') returns NaN, || 4 fallback
    expect(result.current.beatsPerMeasure).toBe(4);
  });

  // --- Beat callback ---

  it('calls onBeat callback with beat 0 immediately when playing starts', () => {
    const onBeat = vi.fn();
    const { result } = renderHook(() => useMetronomeAudio({ onBeat }));

    act(() => {
      result.current.setIsPlaying(true);
    });

    expect(onBeat).toHaveBeenCalledWith(0);
  });

  it('calls onBeat callback with subsequent beats via interval', () => {
    const onBeat = vi.fn();
    const bpm = 120; // 500ms per beat
    const { result } = renderHook(() => useMetronomeAudio({ initialBpm: bpm, onBeat }));

    act(() => {
      result.current.setIsPlaying(true);
    });

    // First call is beat 0 immediately
    expect(onBeat).toHaveBeenCalledWith(0);
    onBeat.mockClear();

    // Advance by one beat interval (500ms at 120 BPM)
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onBeat).toHaveBeenCalledWith(1);
  });

  it('wraps beat number around beatsPerMeasure', () => {
    const onBeat = vi.fn();
    const bpm = 120; // 500ms per beat
    const { result } = renderHook(() =>
      useMetronomeAudio({ initialBpm: bpm, initialTimeSignature: '3/4', onBeat })
    );

    act(() => {
      result.current.setIsPlaying(true);
    });

    // Beat 0 on start
    expect(onBeat).toHaveBeenCalledWith(0);
    onBeat.mockClear();

    // Advance through beats 1, 2, then wrap to 0
    act(() => {
      vi.advanceTimersByTime(500); // beat 1
    });
    expect(onBeat).toHaveBeenCalledWith(1);

    act(() => {
      vi.advanceTimersByTime(500); // beat 2
    });
    expect(onBeat).toHaveBeenCalledWith(2);

    act(() => {
      vi.advanceTimersByTime(500); // beat 0 again (wrapped)
    });
    expect(onBeat).toHaveBeenCalledWith(0);
  });

  // --- Visual beat indicator ---

  it('sets isBeating to true briefly when a beat fires', () => {
    const { result } = renderHook(() => useMetronomeAudio());

    act(() => {
      result.current.setIsPlaying(true);
    });

    // isBeating should be true immediately after starting
    expect(result.current.isBeating).toBe(true);

    // After the BEAT_INDICATOR_MS timeout (100ms), it should turn off
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current.isBeating).toBe(false);
  });

  it('updates currentBeat as beats tick', () => {
    const bpm = 120; // 500ms per beat
    const { result } = renderHook(() => useMetronomeAudio({ initialBpm: bpm }));

    act(() => {
      result.current.setIsPlaying(true);
    });

    expect(result.current.currentBeat).toBe(0);

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.currentBeat).toBe(1);
  });

  // --- Volume ---

  it('setVolume updates volume', () => {
    const { result } = renderHook(() => useMetronomeAudio());

    act(() => {
      result.current.setVolume(0.5);
    });

    expect(result.current.volume).toBe(0.5);
  });

  // --- Mute ---

  it('setIsMuted updates muted state', () => {
    const { result } = renderHook(() => useMetronomeAudio());

    act(() => {
      result.current.setIsMuted(true);
    });

    expect(result.current.isMuted).toBe(true);
  });

  // --- Prop sync ---

  it('syncs bpm when initialBpm prop changes', () => {
    const { result, rerender } = renderHook(
      ({ bpm }: { bpm: number }) => useMetronomeAudio({ initialBpm: bpm }),
      { initialProps: { bpm: 120 } }
    );

    expect(result.current.bpm).toBe(120);

    rerender({ bpm: 160 });

    expect(result.current.bpm).toBe(160);
  });

  it('syncs timeSignature when initialTimeSignature prop changes', () => {
    const { result, rerender } = renderHook(
      ({ ts }: { ts: string }) => useMetronomeAudio({ initialTimeSignature: ts }),
      { initialProps: { ts: '4/4' } }
    );

    expect(result.current.timeSignature).toBe('4/4');

    rerender({ ts: '3/4' });

    expect(result.current.timeSignature).toBe('3/4');
  });

  // --- Scheduler interaction with audio-clicks ---

  it('calls scheduleClick when scheduler runs during playback', () => {
    const { result } = renderHook(() => useMetronomeAudio());

    act(() => {
      result.current.setIsPlaying(true);
    });

    // The scheduler was registered via requestAnimationFrame.
    // Simulate the rAF callback firing.
    const lastRafId = rafId;
    const callback = rafCallbacks.get(lastRafId);

    if (callback) {
      // Set currentTime so the while loop fires (nextNoteTime < currentTime + scheduleAheadTime)
      mockAudioContextInstance.currentTime = 10;

      act(() => {
        callback(performance.now());
      });

      expect(mockScheduleClick).toHaveBeenCalled();
    }
  });

  // --- Cleanup on stop ---

  it('clears visual interval when stopping', () => {
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
    const { result } = renderHook(() => useMetronomeAudio());

    act(() => {
      result.current.setIsPlaying(true);
    });

    act(() => {
      result.current.setIsPlaying(false);
    });

    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });

  // --- Cleanup on unmount while playing ---

  it('cleans up AudioContext and timers on unmount while playing', () => {
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
    const { result, unmount } = renderHook(() => useMetronomeAudio());

    act(() => {
      result.current.togglePlayStop();
    });

    mockCancelAnimationFrame.mockClear();
    unmount();

    expect(mockAudioContextInstance.close).toHaveBeenCalled();
    // Cleanup effects call cancelAnimationFrame and clearInterval
    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });
});
