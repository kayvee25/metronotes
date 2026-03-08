'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Color from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { useConfirm } from '../ui/ConfirmModal';
import { ANIMATION } from '../../lib/constants';
import EditorToolbar from './EditorToolbar';

interface RichTextEditorProps {
  isOpen: boolean;
  content?: object;
  onSave: (content: object) => void;
  onCancel: () => void;
}

export default function RichTextEditor({
  isOpen,
  content,
  onSave,
  onCancel,
}: RichTextEditorProps) {
  const confirm = useConfirm();
  const savedContentRef = useRef<object | undefined>(content);
  const [editorDirty, setEditorDirty] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: {
          HTMLAttributes: {
            class: 'font-mono bg-[var(--card)] rounded-lg p-3 my-2',
          },
        },
      }),
      TextStyle,
      Color,
    ],
    content: content || { type: 'doc', content: [{ type: 'paragraph' }] },
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none focus:outline-none min-h-full px-4 py-3 text-[var(--foreground)]',
      },
    },
    immediatelyRender: false,
  });

  // Update editor content when opening with new content
  useEffect(() => {
    if (isOpen && editor) {
      const newContent = content || { type: 'doc', content: [{ type: 'paragraph' }] };
      savedContentRef.current = content;
      editor.commands.setContent(newContent);
      // Focus editor after opening; dirty state resets via the editor update handler
      setTimeout(() => {
        setEditorDirty(false);
        editor.commands.focus('end');
      }, ANIMATION.EDITOR_FOCUS_DELAY_MS);
    }
  }, [isOpen, editor, content]);

  // Track dirty state via editor updates
  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      const current = JSON.stringify(editor.getJSON());
      const saved = JSON.stringify(savedContentRef.current || { type: 'doc', content: [{ type: 'paragraph' }] });
      setEditorDirty(current !== saved);
    };
    editor.on('update', handler);
    return () => { editor.off('update', handler); };
  }, [editor]);

  // Handle keyboard height on mobile
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const viewport = window.visualViewport;
    if (!viewport) return;

    const handleResize = () => {
      if (toolbarRef.current) {
        const keyboardHeight = window.innerHeight - viewport.height - viewport.offsetTop;
        toolbarRef.current.style.bottom = `${Math.max(0, keyboardHeight)}px`;
      }
    };

    viewport.addEventListener('resize', handleResize);
    viewport.addEventListener('scroll', handleResize);
    return () => {
      viewport.removeEventListener('resize', handleResize);
      viewport.removeEventListener('scroll', handleResize);
    };
  }, [isOpen]);

  const handleDone = useCallback(() => {
    if (editor) {
      onSave(editor.getJSON());
    }
  }, [editor, onSave]);

  const handleCancel = useCallback(async () => {
    if (editorDirty) {
      const ok = await confirm({
        title: 'Discard Changes',
        message: 'You have unsaved changes. Discard them?',
        confirmLabel: 'Discard',
        variant: 'danger',
      });
      if (!ok) return;
    }
    onCancel();
  }, [editorDirty, confirm, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[var(--background)] flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <button
          onClick={handleCancel}
          className="text-[var(--muted)] font-medium text-sm hover:text-[var(--foreground)] transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleDone}
          disabled={!editorDirty}
          className={`px-4 py-1.5 rounded-xl bg-[var(--accent)] text-white font-semibold text-sm transition-all ${
            editorDirty ? 'active:scale-95' : 'opacity-50 pointer-events-none'
          }`}
        >
          Done
        </button>
      </header>

      {/* Editor area */}
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} className="min-h-full" />
      </div>

      {/* Toolbar — positioned above keyboard on mobile */}
      <div ref={toolbarRef} className="fixed left-0 right-0 bottom-0 z-50">
        <EditorToolbar editor={editor} />
      </div>
    </div>
  );
}
