'use client';

import { useMemo } from 'react';
import { Attachment } from '../../types';
import { generateHTML } from '@tiptap/html';
import StarterKit from '@tiptap/starter-kit';
import Color from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';

interface AttachmentPageProps {
  attachment: Attachment;
  perfFontSize?: string;
  perfFontFamily?: string;
}

const FONT_SIZE_MAP: Record<string, string> = {
  sm: 'text-sm sm:text-base',
  md: 'text-base sm:text-lg',
  lg: 'text-xl sm:text-2xl',
  xl: 'text-2xl sm:text-3xl',
};

const FONT_FAMILY_MAP: Record<string, string> = {
  mono: 'font-mono',
  sans: 'font-sans',
  serif: '',
};

const extensions = [
  StarterKit.configure({
    codeBlock: {
      HTMLAttributes: {
        class: 'font-mono bg-[var(--card)] rounded-lg p-3 my-2',
      },
    },
  }),
  TextStyle,
  Color,
];

export default function AttachmentPage({
  attachment,
  perfFontSize = 'md',
  perfFontFamily = 'mono',
}: AttachmentPageProps) {
  const fontSizeClass = FONT_SIZE_MAP[perfFontSize] || FONT_SIZE_MAP.md;
  const fontFamilyClass = FONT_FAMILY_MAP[perfFontFamily] ?? FONT_FAMILY_MAP.mono;
  const serifStyle = perfFontFamily === 'serif' ? { fontFamily: 'Georgia, "Times New Roman", serif' } : {};

  const html = useMemo(() => {
    if (attachment.type === 'richtext' && attachment.content) {
      try {
        return generateHTML(attachment.content as Parameters<typeof generateHTML>[0], extensions);
      } catch {
        return '<p>Error rendering content</p>';
      }
    }
    return '';
  }, [attachment]);

  if (attachment.type === 'richtext') {
    if (!html || html === '<p></p>') {
      return (
        <div className="flex items-center justify-center h-full text-[var(--muted)]">
          <p>Empty text</p>
        </div>
      );
    }

    return (
      <div
        className={`tiptap ${fontSizeClass} ${fontFamilyClass} text-[var(--foreground)] leading-relaxed`}
        style={serifStyle}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  if (attachment.type === 'image') {
    return (
      <div className="flex items-center justify-center h-full">
        {attachment.storageUrl ? (
          <img
            src={attachment.storageUrl}
            alt={attachment.fileName || 'Image'}
            className="max-w-full max-h-full object-contain"
          />
        ) : (
          <p className="text-[var(--muted)]">Image not available</p>
        )}
      </div>
    );
  }

  return null;
}
