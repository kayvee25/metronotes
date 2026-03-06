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

export type AttachmentType = 'richtext' | 'image';

export interface Attachment {
  id: string;
  type: AttachmentType;
  order: number;
  isDefault: boolean;

  // richtext
  content?: object; // Tiptap JSON document

  // image
  storageUrl?: string;
  storagePath?: string;
  fileName?: string;
  fileSize?: number; // bytes
  width?: number;
  height?: number;

  // Reserved for future collaboration
  userId?: string;

  createdAt: string;
  updatedAt: string;
}

export type AttachmentInput = Omit<Attachment, 'id' | 'createdAt' | 'updatedAt'>;
export type AttachmentUpdate = Partial<Omit<Attachment, 'id' | 'createdAt' | 'updatedAt'>>;
