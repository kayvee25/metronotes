'use client';

import { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Song, SongInput, Setlist } from '../types';
import { useMetronomeAudio, MetronomeSound } from '../hooks/useMetronomeAudio';
import { BPM, TIME_SIGNATURE } from '../lib/constants';
import PerformanceMode from './song/PerformanceMode';
import EditMode from './song/EditMode';
import TimeSignatureModal from './song/TimeSignatureModal';
import SaveSongModal from './song/SaveSongModal';

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
  notes: string;
  mode: Mode;
}

interface OriginalValues {
  name: string;
  artist: string;
  bpm: number;
  timeSignature: string;
  musicalKey: string;
  notes: string;
}

function getInitialFormState(song?: Song | null, initialEditMode?: boolean): FormState {
  if (song) {
    return {
      name: song.name,
      artist: song.artist || '',
      musicalKey: song.key || '',
      notes: song.notes || '',
      mode: initialEditMode ? 'edit' : 'performance'
    };
  }
  return { name: '', artist: '', musicalKey: '', notes: '', mode: 'edit' };
}

function getOriginalValues(song?: Song | null): OriginalValues {
  return {
    name: song?.name || '',
    artist: song?.artist || '',
    bpm: song?.bpm || BPM.DEFAULT,
    timeSignature: song?.timeSignature || TIME_SIGNATURE.DEFAULT,
    musicalKey: song?.key || '',
    notes: song?.notes || '',
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
  const [formState, setFormState] = useState<FormState>(() => getInitialFormState(song, initialEditMode));
  const [showTimeSigModal, setShowTimeSigModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [savedValues, setSavedValues] = useState<OriginalValues>(() => getOriginalValues(song));

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

  // Note: When the song changes, App.tsx uses a key prop to remount this component
  // so initialState functions handle the reset correctly.

  // Compute dirty state
  const { name, artist, musicalKey, notes, mode } = formState;
  const isDirty =
    name !== savedValues.name ||
    artist !== savedValues.artist ||
    musicalKey !== savedValues.musicalKey ||
    notes !== savedValues.notes;

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
  const setNotes = (notes: string) => setFormState(s => ({ ...s, notes }));
  const setMode = (mode: Mode) => setFormState(s => ({ ...s, mode }));

  const handleSave = () => {
    if (song) {
      onSave({
        name: name.trim() || song.name,
        artist: artist.trim() || undefined,
        bpm,
        timeSignature,
        key: musicalKey || undefined,
        notes: notes.trim() || undefined
      });
      setSavedValues({
        name: name.trim() || song.name,
        artist: artist.trim(),
        bpm,
        timeSignature,
        musicalKey,
        notes: notes.trim(),
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
          notes: notes.trim() || undefined
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
      notes: notes.trim() || undefined
    });
    setShowSaveModal(false);
  };

  // Expose save method to parent via ref
  useImperativeHandle(ref, () => ({
    save: handleSave,
  }));

  return (
    <>
      {mode === 'performance' ? (
        <PerformanceMode
          song={song}
          notes={notes}
          musicalKey={musicalKey}
          bpm={bpm}
          timeSignature={timeSignature}
          isPlaying={isPlaying}
          currentBeat={currentBeat}
          isBeating={isBeating}
          beatsPerMeasure={beatsPerMeasure}
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
          notes={notes}
          musicalKey={musicalKey}
          bpm={bpm}
          timeSignature={timeSignature}
          isPlaying={isPlaying}
          currentBeat={currentBeat}
          isBeating={isBeating}
          beatsPerMeasure={beatsPerMeasure}
          showBack={showBack}
          onBack={onBack}
          onNameChange={setName}
          onArtistChange={setArtist}
          onNotesChange={setNotes}
          onKeyChange={setMusicalKey}
          onBpmChange={handleBpmChange}
          onTogglePlay={togglePlayStop}
          onSwitchToPerformance={() => setMode('performance')}
          onOpenTimeSigModal={() => setShowTimeSigModal(true)}
          onSave={handleSave}
          isDirty={isDirty}
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
    </>
  );
});

export default SongView;
