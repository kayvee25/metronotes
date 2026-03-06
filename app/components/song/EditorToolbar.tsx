'use client';

import { Editor } from '@tiptap/react';
import { useState, useRef, useCallback } from 'react';

interface EditorToolbarProps {
  editor: Editor | null;
}

const COLORS = [
  { label: 'Default', value: '' },
  { label: 'Red', value: '#ef4444' },
  { label: 'Orange', value: '#f97316' },
  { label: 'Yellow', value: '#eab308' },
  { label: 'Green', value: '#22c55e' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Purple', value: '#a855f7' },
  { label: 'Pink', value: '#ec4899' },
];

export default function EditorToolbar({ editor }: EditorToolbarProps) {
  const [showColors, setShowColors] = useState(false);
  const colorRef = useRef<HTMLDivElement>(null);

  const handleColorSelect = useCallback((color: string) => {
    if (!editor) return;
    if (color === '') {
      editor.chain().focus().unsetColor().run();
    } else {
      editor.chain().focus().setColor(color).run();
    }
    setShowColors(false);
  }, [editor]);

  if (!editor) return null;

  const btn = (active: boolean) =>
    `flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
      active
        ? 'bg-[var(--accent)] text-white'
        : 'text-[var(--foreground)] hover:bg-[var(--card)]'
    }`;

  return (
    <div className="border-t border-[var(--border)] bg-[var(--background)]">
      <div className="flex items-center gap-1 px-2 py-1.5 overflow-x-auto no-scrollbar">
        {/* Bold */}
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={btn(editor.isActive('bold'))}
          aria-label="Bold"
        >
          <span className="font-bold text-sm">B</span>
        </button>

        {/* Italic */}
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={btn(editor.isActive('italic'))}
          aria-label="Italic"
        >
          <span className="italic text-sm">I</span>
        </button>

        {/* H1 */}
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={btn(editor.isActive('heading', { level: 1 }))}
          aria-label="Heading 1"
        >
          <span className="font-bold text-xs">H1</span>
        </button>

        {/* H2 */}
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={btn(editor.isActive('heading', { level: 2 }))}
          aria-label="Heading 2"
        >
          <span className="font-bold text-xs">H2</span>
        </button>

        {/* Bullet list */}
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={btn(editor.isActive('bulletList'))}
          aria-label="Bullet list"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h.01M8 6h12M4 12h.01M8 12h12M4 18h.01M8 18h12" />
          </svg>
        </button>

        {/* Ordered list */}
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={btn(editor.isActive('orderedList'))}
          aria-label="Numbered list"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h.01M8 6h12M4 12h.01M8 12h12M4 18h.01M8 18h12" />
            <text x="2" y="8" fontSize="6" fill="currentColor" stroke="none" fontWeight="bold">1</text>
          </svg>
        </button>

        {/* Code block */}
        <button
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={btn(editor.isActive('codeBlock'))}
          aria-label="Code block"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        </button>

        {/* Text color */}
        <div className="relative flex-shrink-0" ref={colorRef}>
          <button
            onClick={() => setShowColors(!showColors)}
            className={btn(showColors)}
            aria-label="Text color"
          >
            <span className="text-sm font-bold" style={{ color: editor.getAttributes('textStyle').color || 'currentColor' }}>A</span>
            <span
              className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full"
              style={{ backgroundColor: editor.getAttributes('textStyle').color || 'var(--foreground)' }}
            />
          </button>

          {showColors && (
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[var(--background)] border border-[var(--border)] rounded-xl shadow-lg p-2 flex gap-1.5 z-10">
              {COLORS.map((c) => (
                <button
                  key={c.value || 'default'}
                  onClick={() => handleColorSelect(c.value)}
                  className="w-7 h-7 rounded-full border border-[var(--border)] hover:scale-110 transition-transform"
                  style={{ backgroundColor: c.value || 'var(--foreground)' }}
                  aria-label={c.label}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
