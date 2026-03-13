'use client';

import { useState, useEffect, useRef } from 'react';
import { useConfirm } from './ui/ConfirmModal';
import { Setlist, Song, Attachment } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useToast } from './ui/Toast';
import { useOfflineDownload } from '../hooks/useOfflineDownload';
import { firestoreGetAttachments } from '../lib/firestore';
import { areAttachmentsCached } from '../lib/offline-cache';
import SongPicker from './SongPicker';
import SongDownloadIcon from './ui/SongDownloadIcon';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SetlistDetailProps {
  setlist: Setlist;
  songs: Song[];
  onBack: () => void;
  onPlay?: (setlist: Setlist, startIndex?: number) => void;
  updateSetlist: (id: string, update: { songIds: string[] }) => Promise<Setlist | null>;
  removeSongFromSetlist: (setlistId: string, songId: string) => Promise<Setlist | null>;
  reorderSongs: (setlistId: string, songIds: string[]) => Promise<Setlist | null>;
}

interface SortableSongItemProps {
  song: Song;
  index: number;
  onPlay: () => void;
  onRemove: () => void;
}

function SortableSongItem({ song, index, onPlay, onRemove }: SortableSongItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: song.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : 0,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 flex items-center gap-3 ${
        isDragging ? 'shadow-lg' : ''
      }`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="w-8 h-8 rounded-lg hover:bg-[var(--border)] flex items-center justify-center flex-shrink-0 cursor-grab active:cursor-grabbing touch-none"
        aria-label="Drag to reorder"
      >
        <svg
          className="w-5 h-5 text-[var(--muted)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h16M4 16h16" />
        </svg>
      </button>

      {/* Order number */}
      <div className="w-7 h-7 rounded-lg bg-[var(--border)] flex items-center justify-center flex-shrink-0">
        <span className="text-sm font-bold text-[var(--muted)]">{index + 1}</span>
      </div>

      {/* Song info */}
      <button
        onClick={onPlay}
        className="flex-1 text-left min-w-0"
      >
        <h3 className="font-medium text-[var(--foreground)] truncate">{song.name}</h3>
        <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
          <span className="font-mono">{song.bpm} BPM</span>
          <span>•</span>
          <span>{song.timeSignature}</span>
          {song.key && (
            <>
              <span>•</span>
              <span>{song.key}</span>
            </>
          )}
        </div>
      </button>

      {/* Download icon */}
      <SongDownloadIcon songId={song.id} />

      {/* Remove button */}
      <button
        onClick={onRemove}
        className="w-8 h-8 rounded-lg hover:bg-[var(--accent-danger)]/10 flex items-center justify-center transition-colors flex-shrink-0"
        aria-label="Remove from setlist"
      >
        <svg
          className="w-4 h-4 text-[var(--muted)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export default function SetlistDetail({ setlist, songs, onBack, onPlay, updateSetlist, removeSongFromSetlist, reorderSongs }: SetlistDetailProps) {
  const { toast } = useToast();
  const [showSongPicker, setShowSongPicker] = useState(false);
  const { user, authState } = useAuth();
  const isGuest = authState === 'guest';
  const { status: dlStatus, progress: dlProgress, downloadAttachments, errorMessage: dlError } = useOfflineDownload();
  const [allCached, setAllCached] = useState<boolean | null>(null);

  // Use the setlist prop directly — parent keeps it in sync
  const currentSetlist = setlist;

  // Get songs in setlist order
  const setlistSongs = currentSetlist.songIds
    .map((id) => songs.find((s) => s.id === id))
    .filter((s): s is Song => s !== undefined);

  // Configure sensors for both pointer and touch
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement before drag starts
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200, // 200ms hold before drag starts on touch
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleAddSongs = async (songIds: string[]) => {
    const newSongIds = [...currentSetlist.songIds, ...songIds.filter((id) => !currentSetlist.songIds.includes(id))];
    await updateSetlist(currentSetlist.id, { songIds: newSongIds });
    setShowSongPicker(false);
  };

  const confirmAction = useConfirm();

  const handleRemoveSong = async (songId: string) => {
    const song = songs.find(s => s.id === songId);
    const songName = song?.name || 'this song';
    const ok = await confirmAction({
      title: 'Remove Song',
      message: `Remove "${songName}" from this setlist?`,
      confirmLabel: 'Remove',
      variant: 'danger',
    });
    if (ok) await removeSongFromSetlist(currentSetlist.id, songId);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = currentSetlist.songIds.indexOf(active.id as string);
      const newIndex = currentSetlist.songIds.indexOf(over.id as string);
      const newSongIds = arrayMove(currentSetlist.songIds, oldIndex, newIndex);
      reorderSongs(currentSetlist.id, newSongIds); // fire-and-forget for drag UX
    }
  };

  const handlePlayFromSong = (index: number) => {
    if (onPlay) {
      onPlay(currentSetlist, index);
    }
  };

  // Check if all setlist media is cached
  useEffect(() => {
    if (isGuest || !user) return;
    const songIds = currentSetlist.songIds;

    let cancelled = false;

    (async () => {
      if (songIds.length === 0) {
        if (!cancelled) setAllCached(null);
        return;
      }
      try {
        const allAttachments: Attachment[] = [];
        for (const songId of songIds) {
          const atts = await firestoreGetAttachments(user.uid, songId);
          allAttachments.push(...atts);
        }
        if (cancelled) return;
        const cached = await areAttachmentsCached(allAttachments);
        const hasMedia = allAttachments.some(a => (a.type === 'image' || a.type === 'pdf') && (a.storageUrl || (a.cloudProvider && a.cloudFileId)));
        if (!cancelled) setAllCached(hasMedia ? cached : null);
      } catch {
        if (!cancelled) setAllCached(null);
      }
    })();

    return () => { cancelled = true; };
  }, [isGuest, user, currentSetlist.songIds, dlStatus]);

  const handleDownloadSetlist = async () => {
    if (!user || isGuest) return;

    const allAttachments: Attachment[] = [];
    for (const songId of currentSetlist.songIds) {
      try {
        const atts = await firestoreGetAttachments(user.uid, songId);
        allAttachments.push(...atts);
      } catch {
        // skip songs we can't fetch
      }
    }
    await downloadAttachments(allAttachments);
  };

  // Toast on download completion
  const prevDlStatus = useRef(dlStatus);
  useEffect(() => {
    if (prevDlStatus.current === 'downloading' && dlStatus === 'done') {
      toast('Downloaded for offline', 'success');
    } else if (prevDlStatus.current === 'downloading' && dlStatus === 'error') {
      toast(dlError || 'Download failed — check your connection');
    }
    prevDlStatus.current = dlStatus;
  }, [dlStatus, dlError, toast]);

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto w-full">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-xl hover:bg-[var(--card)] active:scale-95 transition-all flex items-center justify-center"
          aria-label="Back"
        >
          <svg
            className="w-6 h-6 text-[var(--foreground)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-[var(--foreground)]">{currentSetlist.name}</h1>
          <p className="text-sm text-[var(--muted)]">{setlistSongs.length} songs</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Download for offline */}
          {!isGuest && allCached !== null && (
            <button
              onClick={allCached ? undefined : handleDownloadSetlist}
              disabled={dlStatus === 'downloading'}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-95 ${
                allCached
                  ? 'text-green-500'
                  : dlStatus === 'downloading'
                    ? 'text-[var(--accent)]'
                    : 'text-[var(--muted)] hover:bg-[var(--card)]'
              }`}
              aria-label={allCached ? 'Downloaded for offline' : 'Download for offline'}
              title={
                dlStatus === 'downloading'
                  ? `${dlProgress.done}/${dlProgress.total} files`
                  : allCached
                    ? 'Available offline'
                    : 'Download for offline'
              }
            >
              {dlStatus === 'downloading' ? (
                <div className="relative">
                  <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={3} opacity={0.25} />
                    <path d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
                  </svg>
                  <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[10px] font-mono whitespace-nowrap">
                    {dlProgress.done}/{dlProgress.total}
                  </span>
                </div>
              ) : allCached ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75l2.25 2.25L15 11.25" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75v6.75m0 0l-3-3m3 3l3-3m-8.25 6a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                </svg>
              )}
            </button>
          )}
          {setlistSongs.length > 0 && onPlay && (
            <button
              onClick={() => handlePlayFromSong(0)}
              className="px-4 py-2 rounded-xl bg-[var(--accent)] hover:brightness-110 active:scale-95 transition-all flex items-center gap-2"
            >
              <svg
                className="w-5 h-5 text-white"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
              <span className="text-white font-semibold">Play</span>
            </button>
          )}
        </div>
      </header>

      {/* Song List */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-20">
        {setlistSongs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <svg
              className="w-16 h-16 text-[var(--muted)] mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
              />
            </svg>
            <p className="text-[var(--muted)] mb-4">No songs in this setlist</p>
            <button
              onClick={() => setShowSongPicker(true)}
              className="px-4 py-2 bg-[var(--accent)] text-white rounded-xl font-medium hover:brightness-110 active:scale-95 transition-all"
            >
              Add songs
            </button>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={setlistSongs.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {setlistSongs.map((song, index) => (
                  <SortableSongItem
                    key={song.id}
                    song={song}
                    index={index}
                    onPlay={() => handlePlayFromSong(index)}
                    onRemove={() => handleRemoveSong(song.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Add Songs Button */}
      {songs.length > 0 && (
        <div className="px-4 pb-20">
          <button
            onClick={() => setShowSongPicker(true)}
            className="w-full h-12 rounded-xl bg-[var(--card)] border border-[var(--border)] hover:bg-[var(--border)] text-[var(--foreground)] font-medium transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Songs
          </button>
        </div>
      )}

      {/* Song Picker Modal */}
      {showSongPicker && (
        <SongPicker
          songs={songs}
          existingSongIds={currentSetlist.songIds}
          onSelect={handleAddSongs}
          onCancel={() => setShowSongPicker(false)}
        />
      )}
    </div>
  );
}
