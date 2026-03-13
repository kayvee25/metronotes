'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Attachment } from '../types';
import { getCachedBlob } from '../lib/offline-cache';
import { fetchCloudBlob } from '../lib/cloud-providers/fetch-cloud-blob';
import { isCloudLinked } from '../lib/cloud-providers/types';
import { AUDIO } from '../lib/constants';

interface UseBackingTrackOptions {
  songId: string | null;
  attachments: Attachment[];
  onError?: (message: string) => void;
}

interface UseBackingTrackReturn {
  track: Attachment | null;
  audioUrl: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  buffered: number; // seconds buffered
  volume: number;
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (time: number) => void;
  setVolume: (vol: number) => void;
}

export function useBackingTrack({
  songId,
  attachments,
  onError,
}: UseBackingTrackOptions): UseBackingTrackReturn {
  const track = attachments.find(a => a.type === 'audio') ?? null;

  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolumeState] = useState<number>(AUDIO.DEFAULT_VOLUME);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const onErrorRef = useRef(onError);

  // Keep refs in sync
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

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
        return;
      }

      // Try fetching from cloud provider
      if (isCloudLinked(track)) {
        try {
          const blob = await fetchCloudBlob(track.cloudProvider!, track.cloudFileId!, track.id);
          if (cancelled) return;
          const url = URL.createObjectURL(blob);
          blobUrlRef.current = url;
          setAudioUrl(url);
        } catch {
          // Silent auth not available — user needs to interact with Drive first
          if (!cancelled) setAudioUrl(null);
        }
        return;
      }

      setAudioUrl(null);
    };

    resolveUrl();

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-resolve when track identity or URL changes
  }, [track?.id, track?.storageUrl, track?.cloudFileId]);

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

    const onAudioError = () => {
      // Ignore errors when no real source is set (e.g. clearing src to '')
      if (!audio.src || audio.src === window.location.href) return;
      console.warn('[useBackingTrack] Audio error:', audio.error);
      setIsPlaying(false);
      const code = audio.error?.code;
      if (code === MediaError.MEDIA_ERR_NETWORK) {
        onErrorRef.current?.('Network error — check your connection');
      } else if (code === MediaError.MEDIA_ERR_DECODE) {
        onErrorRef.current?.('Could not play this audio file');
      } else if (code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
        onErrorRef.current?.('Audio format not supported');
      } else {
        onErrorRef.current?.('Playback error');
      }
    };

    const onProgress = () => {
      if (audio.buffered.length > 0) {
        setBuffered(audio.buffered.end(audio.buffered.length - 1));
      }
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onAudioError);
    audio.addEventListener('progress', onProgress);

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onAudioError);
      audio.removeEventListener('progress', onProgress);
    };
  }, []);

  // Time update via requestAnimationFrame (smoother than ontimeupdate)
  useEffect(() => {
    if (isPlaying) {
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
  }, [isPlaying]);

  // Clean up on song change
  useEffect(() => {
    return () => {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
      setIsPlaying(false);
      setCurrentTime(0);
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

  const play = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;

    audio.play().then(() => {
      setIsPlaying(true);
    }).catch(err => {
      console.warn('[useBackingTrack] Play failed:', err);
      onErrorRef.current?.('Could not start playback');
    });
  }, [audioUrl]);

  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    setIsPlaying(false);
  }, []);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
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
    currentTime,
    duration,
    buffered,
    volume,
    play,
    pause,
    stop,
    seek,
    setVolume,
  };
}
