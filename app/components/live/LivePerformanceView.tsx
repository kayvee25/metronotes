'use client';

import { useState, useRef, useCallback } from 'react';
import SongView, { SongViewHandle, TransportState } from '../SongView';
import LiveHeader, { QueueSong } from './LiveHeader';
import MetadataRow from './MetadataRow';
import TransportControls from './TransportControls';
import { Song, Setlist, SongInput } from '../../types';
import { MetronomeSound } from '../../hooks/useMetronomeAudio';
import { useToast } from '../ui/Toast';
import { sortSongs, getSavedSortOption } from '../../lib/song-sort';

interface LivePerformanceViewProps {
  song: Song;
  songs: Song[];
  onBack: () => void;
  onSave: (data: SongInput) => void;
  setlist: Setlist | null;
  songIndex: number;
  onPrevSong: () => void;
  onNextSong: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onSelectSongFromQueue: (song: Song, index: number) => void;
  perfFontSize?: string;
  perfFontFamily?: string;
  metronomeSound?: MetronomeSound;
  songViewRef?: React.RefObject<SongViewHandle | null>;
  initialEditMode?: boolean;
}

export default function LivePerformanceView({
  song,
  songs,
  onBack,
  onSave,
  setlist,
  songIndex,
  onPrevSong,
  onNextSong,
  onDirtyChange,
  onSelectSongFromQueue,
  perfFontSize,
  perfFontFamily,
  metronomeSound,
  songViewRef,
  initialEditMode = false,
}: LivePerformanceViewProps) {
  const internalRef = useRef<SongViewHandle>(null);
  const ref = songViewRef || internalRef;
  const { toast } = useToast();

  const [transport, setTransport] = useState<TransportState | null>(null);
  const [isEditMode, setIsEditMode] = useState(initialEditMode);
  const [editName, setEditName] = useState(song.name);
  const [editArtist, setEditArtist] = useState(song.artist || '');
  const isDirtyRef = useRef(false);

  const handleTransportUpdate = useCallback((state: TransportState) => {
    setTransport(state);
  }, []);

  const handleModeChange = (mode: 'performance' | 'edit') => {
    setIsEditMode(mode === 'edit');
    if (mode === 'edit' && ref.current) {
      setEditName(ref.current.getName());
      setEditArtist(ref.current.getArtist());
    }
  };

  // Build queue — match library sort order for non-setlist mode
  const sortedSongs = setlist ? songs : sortSongs(songs, getSavedSortOption());
  const queue: QueueSong[] = setlist
    ? setlist.songIds
        .map(id => songs.find(s => s.id === id))
        .filter((s): s is Song => s != null)
        .map(s => ({ id: s.id, name: s.name, artist: s.artist }))
    : sortedSongs.map(s => ({ id: s.id, name: s.name, artist: s.artist }));

  const currentIndex = setlist
    ? songIndex
    : sortedSongs.findIndex(s => s.id === song.id);

  const handleSelectFromQueue = (index: number) => {
    const queueSong = queue[index];
    if (!queueSong) return;
    const fullSong = songs.find(s => s.id === queueSong.id);
    if (fullSong) {
      onSelectSongFromQueue(fullSong, index);
    }
  };

  // Transport action callbacks that delegate to SongView via ref
  // Using plain functions (React Compiler auto-memoizes; manual useCallback with ref.current fails)
  const handleTogglePlay = () => ref.current?.togglePlay();
  const handleBpmChange = (bpm: number) => ref.current?.changeBpm(bpm);
  const handleToggleMute = () => ref.current?.toggleMute();
  const handleChangeAudioMode = (mode: 'metronome' | 'backingtrack' | 'off') => ref.current?.changeAudioMode(mode);
  const handleBtPlay = () => ref.current?.btPlay();
  const handleBtPause = () => ref.current?.btPause();
  const handleBtSeek = (time: number) => ref.current?.btSeek(time);
  const handleBtSetVolume = (vol: number) => ref.current?.btSetVolume(vol);

  // Track dirty state for auto-save
  const handleDirtyChange = (dirty: boolean) => {
    isDirtyRef.current = dirty;
    onDirtyChange(dirty);
  };

  // Edit mode toggle — auto-save on exit from edit mode
  const handleToggleEditMode = () => {
    if (isEditMode) {
      if (isDirtyRef.current) {
        ref.current?.save();
        toast('Changes saved', 'success');
      }
      ref.current?.switchToPerformance();
    } else {
      ref.current?.switchToEdit();
    }
  };

  // Transport controls — always visible in both modes
  const transportSlot = (
    <>
      {!isEditMode && transport && (
        <MetadataRow
          timeSignature={transport.timeSignature}
          bpm={transport.bpm}
          musicalKey={song.key}
        />
      )}
      <TransportControls
        transport={transport}
        musicalKey={song.key}
        onTogglePlay={handleTogglePlay}
        onBpmChange={handleBpmChange}
        onToggleMute={handleToggleMute}
        onChangeAudioMode={handleChangeAudioMode}
        onBtPlay={handleBtPlay}
        onBtPause={handleBtPause}
        onBtSeek={handleBtSeek}
        onBtSetVolume={handleBtSetVolume}
      />
    </>
  );

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto w-full">
      <LiveHeader
        songName={isEditMode ? editName : song.name}
        artist={isEditMode ? editArtist : song.artist}
        queue={queue}
        currentIndex={currentIndex}
        onSelectFromQueue={handleSelectFromQueue}
        onBack={onBack}
        transportSlot={transportSlot}
        isEditMode={isEditMode}
        onToggleEditMode={handleToggleEditMode}
        onNameChange={(name) => { setEditName(name); ref.current?.changeName(name); }}
        onArtistChange={(artist) => { setEditArtist(artist); ref.current?.changeArtist(artist); }}
      />

      <div className="flex-1 overflow-hidden">
        <SongView
          ref={ref}
          key={song.id}
          song={song}
          onBack={onBack}
          onSave={onSave}
          setlist={setlist}
          songIndex={songIndex}
          onPrevSong={onPrevSong}
          onNextSong={onNextSong}
          showBack={false}
          onDirtyChange={handleDirtyChange}
          initialEditMode={initialEditMode}
          perfFontSize={perfFontSize}
          perfFontFamily={perfFontFamily}
          metronomeSound={metronomeSound}
          hidePerformanceHeader
          onTransportUpdate={handleTransportUpdate}
          onModeChange={handleModeChange}
        />
      </div>
    </div>
  );
}
