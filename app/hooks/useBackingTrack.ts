'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Attachment } from '../types';
import { getCachedBlob } from '../lib/offline-cache';
import { scheduleClick, type MetronomeSound } from '../lib/audio-clicks';
import { AUDIO, ANIMATION } from '../lib/constants';

interface UseBackingTrackOptions {
  songId: string | null;
  attachments: Attachment[];
  metronomeSound?: MetronomeSound;
}

interface UseBackingTrackReturn {
  track: Attachment | null;
  audioUrl: string | null;
  isPlaying: boolean;
  isCountingIn: boolean;
  currentTime: number;
  duration: number;
  buffered: number; // seconds buffered
  volume: number;
  currentBeat: number;
  isBeating: boolean;
  beatsPerMeasure: number;
  play: (countInBars: number, bpm: number, timeSignature: string) => void;
  pause: () => void;
  stop: () => void;
  seek: (time: number) => void;
  setVolume: (vol: number) => void;
}

export function useBackingTrack({
  songId,
  attachments,
  metronomeSound = 'default',
}: UseBackingTrackOptions): UseBackingTrackReturn {
  const track = attachments.find(a => a.type === 'audio') ?? null;

  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isCountingIn, setIsCountingIn] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolumeState] = useState<number>(AUDIO.DEFAULT_VOLUME);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [isBeating, setIsBeating] = useState(false);
  const [beatsPerMeasure, setBeatsPerMeasure] = useState(4);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const countInTimerRef = useRef<number | null>(null);
  const countInCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const metronomeSoundRef = useRef(metronomeSound);

  // Keep sound ref in sync
  useEffect(() => {
    metronomeSoundRef.current = metronomeSound;
  }, [metronomeSound]);

  // Create Audio element once
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, []);

  // Resolve audio URL when track changes
  useEffect(() => {
    let cancelled = false;

    const resolveUrl = async () => {
      // Clean up previous blob URL
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }

      if (!track) {
        setAudioUrl(null);
        return;
      }

      // Try offline cache first
      const cached = await getCachedBlob(track.id);
      if (cancelled) return;

      if (cached) {
        const url = URL.createObjectURL(cached);
        blobUrlRef.current = url;
        setAudioUrl(url);
        return;
      }

      // Fall back to storage URL
      if (track.storageUrl) {
        setAudioUrl(track.storageUrl);
      } else {
        setAudioUrl(null);
      }
    };

    resolveUrl();

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-resolve when track identity or URL changes
  }, [track?.id, track?.storageUrl]);

  // Set audio source when URL changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audioUrl) {
      audio.src = audioUrl;
      audio.volume = volume;
      audio.load();
    } else {
      audio.src = '';
    }

    // Reset state
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setIsCountingIn(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-set source when URL changes, not volume
  }, [audioUrl]);

  // Wire audio events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoadedMetadata = () => {
      setDuration(audio.duration || 0);
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      audio.currentTime = 0;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };

    const onError = () => {
      console.warn('[useBackingTrack] Audio error:', audio.error);
      setIsPlaying(false);
    };

    const onProgress = () => {
      if (audio.buffered.length > 0) {
        setBuffered(audio.buffered.end(audio.buffered.length - 1));
      }
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    audio.addEventListener('progress', onProgress);

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('progress', onProgress);
    };
  }, []);

  // Time update via requestAnimationFrame (smoother than ontimeupdate)
  useEffect(() => {
    if (isPlaying && !isCountingIn) {
      const tick = () => {
        const audio = audioRef.current;
        if (audio && !audio.paused) {
          setCurrentTime(audio.currentTime);
          // Read buffered end position
          if (audio.buffered.length > 0) {
            setBuffered(audio.buffered.end(audio.buffered.length - 1));
          }
          animFrameRef.current = requestAnimationFrame(tick);
        }
      };
      animFrameRef.current = requestAnimationFrame(tick);
    } else {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    }

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [isPlaying, isCountingIn]);

  // Clean up on song change
  useEffect(() => {
    return () => {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
      setIsPlaying(false);
      setIsCountingIn(false);
      setCurrentTime(0);
      if (countInTimerRef.current) {
        clearTimeout(countInTimerRef.current);
        countInTimerRef.current = null;
      }
      if (countInCtxRef.current) {
        countInCtxRef.current.close();
        countInCtxRef.current = null;
      }
    };
  }, [songId]);

  // Clean up blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    };
  }, []);

  const play = useCallback((countInBars: number, bpm: number, timeSignature: string) => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;

    const beats = parseInt(timeSignature.split('/')[0]) || 4;
    setBeatsPerMeasure(beats);

    if (countInBars <= 0) {
      // No count-in, play immediately
      audio.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.warn('[useBackingTrack] Play failed:', err);
      });
      return;
    }

    // Count-in with Web Audio API clicks
    setIsCountingIn(true);
    setIsPlaying(true);

    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioContextClass();
    countInCtxRef.current = ctx;

    const totalBeats = countInBars * beats;
    const secondsPerBeat = 60.0 / bpm;

    // Schedule all count-in clicks
    for (let i = 0; i < totalBeats; i++) {
      const time = ctx.currentTime + i * secondsPerBeat;
      const beatInMeasure = i % beats;
      scheduleClick(ctx, beatInMeasure, time, metronomeSoundRef.current, false);
    }

    // Visual beat indicator during count-in
    let beatIndex = 0;
    setCurrentBeat(0);
    setIsBeating(true);
    setTimeout(() => setIsBeating(false), ANIMATION.BEAT_INDICATOR_MS);

    const beatInterval = setInterval(() => {
      beatIndex++;
      if (beatIndex >= totalBeats) {
        clearInterval(beatInterval);
        return;
      }
      setCurrentBeat(beatIndex % beats);
      setIsBeating(true);
      setTimeout(() => setIsBeating(false), ANIMATION.BEAT_INDICATOR_MS);
    }, secondsPerBeat * 1000);

    // Start playback after count-in duration
    const countInDuration = totalBeats * secondsPerBeat * 1000;
    countInTimerRef.current = window.setTimeout(() => {
      clearInterval(beatInterval);
      setIsCountingIn(false);
      setCurrentBeat(0);
      setIsBeating(false);
      ctx.close();
      countInCtxRef.current = null;

      audio.currentTime = 0;
      audio.play().catch(err => {
        console.warn('[useBackingTrack] Play after count-in failed:', err);
        setIsPlaying(false);
      });
    }, countInDuration);
  }, [audioUrl]);

  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // If counting in, cancel everything
    if (countInTimerRef.current) {
      clearTimeout(countInTimerRef.current);
      countInTimerRef.current = null;
    }
    if (countInCtxRef.current) {
      countInCtxRef.current.close();
      countInCtxRef.current = null;
    }
    setIsCountingIn(false);

    audio.pause();
    setIsPlaying(false);
  }, []);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Cancel count-in if active
    if (countInTimerRef.current) {
      clearTimeout(countInTimerRef.current);
      countInTimerRef.current = null;
    }
    if (countInCtxRef.current) {
      countInCtxRef.current.close();
      countInCtxRef.current = null;
    }
    setIsCountingIn(false);

    audio.pause();
    audio.currentTime = 0;
    setCurrentTime(0);
    setIsPlaying(false);
  }, []);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = time;
    setCurrentTime(time);
  }, []);

  const setVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    setVolumeState(clamped);
    const audio = audioRef.current;
    if (audio) {
      audio.volume = clamped;
    }
  }, []);

  return {
    track,
    audioUrl,
    isPlaying,
    isCountingIn,
    currentTime,
    duration,
    buffered,
    volume,
    currentBeat,
    isBeating,
    beatsPerMeasure,
    play,
    pause,
    stop,
    seek,
    setVolume,
  };
}
