'use client';

import { Song, AttachmentInput } from '../types';
import { storage } from './storage';
import { firestoreCreateAttachment, firestoreUpdateSong } from './firestore';

/**
 * Convert plain text to a minimal Tiptap JSON document.
 * Each line becomes a paragraph node. Empty lines become empty paragraphs.
 */
function textToTiptapJson(text: string): object {
  const lines = text.split('\n');
  const content = lines.map((line) => {
    if (line.trim() === '') {
      return { type: 'paragraph' };
    }
    return {
      type: 'paragraph',
      content: [{ type: 'text', text: line }],
    };
  });
  return { type: 'doc', content };
}

/**
 * Migrate a song's plain-text `notes` field to a rich text attachment.
 * Works for both Firestore (authenticated) and localStorage (guest).
 *
 * Returns true if migration was performed, false if not needed.
 */
export async function migrateNotesToAttachment(
  song: Song,
  mode: 'guest' | 'authenticated',
  userId?: string
): Promise<boolean> {
  // Only migrate if song has a notes string
  if (!song.notes || song.notes.trim() === '') {
    return false;
  }

  const tiptapContent = textToTiptapJson(song.notes);

  const attachmentInput: AttachmentInput = {
    type: 'richtext',
    order: 0,
    isDefault: true,
    content: tiptapContent,
  };

  if (mode === 'guest') {
    // Create attachment in localStorage
    storage.createAttachment(song.id, attachmentInput);
    // Remove notes field from song
    storage.updateSong(song.id, { notes: undefined });
  } else if (mode === 'authenticated' && userId) {
    // Create attachment in Firestore
    await firestoreCreateAttachment(userId, song.id, attachmentInput);
    // Remove notes field from song
    await firestoreUpdateSong(userId, song.id, { notes: undefined });
  }

  return true;
}
