'use client';

import { useState, useEffect } from 'react';
import { Song, SongInput, Setlist } from '../types';
import { useMetronomeAudio } from '../hooks/useMetronomeAudio';
import { BPM, TIME_SIGNATURE } from '../lib/constants';
import PerformanceMode from './song/PerformanceMode';
import EditMode from './song/EditMode';
import TimeSignatureModal from './song/TimeSignatureModal';
import SaveSongModal from './song/SaveSongModal';

type Mode = 'performance' | 'edit';

interface SongViewProps {
  song?: Song | null;
  onBack: () => void;
  onSave: (data: SongInput) => void;
  setlist?: Setlist | null;
  songIndex?: number;
  onPrevSong?: () => void;
  onNextSong?: () => void;
  showBack?: boolean;
}

interface FormState {
  name: string;
  artist: string;
  musicalKey: string;
  notes: string;
  mode: Mode;
}

function getInitialFormState(song?: Song | null): FormState {
  if (song) {
    return {
      name: song.name,
      artist: song.artist || '',
      musicalKey: song.key || '',
      notes: song.notes || '',
      mode: 'performance'
    };
  }
  return { name: '', artist: '', musicalKey: '', notes: '', mode: 'edit' };
}

export default function SongView({
  song,
  onBack,
  onSave,
  setlist,
  songIndex = 0,
  onPrevSong,
  onNextSong,
  showBack = true
}: SongViewProps) {
  // Combined form state to avoid cascading renders
  const [formState, setFormState] = useState<FormState>(() => getInitialFormState(song));

  // Modal state
  const [showTimeSigModal, setShowTimeSigModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);

  // Metronome audio
  const {
    bpm,
    timeSignature,
    setTimeSignature,
    isPlaying,
    currentBeat,
    isBeating,
    beatsPerMeasure,
    handleBpmChange,
    togglePlayStop
  } = useMetronomeAudio({
    initialBpm: song?.bpm || BPM.DEFAULT,
    initialTimeSignature: song?.timeSignature || TIME_SIGNATURE.DEFAULT
  });

  // Sync form state when song changes
  useEffect(() => {
    setFormState(getInitialFormState(song));
  }, [song]);

  // Destructure for convenience
  const { name, artist, musicalKey, notes, mode } = formState;
  const setName = (name: string) => setFormState(s => ({ ...s, name }));
  const setArtist = (artist: string) => setFormState(s => ({ ...s, artist }));
  const setMusicalKey = (musicalKey: string) => setFormState(s => ({ ...s, musicalKey }));
  const setNotes = (notes: string) => setFormState(s => ({ ...s, notes }));
  const setMode = (mode: Mode) => setFormState(s => ({ ...s, mode }));

  const handleSave = () => {
    if (song) {
      // Update existing song
      onSave({
        name: name.trim() || song.name,
        artist: artist.trim() || undefined,
        bpm,
        timeSignature,
        key: musicalKey || undefined,
        notes: notes.trim() || undefined
      });
    } else {
      // New song - show name modal if no name
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

  // Render performance or edit mode
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
          onSwitchToEdit={() => setMode('edit')}
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
        />
      )}

      {/* Modals */}
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
}
