'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { BPM, TIME_SIGNATURE, AUDIO, ANIMATION } from '../lib/constants';

interface UseMetronomeAudioOptions {
  initialBpm?: number;
  initialTimeSignature?: string;
  initialVolume?: number;
}

interface UseMetronomeAudioReturn {
  bpm: number;
  setBpm: (bpm: number) => void;
  timeSignature: string;
  setTimeSignature: (ts: string) => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  currentBeat: number;
  isBeating: boolean;
  volume: number;
  setVolume: (volume: number) => void;
  beatsPerMeasure: number;
  handleBpmChange: (newBpm: number) => void;
  togglePlayStop: () => void;
}

export function useMetronomeAudio(options: UseMetronomeAudioOptions = {}): UseMetronomeAudioReturn {
  const { initialBpm = BPM.DEFAULT, initialTimeSignature = TIME_SIGNATURE.DEFAULT, initialVolume = AUDIO.DEFAULT_VOLUME } = options;

  const [bpm, setBpm] = useState(initialBpm);
  const [timeSignature, setTimeSignature] = useState(initialTimeSignature);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [isBeating, setIsBeating] = useState(false);
  const [volume, setVolume] = useState(initialVolume);

  const audioContextRef = useRef<AudioContext | null>(null);
  const nextNoteTimeRef = useRef<number>(0);
  const scheduleAheadTimeRef = useRef<number>(AUDIO.SCHEDULE_AHEAD_TIME);
  const currentBeatRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const schedulerRef = useRef<(() => void) | undefined>(undefined);
  const volumeRef = useRef<number>(initialVolume);

  const beatsPerMeasure = parseInt(timeSignature.split('/')[0]) || 4;

  // Sync with props when they change
  useEffect(() => {
    setBpm(initialBpm);
  }, [initialBpm]);

  useEffect(() => {
    setTimeSignature(initialTimeSignature);
  }, [initialTimeSignature]);

  // Initialize audio context
  useEffect(() => {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioContextRef.current = new AudioContextClass();
    volumeRef.current = volume;

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update volume ref when volume state changes
  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  // Create click sound
  const createClickSound = useCallback((isAccent: boolean, scheduledTime: number) => {
    if (!audioContextRef.current) return null;

    const ctx = audioContextRef.current;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.frequency.value = isAccent ? AUDIO.FREQUENCY.ACCENT : AUDIO.FREQUENCY.REGULAR;
    oscillator.type = 'sine';

    const currentVolume = volumeRef.current;
    const targetGain = currentVolume * (isAccent ? 1 : 0.7);

    gainNode.gain.setValueAtTime(0, scheduledTime);
    gainNode.gain.linearRampToValueAtTime(targetGain, scheduledTime + 0.001);
    gainNode.gain.exponentialRampToValueAtTime(0.01, scheduledTime + AUDIO.CLICK_DURATION);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    return { oscillator, gainNode };
  }, []);

  // Schedule next note
  const scheduleNote = useCallback(
    (beatNumber: number, time: number) => {
      const isAccent = beatNumber === 0;
      const sound = createClickSound(isAccent, time);

      if (sound) {
        sound.oscillator.start(time);
        sound.oscillator.stop(time + AUDIO.CLICK_DURATION);
      }
    },
    [createClickSound]
  );

  // Scheduler loop
  useEffect(() => {
    const scheduler = () => {
      if (!audioContextRef.current || !isPlaying) return;

      const ctx = audioContextRef.current;
      const currentTime = ctx.currentTime;
      const secondsPerBeat = 60.0 / bpm;
      const beats = parseInt(timeSignature.split('/')[0]) || 4;

      while (nextNoteTimeRef.current < currentTime + scheduleAheadTimeRef.current) {
        scheduleNote(currentBeatRef.current, nextNoteTimeRef.current);

        setCurrentBeat(currentBeatRef.current);
        setIsBeating(true);
        setTimeout(() => setIsBeating(false), ANIMATION.BEAT_INDICATOR_MS);

        nextNoteTimeRef.current += secondsPerBeat;
        currentBeatRef.current = (currentBeatRef.current + 1) % beats;
      }

      if (schedulerRef.current) {
        animationFrameRef.current = requestAnimationFrame(schedulerRef.current);
      }
    };

    schedulerRef.current = scheduler;
  }, [isPlaying, bpm, timeSignature, scheduleNote]);

  // Start/stop metronome
  useEffect(() => {
    if (isPlaying) {
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
      }

      const ctx = audioContextRef.current;
      if (ctx && schedulerRef.current) {
        nextNoteTimeRef.current = ctx.currentTime + AUDIO.SCHEDULE_AHEAD_TIME;
        currentBeatRef.current = 0;
        animationFrameRef.current = requestAnimationFrame(schedulerRef.current);
      }
    } else {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      currentBeatRef.current = 0;
    }

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying]);

  const handleBpmChange = useCallback((newBpm: number) => {
    const clampedBpm = Math.max(BPM.MIN, Math.min(BPM.MAX, newBpm));
    setBpm(clampedBpm);
  }, []);

  const togglePlayStop = useCallback(() => {
    if (isPlaying) {
      setCurrentBeat(0);
      setIsBeating(false);
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  return {
    bpm,
    setBpm,
    timeSignature,
    setTimeSignature,
    isPlaying,
    setIsPlaying,
    currentBeat,
    isBeating,
    volume,
    setVolume,
    beatsPerMeasure,
    handleBpmChange,
    togglePlayStop
  };
}
