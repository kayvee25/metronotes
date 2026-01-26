export interface Song {
  id: string;
  name: string;
  artist?: string;
  bpm: number;
  timeSignature: string;
  key?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Setlist {
  id: string;
  name: string;
  songIds: string[];
  createdAt: string;
  updatedAt: string;
}

export type SongInput = Omit<Song, 'id' | 'createdAt' | 'updatedAt'>;
export type SongUpdate = Partial<SongInput>;

export type SetlistInput = Omit<Setlist, 'id' | 'createdAt' | 'updatedAt'>;
export type SetlistUpdate = Partial<SetlistInput>;
