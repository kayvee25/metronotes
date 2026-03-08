'use client';

import { useState } from 'react';
import { Attachment } from '../../types';
import { isCloudLinked } from '../../lib/cloud-providers/types';

interface AttachmentCardProps {
  attachment: Attachment;
  onEdit: () => void;
  onDelete: () => void;
  onToggleDefault: () => void;
  onNameChange: (name: string) => void;
  dragHandleProps?: Record<string, unknown>;
}

function getTextPreview(content?: object): string {
  if (!content || typeof content !== 'object') return '';
  const doc = content as { content?: Array<{ content?: Array<{ text?: string }> }> };
  if (!doc.content) return '';
  const lines: string[] = [];
  for (const node of doc.content) {
    if (node.content) {
      lines.push(node.content.map(c => c.text || '').join(''));
    } else {
      lines.push('');
    }
    if (lines.length >= 3) break;
  }
  return lines.join('\n') || 'Empty text';
}

export default function AttachmentCard({
  attachment,
  onEdit,
  onDelete,
  onToggleDefault,
  onNameChange,
  dragHandleProps,
}: AttachmentCardProps) {
  const isText = attachment.type === 'richtext';
  const isPdf = attachment.type === 'pdf';
  const isDrawing = attachment.type === 'drawing';
  const isMedia = attachment.type === 'image' || isPdf;
  const isCloud = isCloudLinked(attachment);
  const isUploading = isMedia && !attachment.storageUrl && !isCloud;
  const canEdit = isText || isDrawing || (isMedia && !isCloud);
  const preview = isText
    ? getTextPreview(attachment.content)
    : isDrawing
      ? 'Freehand drawing'
      : isUploading
        ? 'Uploading...'
        : isPdf
          ? (attachment.pageCount ? `${attachment.pageCount} ${attachment.pageCount === 1 ? 'page' : 'pages'}` : 'PDF document')
          : attachment.fileName || 'Image';
  const [localName, setLocalName] = useState(attachment.name || '');

  return (
    <div className="flex items-center gap-2 px-3 py-3 bg-[var(--card)] border border-[var(--border)] rounded-xl">
      {/* Drag handle */}
      <div
        className="flex-shrink-0 cursor-grab active:cursor-grabbing touch-none text-[var(--muted)]"
        {...dragHandleProps}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h16M4 16h16" />
        </svg>
      </div>

      {/* Type icon / thumbnail */}
      <div className="relative flex-shrink-0">
      <div className="w-10 h-10 rounded-lg bg-[var(--background)] flex items-center justify-center overflow-hidden">
        {isText ? (
          <svg className="w-4 h-4 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        ) : isDrawing ? (
          <svg className="w-4 h-4 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        ) : isPdf ? (
          attachment.storageUrl || isCloud ? (
            <svg className="w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
              <text x="12" y="17" textAnchor="middle" fontSize="6" fontWeight="bold" fill="currentColor">PDF</text>
            </svg>
          ) : (
            <svg className="w-4 h-4 text-[var(--muted)] animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={3} opacity={0.25} />
              <path d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
            </svg>
          )
        ) : attachment.storageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={attachment.storageUrl} alt="" className="w-full h-full object-cover" />
        ) : isCloud ? (
          <svg className="w-4 h-4 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-[var(--muted)] animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={3} opacity={0.25} />
            <path d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
          </svg>
        )}
      </div>
        {isCloudLinked(attachment) && (
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-white flex items-center justify-center shadow-sm">
            <svg className="w-2.5 h-2.5" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
              <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H1.5c0 1.55.4 3.1 1.2 4.5l3.9 9.35z" fill="#0066DA"/>
              <path d="M43.65 25L29.9 1.2C28.55 2 27.4 3.1 26.6 4.5L1.5 48.2c-.8 1.4-1.2 2.95-1.2 4.5h27.5L43.65 25z" fill="#00AC47"/>
              <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8L53 65.3l-9.35 11.5h16.25c3.8 0 7.3-1.3 10.15-3.5z" fill="#EA4335"/>
              <path d="M43.65 25L57.4 1.2C56.05.4 54.5 0 52.85 0H34.44c-1.65 0-3.2.4-4.55 1.2L43.65 25z" fill="#00832D"/>
              <path d="M59.8 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.55 1.2h36.65c1.65 0 3.2-.4 4.55-1.2L59.8 53z" fill="#2684FC"/>
              <path d="M73.4 26.5l-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25l16.15 28h27.5c0-1.55-.4-3.1-1.2-4.5L73.4 26.5z" fill="#FFBA00"/>
            </svg>
          </div>
        )}
      </div>

      {/* Name + preview */}
      <div className="flex-1 min-w-0">
        <input
          type="text"
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
          onBlur={() => {
            if (localName !== (attachment.name || '')) {
              onNameChange(localName);
            }
          }}
          placeholder={isText ? 'Text' : isDrawing ? 'Drawing' : isPdf ? 'PDF' : 'Image'}
          className="text-sm text-[var(--foreground)] bg-transparent w-full truncate placeholder:text-[var(--foreground)] focus:placeholder:text-[var(--muted)] outline-none"
        />
        <p className="text-xs text-[var(--muted)] truncate">{preview}</p>
      </div>

      {/* Default star */}
      <button
        onClick={onToggleDefault}
        className="flex-shrink-0 w-8 h-8 flex items-center justify-center"
        aria-label={attachment.isDefault ? 'Default attachment' : 'Set as default'}
      >
        <svg
          className={`w-4 h-4 ${attachment.isDefault ? 'text-[var(--accent)] fill-[var(--accent)]' : 'text-[var(--muted)]'}`}
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          fill={attachment.isDefault ? 'currentColor' : 'none'}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      </button>

      {/* Edit button — hidden for cloud-linked images/PDFs (no annotation support) */}
      {canEdit && (
        <button
          onClick={onEdit}
          className="flex-shrink-0 w-8 h-8 rounded-lg hover:bg-[var(--background)] flex items-center justify-center"
          aria-label="Edit attachment"
        >
          <svg className="w-4 h-4 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
      )}

      {/* Delete button */}
      <button
        onClick={onDelete}
        className="flex-shrink-0 w-8 h-8 rounded-lg hover:bg-[var(--accent-danger)]/10 flex items-center justify-center"
        aria-label="Delete attachment"
      >
        <svg className="w-4 h-4 text-[var(--accent-danger)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  );
}
