'use client';

import { useState, useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import { Song, SongInput, Setlist, Attachment, DrawingData, AnnotationLayer } from '../types';
import { useMetronomeAudio, MetronomeSound } from '../hooks/useMetronomeAudio';
import { useBackingTrack } from '../hooks/useBackingTrack';
import { useAttachments } from '../hooks/useAttachments';
import { useAuth } from '../hooks/useAuth';
import { useToast } from './ui/Toast';
import { migrateNotesToAttachment } from '../lib/migration';
import { compressImage, validateFileSize, validateSongStorage } from '../lib/image-processing';
import { saveGuestBlob, deleteGuestBlob, getGuestBlob } from '../lib/guest-blob-storage';
import { validateAudioFile, extractAudioDuration } from '../lib/audio-processing';
import { uploadAttachmentFile, getStoragePath } from '../lib/storage-firebase';
import { loadPdfJs } from '../lib/pdf-loader';
import { preloadAudio } from '../lib/offline-cache';
import { firestoreGetAttachments } from '../lib/firestore';
import { BPM, TIME_SIGNATURE } from '../lib/constants';
import { useCloudProvider } from '../hooks/useCloudProvider';
import { cloudMimeToAttachmentType, isCloudLinked } from '../lib/cloud-providers/types';
import type { CloudProviderId } from '../lib/cloud-providers/types';
import PerformanceMode from './song/PerformanceMode';
import EditMode from './song/EditMode';
import TimeSignatureModal from './song/TimeSignatureModal';
import SaveSongModal from './song/SaveSongModal';
import RichTextEditor from './song/RichTextEditor';
import DrawingCanvas from './song/DrawingCanvas';
import AnnotationOverlay from './song/AnnotationOverlay';
import PdfAnnotationOverlay from './song/PdfAnnotationOverlay';
import { useCachedUrl } from '../hooks/useCachedUrl';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

type Mode = 'performance' | 'edit';

/** Resolves attachment URL (handles cloud-linked files) and renders AnnotationOverlay */
function ResolvedAnnotationOverlay({ attachment, onSave, onCancel }: {
  attachment: Attachment;
  onSave: (annotations: AnnotationLayer) => void;
  onCancel: () => void;
}) {
  const isOnline = useOnlineStatus();
  const cloud = isCloudLinked(attachment)
    ? { provider: attachment.cloudProvider!, fileId: attachment.cloudFileId! }
    : undefined;
  const { url, loading } = useCachedUrl(attachment.id, attachment.storageUrl || undefined, isOnline, cloud);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-[var(--background)] flex items-center justify-center">
        <svg className="w-6 h-6 text-[var(--muted)] animate-spin" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={3} opacity={0.25} />
          <path d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  if (!url) {
    return (
      <div className="fixed inset-0 z-50 bg-[var(--background)] flex flex-col items-center justify-center gap-3">
        <p className="text-[var(--muted)]">Image not available</p>
        <button onClick={onCancel} className="px-4 py-2 rounded-lg bg-[var(--card)] text-sm">Close</button>
      </div>
    );
  }

  return (
    <AnnotationOverlay
      isOpen={true}
      backgroundContent={
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={attachment.fileName || 'Image'}
          className="max-w-full max-h-full object-contain"
          style={{ width: attachment.width, height: attachment.height }}
        />
      }
      baseWidth={attachment.width || 800}
      baseHeight={attachment.height || 600}
      initialAnnotations={attachment.annotations}
      onSave={onSave}
      title={attachment.name || attachment.fileName || 'Annotate'}
    />
  );
}

/** Resolves attachment URL (handles cloud-linked files) and renders PdfAnnotationOverlay */
function ResolvedPdfAnnotationOverlay({ attachment, onSave, onCancel }: {
  attachment: Attachment;
  onSave: (pageAnnotations: Record<number, AnnotationLayer>) => void;
  onCancel: () => void;
}) {
  const isOnline = useOnlineStatus();
  const cloud = isCloudLinked(attachment)
    ? { provider: attachment.cloudProvider!, fileId: attachment.cloudFileId! }
    : undefined;
  const { url, loading } = useCachedUrl(attachment.id, attachment.storageUrl || undefined, isOnline, cloud);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-[var(--background)] flex items-center justify-center">
        <svg className="w-6 h-6 text-[var(--muted)] animate-spin" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={3} opacity={0.25} />
          <path d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  if (!url) {
    return (
      <div className="fixed inset-0 z-50 bg-[var(--background)] flex flex-col items-center justify-center gap-3">
        <p className="text-[var(--muted)]">PDF not available</p>
        <button onClick={onCancel} className="px-4 py-2 rounded-lg bg-[var(--card)] text-sm">Close</button>
      </div>
    );
  }

  return (
    <PdfAnnotationOverlay
      isOpen={true}
      storageUrl={url}
      pageCount={attachment.pageCount}
      initialPageAnnotations={attachment.pageAnnotations}
      onSave={onSave}
      title={attachment.name || attachment.fileName || 'Annotate PDF'}
    />
  );
}

/** Strip file extension to derive a clean display name */
function nameFromFile(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}


export type AudioMode = 'metronome' | 'backingtrack' | 'off';

export interface TransportState {
  bpm: number;
  timeSignature: string;
  isPlaying: boolean;
  currentBeat: number;
  isBeating: boolean;
  isMuted: boolean;
  audioMode: AudioMode;
  hasBackingTrack: boolean;
  audioAttachments: Attachment[];
  btIsPlaying: boolean;
  btCurrentTime: number;
  btDuration: number;
  btBuffered: number;
  btVolume: number;
  btActiveTrackId: string | null;
  metronomeVolume: number;
}

export interface SongViewHandle {
  save: () => void;
  togglePlay: () => void;
  changeBpm: (bpm: number) => void;
  toggleMute: () => void;
  changeAudioMode: (mode: AudioMode) => void;
  btPlay: () => void;
  btPause: () => void;
  btSeek: (time: number) => void;
  btSetVolume: (vol: number) => void;
  setMetronomeVolume: (vol: number) => void;
  switchToEdit: () => void;
  switchToPerformance: () => void;
  changeName: (name: string) => void;
  changeArtist: (artist: string) => void;
  getName: () => string;
  getArtist: () => string;
}

interface SongViewProps {
  song?: Song | null;
  onBack: () => void;
  onSave: (data: SongInput) => void;
  setlist?: Setlist | null;
  songIndex?: number;
  onPrevSong?: () => void;
  onNextSong?: () => void;
  showBack?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  initialEditMode?: boolean;
  perfFontSize?: string;
  perfFontFamily?: string;
  metronomeSound?: MetronomeSound;
  hidePerformanceHeader?: boolean;
  onTransportUpdate?: (state: TransportState) => void;
  onModeChange?: (mode: 'performance' | 'edit') => void;
  onBeat?: (beatNumber: number) => void;
  readOnly?: boolean;
  externalAttachments?: Attachment[];
}

interface FormState {
  name: string;
  artist: string;
  musicalKey: string;
  mode: Mode;
}

interface OriginalValues {
  name: string;
  artist: string;
  bpm: number;
  timeSignature: string;
  musicalKey: string;
  audioMode: AudioMode;
}

function getInitialFormState(song?: Song | null, initialEditMode?: boolean): FormState {
  if (song) {
    return {
      name: song.name,
      artist: song.artist || '',
      musicalKey: song.key || '',
      mode: initialEditMode ? 'edit' : 'performance'
    };
  }
  return { name: '', artist: '', musicalKey: '', mode: 'edit' };
}

function getOriginalValues(song?: Song | null): OriginalValues {
  return {
    name: song?.name || '',
    artist: song?.artist || '',
    bpm: song?.bpm || BPM.DEFAULT,
    timeSignature: song?.timeSignature || TIME_SIGNATURE.DEFAULT,
    musicalKey: song?.key || '',
    audioMode: song?.audioMode || 'metronome',
  };
}

const SongView = forwardRef<SongViewHandle, SongViewProps>(function SongView({
  song,
  onBack,
  onSave,
  setlist,
  songIndex = 0,
  onPrevSong,
  onNextSong,
  showBack = true,
  onDirtyChange,
  initialEditMode = false,
  perfFontSize,
  perfFontFamily,
  metronomeSound = 'default',
  hidePerformanceHeader = false,
  onTransportUpdate,
  onModeChange,
  onBeat,
  readOnly = false,
  externalAttachments,
}, ref) {
  const { authState, user } = useAuth();
  const { toast } = useToast();
  const [formState, setFormState] = useState<FormState>(() => getInitialFormState(song, initialEditMode));
  const [showTimeSigModal, setShowTimeSigModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [savedValues, setSavedValues] = useState<OriginalValues>(() => getOriginalValues(song));
  const migrationRef = useRef(false);
  const [isUploading, setIsUploading] = useState(false);
  const [audioMode, setAudioMode] = useState<AudioMode>(() => song?.audioMode || 'metronome');

  // Notify parent of initial mode
  const onModeChangeRef = useRef(onModeChange);
  onModeChangeRef.current = onModeChange;
  useEffect(() => {
    onModeChangeRef.current?.(formState.mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally run once on mount

  // Reset audioMode on song change
  const prevSongIdForAudioRef = useRef(song?.id);
  if (prevSongIdForAudioRef.current !== song?.id) {
    prevSongIdForAudioRef.current = song?.id;
    setAudioMode(song?.audioMode || 'metronome');
  }

  const {
    bpm,
    timeSignature,
    setTimeSignature,
    isPlaying,
    currentBeat,
    isBeating,
    isMuted,
    setIsMuted,
    volume: metronomeVolume,
    setVolume: setMetronomeVolume,
    handleBpmChange,
    togglePlayStop
  } = useMetronomeAudio({
    initialBpm: song?.bpm || BPM.DEFAULT,
    initialTimeSignature: song?.timeSignature || TIME_SIGNATURE.DEFAULT,
    sound: metronomeSound,
    onBeat,
  });

  const {
    attachments: hookAttachments,
    isLoading: hookAttachmentsLoading,
    addRichText,
    addImage,
    updateAttachment,
    updateAssetStorage,
    deleteAttachment,
    reorderAttachments,
    setDefault,
  } = useAttachments(externalAttachments ? null : (song?.id || null), toast);

  // Use external attachments (session member) or hook attachments (normal)
  const attachments = externalAttachments ?? hookAttachments;
  const attachmentsLoading = externalAttachments ? false : hookAttachmentsLoading;

  // Backing track playback
  const {
    play: btPlay, pause: btPause, stop: btStop, seek: btSeek, setVolume: btSetVolume,
    isPlaying: btIsPlaying,
    currentTime: btCurrentTime, duration: btDuration, buffered: btBuffered,
    volume: btVolume, track: btTrack,
  } = useBackingTrack({
    songId: song?.id || null,
    attachments,
    onError: toast,
  });

  // Preload next song's audio when in setlist mode
  useEffect(() => {
    if (!setlist || !user?.uid) return;
    const nextIndex = songIndex + 1;
    if (nextIndex >= setlist.songIds.length) return;
    const nextSongId = setlist.songIds[nextIndex];
    let cancelled = false;
    firestoreGetAttachments(user.uid, nextSongId).then(nextAttachments => {
      if (!cancelled) preloadAudio(nextAttachments);
    }).catch(() => { /* best-effort */ });
    return () => { cancelled = true; };
  }, [setlist, songIndex, user?.uid]);

  // Migrate plain-text notes to attachment on first load
  useEffect(() => {
    if (migrationRef.current || !song || attachmentsLoading) return;
    if (song.notes && song.notes.trim() && attachments.length === 0) {
      migrationRef.current = true;
      const mode = authState === 'guest' ? 'guest' : 'authenticated';
      migrateNotesToAttachment(song, mode, user?.uid);
    } else {
      migrationRef.current = true;
    }
  }, [song, attachmentsLoading, attachments.length, authState, user?.uid]);

  // Compute dirty state
  const { name, artist, musicalKey, mode } = formState;
  const isDirty =
    !isUploading && (
      name !== savedValues.name ||
      artist !== savedValues.artist ||
      bpm !== savedValues.bpm ||
      timeSignature !== savedValues.timeSignature ||
      musicalKey !== savedValues.musicalKey ||
      audioMode !== savedValues.audioMode
    );

  // Notify parent of dirty state changes
  const prevDirtyRef = useRef(false);
  useEffect(() => {
    if (prevDirtyRef.current !== isDirty) {
      prevDirtyRef.current = isDirty;
      onDirtyChange?.(isDirty);
    }
  }, [isDirty, onDirtyChange]);

  const setName = (name: string) => setFormState(s => ({ ...s, name }));
  const setArtist = (artist: string) => setFormState(s => ({ ...s, artist }));
  const setMusicalKey = (musicalKey: string) => setFormState(s => ({ ...s, musicalKey }));
  const setMode = (mode: Mode) => {
    setFormState(s => ({ ...s, mode }));
    onModeChange?.(mode);
  };

  const handleSave = () => {
    const clampedBpm = Math.max(BPM.MIN, Math.min(BPM.MAX, bpm));
    if (song) {
      onSave({
        name: name.trim() || song.name,
        artist: artist.trim() || undefined,
        bpm: clampedBpm,
        timeSignature,
        key: musicalKey || undefined,
        audioMode,
      });
      setSavedValues({
        name: name.trim() || song.name,
        artist: artist.trim(),
        bpm: clampedBpm,
        timeSignature,
        musicalKey,
        audioMode,
      });
    } else {
      if (!name.trim()) {
        setShowSaveModal(true);
      } else {
        onSave({
          name: name.trim(),
          artist: artist.trim() || undefined,
          bpm: clampedBpm,
          timeSignature,
          key: musicalKey || undefined,
          audioMode,
          });
      }
    }
  };

  const handleSaveWithName = () => {
    if (!name.trim()) return;
    const clampedBpm = Math.max(BPM.MIN, Math.min(BPM.MAX, bpm));
    onSave({
      name: name.trim(),
      artist: artist.trim() || undefined,
      bpm: clampedBpm,
      timeSignature,
      key: musicalKey || undefined,
      audioMode,
    });
    setShowSaveModal(false);
  };

  // Rich text editor state
  const [editingAttachment, setEditingAttachment] = useState<Attachment | null>(null);
  const [isNewAttachment, setIsNewAttachment] = useState(false);

  // Drawing state
  const [editingDrawing, setEditingDrawing] = useState<Attachment | null>(null);
  const [isNewDrawing, setIsNewDrawing] = useState(false);

  // Annotation state (for image annotations)
  const [annotatingAttachment, setAnnotatingAttachment] = useState<Attachment | null>(null);

  // PDF annotation state
  const [annotatingPdf, setAnnotatingPdf] = useState<Attachment | null>(null);

  // Attachment handlers
  const handleEditAttachment = useCallback((attachment: Attachment) => {
    if (attachment.type === 'richtext') {
      setIsNewAttachment(false);
      setEditingAttachment(attachment);
    } else if (attachment.type === 'image' && (attachment.storageUrl || attachment.cloudFileId)) {
      setAnnotatingAttachment(attachment);
    } else if (attachment.type === 'pdf' && (attachment.storageUrl || attachment.cloudFileId)) {
      setAnnotatingPdf(attachment);
    } else if (attachment.type === 'drawing') {
      setIsNewDrawing(false);
      setEditingDrawing(attachment);
    }
  }, []);

  const handleAnnotationSave = useCallback((annotations: AnnotationLayer) => {
    if (annotatingAttachment) {
      updateAttachment(annotatingAttachment.id, { annotations });
    }
    setAnnotatingAttachment(null);
  }, [annotatingAttachment, updateAttachment]);

  const handlePdfAnnotationSave = useCallback((pageAnnotations: Record<number, AnnotationLayer>) => {
    if (annotatingPdf) {
      updateAttachment(annotatingPdf.id, { pageAnnotations });
    }
    setAnnotatingPdf(null);
  }, [annotatingPdf, updateAttachment]);

  const handleAddText = useCallback(() => {
    setIsNewAttachment(true);
    setEditingAttachment({ id: '', type: 'richtext', order: 0, isDefault: false, createdAt: '', updatedAt: '' });
  }, []);

  const handleEditorSave = useCallback((content: object) => {
    if (isNewAttachment) {
      // Create the attachment with content (no orphan on cancel)
      addRichText(content);
    } else if (editingAttachment) {
      updateAttachment(editingAttachment.id, { content });
    }
    setEditingAttachment(null);
    setIsNewAttachment(false);
  }, [isNewAttachment, editingAttachment, addRichText, updateAttachment]);

  const handleEditorCancel = useCallback(() => {
    // No cleanup needed — new attachments aren't created until Done
    setEditingAttachment(null);
    setIsNewAttachment(false);
  }, []);

  // Drawing handlers
  const handleAddDrawing = useCallback(() => {
    setIsNewDrawing(true);
    setEditingDrawing({ id: '', type: 'drawing', order: 0, isDefault: false, createdAt: '', updatedAt: '' });
  }, []);

  const handleDrawingSave = useCallback((data: DrawingData) => {
    if (isNewDrawing) {
      addImage({
        type: 'drawing',
        order: attachments.length,
        isDefault: attachments.length === 0,
        drawingData: data,
      });
    } else if (editingDrawing) {
      updateAttachment(editingDrawing.id, { drawingData: data });
    }
    setEditingDrawing(null);
    setIsNewDrawing(false);
  }, [isNewDrawing, editingDrawing, addImage, attachments.length, updateAttachment]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const handleAddImage = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleAddCamera = useCallback(() => {
    cameraInputRef.current?.click();
  }, []);

  const handleAddPdf = useCallback(() => {
    pdfInputRef.current?.click();
  }, []);

  const handleAddAudio = useCallback(() => {
    audioInputRef.current?.click();
  }, []);

  const songId = song?.id;
  const userId = user?.uid;
  const isGuest = authState === 'guest';

  const handleFileSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !songId) return;
    if (!isGuest && !userId) return;
    e.target.value = '';

    setIsUploading(true);
    try {
      const { blob, width, height } = await compressImage(file);
      const attachment = await addImage({
        type: 'image',
        name: nameFromFile(file.name),
        order: attachments.length,
        isDefault: attachments.length === 0,
        fileName: file.name,
        fileSize: blob.size,
        width,
        height,
      });

      if (isGuest) {
        await saveGuestBlob(songId, attachment.id, blob);
        const blobUrl = URL.createObjectURL(blob);
        updateAttachment(attachment.id, { storageUrl: blobUrl });
      } else {
        const downloadUrl = await uploadAttachmentFile(userId!, songId, attachment.id, blob);
        const path = getStoragePath(userId!, songId, attachment.id);
        updateAssetStorage(attachment.id, downloadUrl, path);
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  }, [songId, userId, isGuest, attachments.length, addImage, updateAttachment, updateAssetStorage, toast]);

  const handlePdfSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !songId) return;
    if (!isGuest && !userId) return;
    e.target.value = '';

    if (file.type !== 'application/pdf') {
      toast('This file is not a valid PDF');
      return;
    }

    const sizeError = validateFileSize(file.size, 'pdf');
    if (sizeError) {
      toast(sizeError);
      return;
    }

    const currentTotal = attachments.reduce((sum, a) => sum + (a.fileSize || 0), 0);
    const songError = validateSongStorage(currentTotal, file.size);
    if (songError) {
      toast(songError);
      return;
    }

    setIsUploading(true);
    try {
      let pageCount = 0;
      try {
        const pdfjs = await loadPdfJs();
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
        pageCount = pdf.numPages;
        pdf.destroy();
      } catch {
        pageCount = 0;
      }

      const attachment = await addImage({
        type: 'pdf',
        name: nameFromFile(file.name),
        order: attachments.length,
        isDefault: attachments.length === 0,
        fileName: file.name,
        fileSize: file.size,
        pageCount,
      });

      if (isGuest) {
        await saveGuestBlob(songId, attachment.id, file);
        const blobUrl = URL.createObjectURL(file);
        updateAttachment(attachment.id, { storageUrl: blobUrl });
      } else {
        const downloadUrl = await uploadAttachmentFile(userId!, songId, attachment.id, file, 'application/pdf');
        const path = getStoragePath(userId!, songId, attachment.id);
        updateAssetStorage(attachment.id, downloadUrl, path);
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'PDF upload failed');
    } finally {
      setIsUploading(false);
    }
  }, [songId, userId, isGuest, attachments, addImage, updateAttachment, updateAssetStorage, toast]);

  const handleAudioSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !songId) return;
    if (!isGuest && !userId) return;
    e.target.value = '';

    const audioError = validateAudioFile(file);
    if (audioError) {
      toast(audioError);
      return;
    }

    const currentTotal = attachments.reduce((sum, a) => sum + (a.fileSize || 0), 0);
    const songError = validateSongStorage(currentTotal, file.size);
    if (songError) {
      toast(songError);
      return;
    }

    setIsUploading(true);
    try {
      let duration = 0;
      try {
        duration = await extractAudioDuration(file);
      } catch {
        duration = 0;
      }

      const attachment = await addImage({
        type: 'audio',
        name: nameFromFile(file.name),
        order: attachments.length,
        isDefault: false,
        fileName: file.name,
        fileSize: file.size,
        duration,
      });

      if (isGuest) {
        await saveGuestBlob(songId, attachment.id, file);
        const blobUrl = URL.createObjectURL(file);
        updateAttachment(attachment.id, { storageUrl: blobUrl });
      } else {
        const downloadUrl = await uploadAttachmentFile(userId!, songId, attachment.id, file, 'audio/mpeg');
        const path = getStoragePath(userId!, songId, attachment.id);
        updateAssetStorage(attachment.id, downloadUrl, path);
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Audio upload failed');
    } finally {
      setIsUploading(false);
    }
  }, [songId, userId, isGuest, attachments, addImage, updateAttachment, updateAssetStorage, toast]);

  // Cloud Drive import
  const { openPicker, isAvailable: cloudAvailable } = useCloudProvider('google-drive');

  const handleAddFromCloud = useCallback(async (_providerId: CloudProviderId) => {
    if (isGuest) {
      toast('Sign in with Google to import from Drive');
      return;
    }
    if (!songId) return;
    if (!isGuest && !userId) return;

    const result = await openPicker([
      'image/jpeg', 'image/png', 'image/webp',
      'application/pdf',
    ]);
    if (!result) return;

    const attachmentType = cloudMimeToAttachmentType(result.mimeType);
    if (!attachmentType) {
      toast('Unsupported file type');
      return;
    }

    await addImage({
      type: attachmentType,
      name: nameFromFile(result.fileName),
      order: attachments.length,
      isDefault: attachmentType !== 'audio' && attachments.length === 0,
      fileName: result.fileName,
      fileSize: result.fileSize,
      cloudProvider: result.providerId,
      cloudFileId: result.fileId,
      cloudFileName: result.fileName,
      cloudMimeType: result.mimeType,
      cloudFileSize: result.fileSize,
      cloudWebViewLink: result.webViewLink,
      cloudThumbnailLink: result.thumbnailLink,
    });
  }, [isGuest, songId, userId, openPicker, attachments.length, addImage, toast]);

  const handleAddAudioFromCloud = useCallback(async (_providerId: CloudProviderId) => {
    if (isGuest) {
      toast('Sign in with Google to import from Drive');
      return;
    }
    if (!songId) return;
    if (!isGuest && !userId) return;

    const result = await openPicker(['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/webm']);
    if (!result) return;

    await addImage({
      type: 'audio',
      name: nameFromFile(result.fileName),
      order: attachments.length,
      isDefault: false,
      fileName: result.fileName,
      fileSize: result.fileSize,
      cloudProvider: result.providerId,
      cloudFileId: result.fileId,
      cloudFileName: result.fileName,
      cloudMimeType: result.mimeType,
      cloudFileSize: result.fileSize,
      cloudWebViewLink: result.webViewLink,
      cloudThumbnailLink: result.thumbnailLink,
    });
  }, [isGuest, songId, userId, openPicker, attachments.length, addImage, toast]);

  // Handle audio mode changes — stop any active playback
  const handleAudioModeChange = useCallback((newMode: AudioMode) => {
    // Stop metronome if playing
    if (isPlaying) {
      togglePlayStop();
    }
    // Stop backing track if playing
    btStop();
    setAudioMode(newMode);
  }, [isPlaying, togglePlayStop, btStop]);

  // Derive audio attachment and non-audio attachments for display
  const audioAttachment = attachments.find(a => a.type === 'audio') ?? null;
  const displayAttachments = attachments.filter(a => a.type !== 'audio');

  const hasBackingTrack = audioAttachment !== null;

  // Derive all audio attachments for transport source selection
  const audioAttachments = attachments.filter(a => a.type === 'audio');
  const audioAttachmentsRef = useRef(audioAttachments);
  audioAttachmentsRef.current = audioAttachments;

  // Report transport state to parent
  const onTransportUpdateRef = useRef(onTransportUpdate);
  onTransportUpdateRef.current = onTransportUpdate;

  // Use audioAttachments.length as dep proxy (array ref changes every render)
  const audioAttachmentsCount = audioAttachments.length;
  const rafRef = useRef<number>(0);
  useEffect(() => {
    // Throttle to one update per animation frame (bt.currentTime changes ~60fps)
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      onTransportUpdateRef.current?.({
        bpm, timeSignature, isPlaying, currentBeat, isBeating, isMuted,
        audioMode, hasBackingTrack, audioAttachments: audioAttachmentsRef.current,
        btIsPlaying,
        btCurrentTime, btDuration,
        btBuffered, btVolume,
        btActiveTrackId: btTrack?.id ?? null,
        metronomeVolume,
      });
    });
    return () => cancelAnimationFrame(rafRef.current);
  }, [bpm, timeSignature, isPlaying, currentBeat, isBeating, isMuted,
      audioMode, hasBackingTrack, audioAttachmentsCount,
      btIsPlaying, btCurrentTime, btDuration,
      btBuffered, btVolume, btTrack?.id, metronomeVolume]);

  // Expose save and transport actions to parent via ref
  useImperativeHandle(ref, () => ({
    save: handleSave,
    togglePlay: togglePlayStop,
    changeBpm: handleBpmChange,
    toggleMute: () => setIsMuted(!isMuted),
    changeAudioMode: handleAudioModeChange,
    btPlay,
    btPause,
    btSeek,
    btSetVolume,
    setMetronomeVolume,
    switchToEdit: () => setMode('edit'),
    switchToPerformance: () => setMode('performance'),
    changeName: setName,
    changeArtist: setArtist,
    getName: () => formState.name,
    getArtist: () => formState.artist,
  }), [handleSave, togglePlayStop, handleBpmChange, isMuted, setIsMuted,
       handleAudioModeChange, btPlay, btPause, btSeek, btSetVolume,
       setMetronomeVolume, formState.name, formState.artist, setMode]);

  return (
    <>
      {mode === 'performance' ? (
        <PerformanceMode
          song={song}
          attachments={displayAttachments}
          attachmentsLoading={attachmentsLoading}
          musicalKey={musicalKey}
          bpm={bpm}
          timeSignature={timeSignature}
          setlist={setlist}
          songIndex={songIndex}
          showBack={showBack}
          onBack={onBack}
          onPrevSong={onPrevSong}
          onNextSong={onNextSong}
          onSwitchToEdit={() => setMode('edit')}
          perfFontSize={perfFontSize}
          perfFontFamily={perfFontFamily}
          hideHeader={hidePerformanceHeader}
        />
      ) : (
        <EditMode
          song={song}
          name={name}
          artist={artist}
          musicalKey={musicalKey}
          bpm={bpm}
          timeSignature={timeSignature}
          showBack={showBack}
          onBack={onBack}
          onNameChange={setName}
          onArtistChange={setArtist}
          onKeyChange={setMusicalKey}
          onBpmChange={handleBpmChange}
          onSwitchToPerformance={() => setMode('performance')}
          onOpenTimeSigModal={() => setShowTimeSigModal(true)}
          onSave={handleSave}
          isDirty={isDirty}
          attachments={displayAttachments}
          onEditAttachment={handleEditAttachment}
          onDeleteAttachment={deleteAttachment}
          onToggleDefaultAttachment={setDefault}
          onReorderAttachments={reorderAttachments}
          onAddTextAttachment={handleAddText}
          onAddImageAttachment={handleAddImage}
          onAddCameraAttachment={handleAddCamera}
          onAddPdfAttachment={handleAddPdf}
          onAddDrawingAttachment={handleAddDrawing}
          audioAttachments={audioAttachments}
          onAddAudio={handleAddAudio}
          onDeleteAudio={deleteAttachment}
          isUploadingAudio={isUploading}
          btIsPlaying={btIsPlaying}
          btCurrentTime={btCurrentTime}
          btDuration={btDuration}
          btBuffered={btBuffered}
          onBtPlay={btPlay}
          onBtPause={btPause}
          onBtSeek={btSeek}
          isGuest={isGuest}
          onAddFromCloud={cloudAvailable ? handleAddFromCloud : undefined}
          onAddAudioFromCloud={cloudAvailable ? handleAddAudioFromCloud : undefined}
          hideHeader={hidePerformanceHeader}
        />
      )}

      <TimeSignatureModal
        isOpen={showTimeSigModal}
        onClose={() => setShowTimeSigModal(false)}
        currentTimeSignature={timeSignature}
        onApply={setTimeSignature}
      />

      <SaveSongModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        name={name}
        artist={artist}
        onNameChange={setName}
        onArtistChange={setArtist}
        onSave={handleSaveWithName}
      />

      <RichTextEditor
        isOpen={!!editingAttachment}
        content={editingAttachment?.content}
        onSave={handleEditorSave}
        onCancel={handleEditorCancel}
      />

      <DrawingCanvas
        isOpen={!!editingDrawing}
        initialData={editingDrawing?.drawingData}
        onSave={handleDrawingSave}
      />

      {annotatingAttachment && (
        <ResolvedAnnotationOverlay
          attachment={annotatingAttachment}
          onSave={handleAnnotationSave}
          onCancel={() => setAnnotatingAttachment(null)}
        />
      )}

      {annotatingPdf && (
        <ResolvedPdfAnnotationOverlay
          attachment={annotatingPdf}
          onSave={handlePdfAnnotationSave}
          onCancel={() => setAnnotatingPdf(null)}
        />
      )}

      {/* Hidden file input for image uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelected}
      />

      {/* Hidden file input for camera capture */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileSelected}
      />

      {/* Hidden file input for PDF uploads */}
      <input
        ref={pdfInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handlePdfSelected}
      />

      {/* Hidden file input for audio uploads */}
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/mpeg"
        className="hidden"
        onChange={handleAudioSelected}
      />

    </>
  );
});

export default SongView;
