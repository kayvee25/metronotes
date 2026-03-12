'use client';

import { useMemo, useState } from 'react';
import { Attachment } from '../../types';
import { generateHTML } from '@tiptap/html';
import StarterKit from '@tiptap/starter-kit';
import Color from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import PdfViewer from './PdfViewer';
import DrawingRenderer from './DrawingRenderer';
import AnnotationRenderer from './AnnotationRenderer';
import ZoomableContainer from '../ui/ZoomableContainer';
import { useCachedUrl } from '../../hooks/useCachedUrl';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { isCloudLinked } from '../../lib/cloud-providers/types';
import { getProvider } from '../../lib/cloud-providers';

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
  const isOnline = useOnlineStatus();
  const needsMedia = attachment.type === 'image' || attachment.type === 'pdf';
  const cloudInfo = needsMedia && isCloudLinked(attachment)
    ? { provider: attachment.cloudProvider!, fileId: attachment.cloudFileId! }
    : undefined;
  const { url: resolvedUrl, loading: urlLoading, needsReauth } = useCachedUrl(
    needsMedia ? attachment.id : undefined,
    needsMedia ? attachment.storageUrl : undefined,
    isOnline,
    cloudInfo,
  );
  const [isReauthing, setIsReauthing] = useState(false);

  const handleReauth = async () => {
    if (!attachment.cloudProvider) return;
    const provider = getProvider(attachment.cloudProvider as 'google-drive');
    if (!provider) return;
    setIsReauthing(true);
    try {
      await provider.requestAccess();
      // Force re-render by reloading page — token is now in sessionStorage
      window.location.reload();
    } catch {
      setIsReauthing(false);
    }
  };
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
      <ZoomableContainer>
        <div
          className={`tiptap ${fontSizeClass} ${fontFamilyClass} text-[var(--foreground)] leading-relaxed`}
          style={serifStyle}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </ZoomableContainer>
    );
  }

  if (attachment.type === 'image') {
    if (urlLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <svg className="w-6 h-6 text-[var(--muted)] animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={3} opacity={0.25} />
            <path d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
          </svg>
        </div>
      );
    }
    if (!resolvedUrl) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-[var(--muted)]">
          <svg className="w-12 h-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
          </svg>
          <p className="text-sm">{!isOnline ? 'Not available offline' : needsReauth ? 'Google Drive session expired' : isCloudLinked(attachment) ? 'Image not available' : 'Image not available'}</p>
          {needsReauth && (
            <button
              onClick={handleReauth}
              disabled={isReauthing}
              className="mt-3 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
            >
              {isReauthing ? 'Connecting...' : 'Reconnect Google Drive'}
            </button>
          )}
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center h-full">
        <ZoomableContainer>
          <div className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resolvedUrl}
              alt={attachment.fileName || 'Image'}
              className="max-w-full max-h-full object-contain"
            />
            {attachment.annotations && attachment.annotations.strokes.length > 0 && (
              <AnnotationRenderer
                annotations={attachment.annotations}
                containerWidth={attachment.width || 800}
                containerHeight={attachment.height || 600}
                visible={true}
              />
            )}
          </div>
        </ZoomableContainer>
      </div>
    );
  }

  if (attachment.type === 'pdf') {
    if (urlLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <svg className="w-6 h-6 text-[var(--muted)] animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={3} opacity={0.25} />
            <path d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
          </svg>
        </div>
      );
    }
    if (!resolvedUrl) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-[var(--muted)]">
          <svg className="w-12 h-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <p className="text-sm">{!isOnline ? 'Not available offline' : needsReauth ? 'Google Drive session expired' : 'PDF not available'}</p>
          {needsReauth && (
            <button
              onClick={handleReauth}
              disabled={isReauthing}
              className="mt-3 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
            >
              {isReauthing ? 'Connecting...' : 'Reconnect Google Drive'}
            </button>
          )}
        </div>
      );
    }
    return (
      <ZoomableContainer>
        <PdfViewer
          storageUrl={resolvedUrl}
          pageCount={attachment.pageCount}
          pageAnnotations={attachment.pageAnnotations}
        />
      </ZoomableContainer>
    );
  }

  if (attachment.type === 'drawing') {
    return attachment.drawingData ? (
      <ZoomableContainer>
        <DrawingRenderer drawingData={attachment.drawingData} />
      </ZoomableContainer>
    ) : (
      <div className="flex items-center justify-center h-full">
        <p className="text-[var(--muted)]">Empty drawing</p>
      </div>
    );
  }

  return null;
}
