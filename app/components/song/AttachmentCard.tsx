'use client';

import { Attachment } from '../../types';

interface AttachmentCardProps {
  attachment: Attachment;
  onEdit: () => void;
  onDelete: () => void;
  onToggleDefault: () => void;
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
  dragHandleProps,
}: AttachmentCardProps) {
  const isText = attachment.type === 'richtext';
  const preview = isText ? getTextPreview(attachment.content) : attachment.fileName || 'Image';

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
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[var(--background)] flex items-center justify-center overflow-hidden">
        {isText ? (
          <svg className="w-4 h-4 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        ) : attachment.storageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={attachment.storageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <svg className="w-4 h-4 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        )}
      </div>

      {/* Preview */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--foreground)] truncate">
          {isText ? 'Text' : 'Image'}
        </p>
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

      {/* Edit button */}
      <button
        onClick={onEdit}
        className="flex-shrink-0 w-8 h-8 rounded-lg hover:bg-[var(--background)] flex items-center justify-center"
        aria-label="Edit attachment"
      >
        <svg className="w-4 h-4 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </button>

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
