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
import { cloudMimeToAttachmentType } from '../lib/cloud-providers/types';
import type { CloudProviderId } from '../lib/cloud-providers/types';
import PerformanceMode from './song/PerformanceMode';
import EditMode from './song/EditMode';
import TimeSignatureModal from './song/TimeSignatureModal';
import SaveSongModal from './song/SaveSongModal';
import RichTextEditor from './song/RichTextEditor';
import DrawingCanvas from './song/DrawingCanvas';
import AnnotationOverlay from './song/AnnotationOverlay';
import PdfAnnotationOverlay from './song/PdfAnnotationOverlay';

type Mode = 'performance' | 'edit';

/** Strip file extension to derive a clean display name */
function nameFromFile(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}


export interface SongViewHandle {
  save: () => void;
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
}

interface FormState {
  name: string;
  artist: string;
  musicalKey: string;
  mode: Mode;
}

type AudioMode = 'metronome' | 'backingtrack' | 'off';

interface OriginalValues {
  name: string;
  artist: string;
  bpm: number;
  timeSignature: string;
  musicalKey: string;
  audioMode: AudioMode;
  countInBars: number;
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
    countInBars: song?.countInBars || 1,
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
  const [countInBars, setCountInBars] = useState(() => song?.countInBars || 1);

  // Reset audioMode/countInBars on song change
  const prevSongIdForAudioRef = useRef(song?.id);
  if (prevSongIdForAudioRef.current !== song?.id) {
    prevSongIdForAudioRef.current = song?.id;
    setAudioMode(song?.audioMode || 'metronome');
    setCountInBars(song?.countInBars || 1);
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
    beatsPerMeasure,
    handleBpmChange,
    togglePlayStop
  } = useMetronomeAudio({
    initialBpm: song?.bpm || BPM.DEFAULT,
    initialTimeSignature: song?.timeSignature || TIME_SIGNATURE.DEFAULT,
    sound: metronomeSound,
  });

  const {
    attachments,
    isLoading: attachmentsLoading,
    addRichText,
    addImage,
    updateAttachment,
    deleteAttachment,
    reorderAttachments,
    setDefault,
  } = useAttachments(song?.id || null, toast);

