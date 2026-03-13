export interface Song {
  id: string;
  name: string;
  artist?: string;
  bpm: number;
  timeSignature: string;
  key?: string;
  notes?: string;
  audioMode?: 'metronome' | 'backingtrack' | 'off';
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

export type AttachmentType = 'richtext' | 'image' | 'pdf' | 'drawing' | 'audio';

export type AssetType = 'image' | 'pdf' | 'audio' | 'drawing' | 'richtext';

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  mimeType: string | null;
  size: number | null;
  storageUrl: string | null;
  storagePath: string | null;
  content?: object;
  drawingData?: DrawingData;
  createdAt: string;
  updatedAt: string;
}

export type AssetInput = Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>;
export type AssetUpdate = Partial<AssetInput>;

export interface Stroke {
  id: string;
  points: Array<[number, number, number]>; // [x, y, pressure]
  color: string;
  tool: 'pen';
}

export interface DrawingData {
  strokes: Stroke[];
  canvasWidth: number;
  canvasHeight: number;
}

export interface AnnotationLayer {
  strokes: Stroke[];
  baseWidth: number;
  baseHeight: number;
}

export interface Attachment {
  id: string;
  type: AttachmentType;
  name?: string;
  assetId?: string;
  order: number;
  isDefault: boolean;

  // richtext
  content?: object; // Tiptap JSON document

  // image / pdf — storageUrl is resolved from the linked Asset at load time (not persisted)
  storageUrl?: string;
  fileName?: string;
  fileSize?: number; // bytes
  width?: number;
  height?: number;

  // pdf
  pageCount?: number;

  // audio
  duration?: number; // seconds

  // drawing
  drawingData?: DrawingData;

  // annotations (on image attachments)
  annotations?: AnnotationLayer;

  // annotations (on PDF attachments, per page)
  pageAnnotations?: Record<number, AnnotationLayer>;

  // cloud-linked file (Google Drive, Dropbox, etc.)
  cloudProvider?: string;
  cloudFileId?: string;
  cloudFileName?: string;
  cloudMimeType?: string;
  cloudFileSize?: number;
  cloudWebViewLink?: string;
  cloudThumbnailLink?: string;

  // Reserved for future collaboration
  userId?: string;

  createdAt: string;
  updatedAt: string;
}

export type AttachmentInput = Omit<Attachment, 'id' | 'createdAt' | 'updatedAt'>;
export type AttachmentUpdate = Partial<Omit<Attachment, 'id' | 'createdAt' | 'updatedAt'>>;
