'use client';

import { useState, useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import { Song, SongInput, Setlist, Attachment, DrawingData, AnnotationLayer } from '../types';
import { useMetronomeAudio, MetronomeSound } from '../hooks/useMetronomeAudio';
import { useAttachments } from '../hooks/useAttachments';
import { useAuth } from '../hooks/useAuth';
import { useToast } from './ui/Toast';
import { migrateNotesToAttachment } from '../lib/migration';
import { compressImage, validateFileSize, validateSongStorage } from '../lib/image-processing';
import { uploadAttachmentFile, getStoragePath } from '../lib/storage-firebase';
import { loadPdfJs } from '../lib/pdf-loader';
import { BPM, TIME_SIGNATURE } from '../lib/constants';
import PerformanceMode from './song/PerformanceMode';
import EditMode from './song/EditMode';
import TimeSignatureModal from './song/TimeSignatureModal';
import SaveSongModal from './song/SaveSongModal';
import RichTextEditor from './song/RichTextEditor';
import DrawingCanvas from './song/DrawingCanvas';
import AnnotationOverlay from './song/AnnotationOverlay';
import PdfAnnotationOverlay from './song/PdfAnnotationOverlay';

type Mode = 'performance' | 'edit';

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

interface OriginalValues {
  name: string;
  artist: string;
  bpm: number;
  timeSignature: string;
  musicalKey: string;
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
      musicalKey !== savedValues.musicalKey
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
      });
      setSavedValues({
        name: name.trim() || song.name,
        artist: artist.trim(),
        bpm: clampedBpm,
        timeSignature,
        musicalKey,
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

  const handleAddImage = useCallback(() => {
    if (authState === 'guest') {
      toast('Sign in to add images');
      return;
    }
    fileInputRef.current?.click();
  }, [authState, toast]);

  const handleAddPdf = useCallback(() => {
    if (authState === 'guest') {
      toast('Sign in to add PDFs');
      return;
    }
    pdfInputRef.current?.click();
  }, [authState, toast]);

  const songId = song?.id;
  const userId = user?.uid;

  const handleFileSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !songId || !userId) return;
    e.target.value = '';

    setIsUploading(true);
    try {
      const { blob, width, height } = await compressImage(file);
      const attachment = await addImage({
        type: 'image',
        order: attachments.length,
        isDefault: attachments.length === 0,
        fileName: file.name,
        fileSize: blob.size,
        width,
        height,
      });

      const downloadUrl = await uploadAttachmentFile(userId, songId, attachment.id, blob);
      const storagePath = getStoragePath(userId, songId, attachment.id);
      updateAttachment(attachment.id, { storageUrl: downloadUrl, storagePath });
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  }, [songId, userId, attachments.length, addImage, updateAttachment, toast]);

  const handlePdfSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !songId || !userId) return;
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
        order: attachments.length,
        isDefault: attachments.length === 0,
        fileName: file.name,
        fileSize: file.size,
        pageCount,
      });

      const downloadUrl = await uploadAttachmentFile(userId, songId, attachment.id, file, 'application/pdf');
      const storagePath = getStoragePath(userId, songId, attachment.id);
      updateAttachment(attachment.id, { storageUrl: downloadUrl, storagePath });
    } catch (err) {
      toast(err instanceof Error ? err.message : 'PDF upload failed');
    } finally {
      setIsUploading(false);
    }
  }, [songId, userId, attachments, addImage, updateAttachment, toast]);

  // Expose save method to parent via ref
  useImperativeHandle(ref, () => ({
    save: handleSave,
  }));

  return (
    <>
      {mode === 'performance' ? (
        <PerformanceMode
          song={song}
          attachments={attachments}
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
          attachments={attachments}
          onEditAttachment={handleEditAttachment}
          onDeleteAttachment={deleteAttachment}
          onToggleDefaultAttachment={setDefault}
          onRenameAttachment={(id, name) => updateAttachment(id, { name })}
          onReorderAttachments={reorderAttachments}
          onAddTextAttachment={handleAddText}
          onAddImageAttachment={handleAddImage}
          onAddPdfAttachment={handleAddPdf}
          onAddDrawingAttachment={handleAddDrawing}
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

    </>
  );
});

export default SongView;
