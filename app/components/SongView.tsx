'use client';

import { useState, useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import { Song, SongInput, Setlist, Attachment } from '../types';
import { useMetronomeAudio, MetronomeSound } from '../hooks/useMetronomeAudio';
import { useAttachments } from '../hooks/useAttachments';
import { useAuth } from '../hooks/useAuth';
import { migrateNotesToAttachment } from '../lib/migration';
import { compressImage } from '../lib/image-processing';
import { uploadAttachmentFile, getStoragePath } from '../lib/storage-firebase';
import { BPM, TIME_SIGNATURE } from '../lib/constants';
import PerformanceMode from './song/PerformanceMode';
import EditMode from './song/EditMode';
import TimeSignatureModal from './song/TimeSignatureModal';
import SaveSongModal from './song/SaveSongModal';
import RichTextEditor from './song/RichTextEditor';

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
  const [formState, setFormState] = useState<FormState>(() => getInitialFormState(song, initialEditMode));
  const [showTimeSigModal, setShowTimeSigModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [savedValues, setSavedValues] = useState<OriginalValues>(() => getOriginalValues(song));
  const migrationRef = useRef(false);

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
  } = useAttachments(song?.id || null);

  // Migrate plain-text notes to attachment on first load
  useEffect(() => {
    if (migrationRef.current || !song || attachmentsLoading) return;
    if (song.notes && song.notes.trim() && attachments.length === 0) {
      migrationRef.current = true;
      const mode = authState === 'guest' ? 'guest' : 'authenticated';
      migrateNotesToAttachment(song, mode, undefined);
    } else {
      migrationRef.current = true;
    }
  }, [song, attachmentsLoading, attachments.length, authState]);

  // Compute dirty state
  const { name, artist, musicalKey, mode } = formState;
  const isDirty =
    name !== savedValues.name ||
    artist !== savedValues.artist ||
    musicalKey !== savedValues.musicalKey;

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
    if (song) {
      onSave({
        name: name.trim() || song.name,
        artist: artist.trim() || undefined,
        bpm,
        timeSignature,
        key: musicalKey || undefined,
      });
      setSavedValues({
        name: name.trim() || song.name,
        artist: artist.trim(),
        musicalKey,
      });
    } else {
      if (!name.trim()) {
        setShowSaveModal(true);
      } else {
        onSave({
          name: name.trim(),
          artist: artist.trim() || undefined,
          bpm,
          timeSignature,
          key: musicalKey || undefined,
        });
      }
    }
  };

  const handleSaveWithName = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      artist: artist.trim() || undefined,
      bpm,
      timeSignature,
      key: musicalKey || undefined,
    });
    setShowSaveModal(false);
  };

  // Rich text editor state
  const [editingAttachment, setEditingAttachment] = useState<Attachment | null>(null);
  const [isNewAttachment, setIsNewAttachment] = useState(false);

  // Attachment handlers
  const handleEditAttachment = useCallback((attachment: Attachment) => {
    if (attachment.type === 'richtext') {
      setIsNewAttachment(false);
      setEditingAttachment(attachment);
    }
  }, []);

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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  const handleAddImage = useCallback(() => {
    if (authState === 'guest') {
      setImageError('Sign in to add images');
      return;
    }
    fileInputRef.current?.click();
  }, [authState]);

  const songId = song?.id;
  const userId = user?.uid;

  const handleFileSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !songId || !userId) return;
    // Reset input so same file can be selected again
    e.target.value = '';

    setImageError(null);
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
      setImageError(err instanceof Error ? err.message : 'Upload failed');
    }
  }, [songId, userId, attachments.length, addImage, updateAttachment]);

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
          onReorderAttachments={reorderAttachments}
          onAddTextAttachment={handleAddText}
          onAddImageAttachment={handleAddImage}
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

      {/* Hidden file input for image uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelected}
      />

      {/* Image error toast */}
      {imageError && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-[var(--accent-danger)] text-white text-sm font-medium shadow-lg">
          {imageError}
          <button onClick={() => setImageError(null)} className="ml-2 opacity-75 hover:opacity-100">
            &times;
          </button>
        </div>
      )}
    </>
  );
});

export default SongView;
