'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { BPM, TIME_SIGNATURE, AUDIO, ANIMATION } from '../lib/constants';

export type MetronomeSound = 'default' | 'wood' | 'cowbell';

interface UseMetronomeAudioOptions {
  initialBpm?: number;
  initialTimeSignature?: string;
  sound?: MetronomeSound;
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
  beatsPerMeasure: number;
  handleBpmChange: (newBpm: number) => void;
  togglePlayStop: () => void;
}

export function useMetronomeAudio(options: UseMetronomeAudioOptions = {}): UseMetronomeAudioReturn {
  const { initialBpm = BPM.DEFAULT, initialTimeSignature = TIME_SIGNATURE.DEFAULT, sound = 'default' } = options;

  const [bpm, setBpm] = useState(initialBpm);
  const [timeSignature, setTimeSignature] = useState(initialTimeSignature);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [isBeating, setIsBeating] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const nextNoteTimeRef = useRef<number>(0);
  const scheduleAheadTimeRef = useRef<number>(AUDIO.SCHEDULE_AHEAD_TIME);
  const currentBeatRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const schedulerRef = useRef<(() => void) | undefined>(undefined);
  const mutedRef = useRef<boolean>(false);
  const soundRef = useRef<MetronomeSound>(sound);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update muted ref when muted state changes
  useEffect(() => {
    mutedRef.current = isMuted;
  }, [isMuted]);

  // Create default sine click
  const createDefaultClick = useCallback((ctx: AudioContext, isAccent: boolean, scheduledTime: number) => {
    if (mutedRef.current) return;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.frequency.value = isAccent ? AUDIO.FREQUENCY.ACCENT : AUDIO.FREQUENCY.REGULAR;
    oscillator.type = 'sine';

    const targetGain = isAccent ? 1 : 0.7;

    gainNode.gain.setValueAtTime(0, scheduledTime);
    gainNode.gain.linearRampToValueAtTime(targetGain, scheduledTime + 0.001);
    gainNode.gain.exponentialRampToValueAtTime(0.01, scheduledTime + AUDIO.CLICK_DURATION);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(scheduledTime);
    oscillator.stop(scheduledTime + AUDIO.CLICK_DURATION);
  }, []);

  // Create wood block sound: noise burst through bandpass filter
  const createWoodClick = useCallback((ctx: AudioContext, isAccent: boolean, scheduledTime: number) => {
    if (mutedRef.current) return;
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
    const targetGain = isAccent ? 1.2 : 0.8;

    gainNode.gain.setValueAtTime(targetGain, scheduledTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, scheduledTime + 0.06);

    source.connect(bandpass);
    bandpass.connect(gainNode);
    gainNode.connect(ctx.destination);

    source.start(scheduledTime);
    source.stop(scheduledTime + 0.06);
  }, []);

  // Create cowbell sound: two detuned triangle oscillators with warm filtering
  const createCowbellClick = useCallback((ctx: AudioContext, isAccent: boolean, scheduledTime: number) => {
    if (mutedRef.current) return;
    const targetGain = isAccent ? 0.6 : 0.4;

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
  }, []);

  // Schedule next note
  const scheduleNote = useCallback(
    (beatNumber: number, time: number) => {
      const ctx = audioContextRef.current;
      if (!ctx) return;

      const isAccent = beatNumber === 0;
      const currentSound = soundRef.current;

      switch (currentSound) {
        case 'wood':
          createWoodClick(ctx, isAccent, time);
          break;
        case 'cowbell':
          createCowbellClick(ctx, isAccent, time);
          break;
        default:
          createDefaultClick(ctx, isAccent, time);
          break;
      }
    },
    [createDefaultClick, createWoodClick, createCowbellClick]
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
      setTimeout(() => setIsBeating(false), ANIMATION.BEAT_INDICATOR_MS);

      visualIntervalRef.current = setInterval(() => {
        visualBeatRef.current = (visualBeatRef.current + 1) % beats;
        setCurrentBeat(visualBeatRef.current);
        setIsBeating(true);
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
    beatsPerMeasure,
    handleBpmChange,
    togglePlayStop
  };
}
