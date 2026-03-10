'use client';

import { useRef } from 'react';
import SongView, { SongViewHandle } from '../SongView';
import LiveHeader, { QueueSong } from './LiveHeader';
import { Song, Setlist, SongInput } from '../../types';
import { MetronomeSound } from '../../hooks/useMetronomeAudio';

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

  // Build queue
  const queue: QueueSong[] = setlist
    ? setlist.songIds
        .map(id => songs.find(s => s.id === id))
        .filter((s): s is Song => s != null)
        .map(s => ({ id: s.id, name: s.name, artist: s.artist }))
    : songs.map(s => ({ id: s.id, name: s.name, artist: s.artist }));

  const currentIndex = setlist
    ? songIndex
    : songs.findIndex(s => s.id === song.id);

  const handleSelectFromQueue = (index: number) => {
    const queueSong = queue[index];
    if (!queueSong) return;
    const fullSong = songs.find(s => s.id === queueSong.id);
    if (fullSong) {
      onSelectSongFromQueue(fullSong, index);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <LiveHeader
        songName={song.name}
        artist={song.artist}
        musicalKey={song.key}
        bpm={song.bpm}
        timeSignature={song.timeSignature}
        queue={queue}
        currentIndex={currentIndex}
        onSelectFromQueue={handleSelectFromQueue}
        onBack={onBack}
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
          onDirtyChange={onDirtyChange}
          initialEditMode={initialEditMode}
          perfFontSize={perfFontSize}
          perfFontFamily={perfFontFamily}
          metronomeSound={metronomeSound}
          hidePerformanceHeader
          hidePlayFab
        />
      </div>
    </div>
  );
}