  // Backing track playback
  const bt = useBackingTrack({
    songId: song?.id || null,
    attachments,
    metronomeSound,
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
      audioMode !== savedValues.audioMode ||
      countInBars !== savedValues.countInBars
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
  const setMode = (mode: Mode) => setFormState(s => ({ ...s, mode }));

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
        countInBars,
      });
      setSavedValues({
        name: name.trim() || song.name,
        artist: artist.trim(),
        bpm: clampedBpm,
        timeSignature,
        musicalKey,
        audioMode,
        countInBars,
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
          countInBars,
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
      countInBars,
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
    } else if (attachment.type === 'image' && attachment.storageUrl) {
      setAnnotatingAttachment(attachment);
    } else if (attachment.type === 'pdf' && attachment.storageUrl) {
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
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const handleAddImage = useCallback(() => {
    fileInputRef.current?.click();
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
        const storagePath = getStoragePath(userId!, songId, attachment.id);
        updateAttachment(attachment.id, { storageUrl: downloadUrl, storagePath });
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  }, [songId, userId, isGuest, attachments.length, addImage, updateAttachment, toast]);

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
        const storagePath = getStoragePath(userId!, songId, attachment.id);
        updateAttachment(attachment.id, { storageUrl: downloadUrl, storagePath });
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'PDF upload failed');
    } finally {
      setIsUploading(false);
    }
  }, [songId, userId, isGuest, attachments, addImage, updateAttachment, toast]);

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
        const storagePath = getStoragePath(userId!, songId, attachment.id);
        updateAttachment(attachment.id, { storageUrl: downloadUrl, storagePath });
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Audio upload failed');
    } finally {
      setIsUploading(false);
    }
  }, [songId, userId, isGuest, attachments, addImage, updateAttachment, toast]);

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
    bt.stop();
    setAudioMode(newMode);
  }, [isPlaying, togglePlayStop, bt]);

  // Derive audio attachment and non-audio attachments for display
  const audioAttachment = attachments.find(a => a.type === 'audio') ?? null;
  const displayAttachments = attachments.filter(a => a.type !== 'audio');

  const hasBackingTrack = audioAttachment != null;
  const backingTrackControls = bt.track ? {
    isPlaying: bt.isPlaying,
    isCountingIn: bt.isCountingIn,
    currentTime: bt.currentTime,
    duration: bt.duration,
    buffered: bt.buffered,
    volume: bt.volume,
    onPlay: () => bt.play(countInBars, bpm, timeSignature),
    onPause: bt.pause,
    onStop: bt.stop,
    onSeek: bt.seek,
    onVolumeChange: bt.setVolume,
  } : undefined;

  // Expose save method to parent via ref
  useImperativeHandle(ref, () => ({
    save: handleSave,
  }));

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
          isPlaying={isPlaying}
          currentBeat={currentBeat}
          isBeating={isBeating}
          setlist={setlist}
          songIndex={songIndex}
          showBack={showBack}
          onBack={onBack}
          onPrevSong={onPrevSong}
          onNextSong={onNextSong}
          onTogglePlay={togglePlayStop}
          onBpmChange={handleBpmChange}
          onSwitchToEdit={() => setMode('edit')}
          perfFontSize={perfFontSize}
          perfFontFamily={perfFontFamily}
          isMuted={isMuted}
          onToggleMute={() => setIsMuted(!isMuted)}
          audioMode={audioMode}
          onAudioModeChange={handleAudioModeChange}
          hasBackingTrack={hasBackingTrack}
          backingTrackControls={backingTrackControls}
          countInBars={countInBars}
        />
      ) : (
        <EditMode
          song={song}
          name={name}
          artist={artist}
          musicalKey={musicalKey}
          bpm={bpm}
          timeSignature={timeSignature}
          isPlaying={isPlaying}
          currentBeat={currentBeat}
          isBeating={isBeating}
          beatsPerMeasure={beatsPerMeasure}
          isMuted={isMuted}
          showBack={showBack}
          onBack={onBack}
          onNameChange={setName}
          onArtistChange={setArtist}
          onKeyChange={setMusicalKey}
          onBpmChange={handleBpmChange}
          onTogglePlay={togglePlayStop}
          onToggleMute={() => setIsMuted(!isMuted)}
          onSwitchToPerformance={() => setMode('performance')}
          onOpenTimeSigModal={() => setShowTimeSigModal(true)}
          onSave={handleSave}
          isDirty={isDirty}
          attachments={displayAttachments}
          onEditAttachment={handleEditAttachment}
          onDeleteAttachment={deleteAttachment}
          onToggleDefaultAttachment={setDefault}
          onRenameAttachment={(id, name) => updateAttachment(id, { name })}
          onReorderAttachments={reorderAttachments}
          onAddTextAttachment={handleAddText}
          onAddImageAttachment={handleAddImage}
          onAddPdfAttachment={handleAddPdf}
          onAddDrawingAttachment={handleAddDrawing}
          audioAttachment={audioAttachment}
          onAddAudio={handleAddAudio}
          onDeleteAudio={deleteAttachment}
          isUploadingAudio={isUploading}
          btIsPlaying={bt.isPlaying}
          btCurrentTime={bt.currentTime}
          btDuration={bt.duration}
          btBuffered={bt.buffered}
          onBtPlay={() => bt.play(countInBars, bpm, timeSignature)}
          onBtPause={bt.pause}
          onBtSeek={bt.seek}
          audioMode={audioMode}
          onAudioModeChange={handleAudioModeChange}
          hasBackingTrack={hasBackingTrack}
          backingTrackControls={backingTrackControls}
          countInBars={countInBars}
          onCountInBarsChange={setCountInBars}
          isGuest={isGuest}
          onAddFromCloud={cloudAvailable ? handleAddFromCloud : undefined}
          onAddAudioFromCloud={cloudAvailable ? handleAddAudioFromCloud : undefined}
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

      {annotatingAttachment && annotatingAttachment.storageUrl && (
        <AnnotationOverlay
          isOpen={true}
          backgroundContent={
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={annotatingAttachment.storageUrl}
              alt={annotatingAttachment.fileName || 'Image'}
              className="max-w-full max-h-full object-contain"
              style={{ width: annotatingAttachment.width, height: annotatingAttachment.height }}
            />
          }
          baseWidth={annotatingAttachment.width || 800}
          baseHeight={annotatingAttachment.height || 600}
          initialAnnotations={annotatingAttachment.annotations}
          onSave={handleAnnotationSave}
          title={annotatingAttachment.name || annotatingAttachment.fileName || 'Annotate'}
        />
      )}

      {annotatingPdf && annotatingPdf.storageUrl && (
        <PdfAnnotationOverlay
          isOpen={true}
          storageUrl={annotatingPdf.storageUrl}
          pageCount={annotatingPdf.pageCount}
          initialPageAnnotations={annotatingPdf.pageAnnotations}
          onSave={handlePdfAnnotationSave}
          title={annotatingPdf.name || annotatingPdf.fileName || 'Annotate PDF'}
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
