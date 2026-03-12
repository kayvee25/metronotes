'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { BPM, TIME_SIGNATURE, AUDIO, ANIMATION } from '../lib/constants';
import { scheduleClick, type MetronomeSound } from '../lib/audio-clicks';

export type { MetronomeSound };

interface UseMetronomeAudioOptions {
  initialBpm?: number;
  initialTimeSignature?: string;
  sound?: MetronomeSound;
  onBeat?: (beatNumber: number) => void;
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
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
  volume: number;
  setVolume: (volume: number) => void;
  beatsPerMeasure: number;
  handleBpmChange: (newBpm: number) => void;
  togglePlayStop: () => void;
}

export function useMetronomeAudio(options: UseMetronomeAudioOptions = {}): UseMetronomeAudioReturn {
  const { initialBpm = BPM.DEFAULT, initialTimeSignature = TIME_SIGNATURE.DEFAULT, sound = 'default', onBeat } = options;

  const [bpm, setBpm] = useState(initialBpm);
  const [timeSignature, setTimeSignature] = useState(initialTimeSignature);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [isBeating, setIsBeating] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);

  const audioContextRef = useRef<AudioContext | null>(null);
  const nextNoteTimeRef = useRef<number>(0);
  const scheduleAheadTimeRef = useRef<number>(AUDIO.SCHEDULE_AHEAD_TIME);
  const currentBeatRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const schedulerRef = useRef<(() => void) | undefined>(undefined);
  const mutedRef = useRef<boolean>(false);
  const volumeRef = useRef<number>(1);
  const soundRef = useRef<MetronomeSound>(sound);
  const onBeatRef = useRef(onBeat);

  const beatsPerMeasure = parseInt(timeSignature.split('/')[0]) || 4;

  // Sync with props when they change
  useEffect(() => {
    setBpm(initialBpm);
  }, [initialBpm]);

  useEffect(() => {
    setTimeSignature(initialTimeSignature);
  }, [initialTimeSignature]);

  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);

  useEffect(() => {
    onBeatRef.current = onBeat;
  }, [onBeat]);

  // Initialize audio context
  useEffect(() => {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioContextRef.current = new AudioContextClass();

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Update muted/volume refs when state changes
  useEffect(() => {
    mutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  // Schedule next note using extracted audio-clicks module
  const scheduleNote = useCallback(
    (beatNumber: number, time: number) => {
      const ctx = audioContextRef.current;
      if (!ctx) return;
      scheduleClick(ctx, beatNumber, time, soundRef.current, mutedRef.current, volumeRef.current);
    },
    []
  );

  // Audio scheduler — runs via requestAnimationFrame, schedules audio ahead of time
  useEffect(() => {
    const scheduler = () => {
      if (!audioContextRef.current || !isPlaying) return;

      const ctx = audioContextRef.current;
      const currentTime = ctx.currentTime;
      const secondsPerBeat = 60.0 / bpm;
      const beats = parseInt(timeSignature.split('/')[0]) || 4;

      while (nextNoteTimeRef.current < currentTime + scheduleAheadTimeRef.current) {
        scheduleNote(currentBeatRef.current, nextNoteTimeRef.current);
        nextNoteTimeRef.current += secondsPerBeat;
        currentBeatRef.current = (currentBeatRef.current + 1) % beats;
      }

      if (schedulerRef.current) {
        animationFrameRef.current = requestAnimationFrame(schedulerRef.current);
      }
    };

    schedulerRef.current = scheduler;
  }, [isPlaying, bpm, timeSignature, scheduleNote]);

  // Visual beat indicator — runs on a simple interval synced to BPM
  const visualBeatRef = useRef<number>(0);
  const visualIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isPlaying) {
      const beats = parseInt(timeSignature.split('/')[0]) || 4;
      const intervalMs = 60000 / bpm;

      visualBeatRef.current = 0;
      setCurrentBeat(0);
      setIsBeating(true);
      onBeatRef.current?.(0);
      setTimeout(() => setIsBeating(false), ANIMATION.BEAT_INDICATOR_MS);

      visualIntervalRef.current = setInterval(() => {
        visualBeatRef.current = (visualBeatRef.current + 1) % beats;
        setCurrentBeat(visualBeatRef.current);
        setIsBeating(true);
        onBeatRef.current?.(visualBeatRef.current);
        setTimeout(() => setIsBeating(false), ANIMATION.BEAT_INDICATOR_MS);
      }, intervalMs);
    } else {
      if (visualIntervalRef.current !== null) {
        clearInterval(visualIntervalRef.current);
        visualIntervalRef.current = null;
      }
    }

    return () => {
      if (visualIntervalRef.current !== null) {
        clearInterval(visualIntervalRef.current);
      }
    };
  }, [isPlaying, bpm, timeSignature]);

  // Start/stop metronome audio
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
    isMuted,
    setIsMuted,
    volume,
    setVolume,
    beatsPerMeasure,
    handleBpmChange,
    togglePlayStop
  };
}
