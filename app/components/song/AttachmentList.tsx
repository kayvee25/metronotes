'use client';

import { useState } from 'react';
import { useConfirm } from '../ui/ConfirmModal';
import Modal from '../ui/Modal';
import { Attachment } from '../../types';
import AttachmentCard from './AttachmentCard';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface AttachmentListProps {
  attachments: Attachment[];
  onEdit: (attachment: Attachment) => void;
  onDelete: (attachmentId: string) => void;
  onToggleDefault: (attachmentId: string) => void;
  onNameChange: (attachmentId: string, name: string) => void;
  onReorder: (orderedIds: string[]) => void;
  onAddText: () => void;
  onAddImage: () => void;
  onAddPdf: () => void;
  onAddDrawing: () => void;
}

function SortableCard({
  attachment,
  onEdit,
  onDelete,
  onToggleDefault,
  onNameChange,
}: {
  attachment: Attachment;
  onEdit: () => void;
  onDelete: () => void;
  onToggleDefault: () => void;
  onNameChange: (name: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: attachment.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <AttachmentCard
        attachment={attachment}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleDefault={onToggleDefault}
        onNameChange={onNameChange}
        dragHandleProps={listeners}
      />
    </div>
  );
}

export default function AttachmentList({
  attachments,
  onEdit,
  onDelete,
  onToggleDefault,
  onNameChange,
  onReorder,
  onAddText,
  onAddImage,
  onAddPdf,
  onAddDrawing,
}: AttachmentListProps) {
  const [showAddMenu, setShowAddMenu] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = attachments.findIndex(a => a.id === active.id);
      const newIndex = attachments.findIndex(a => a.id === over.id);
      const reordered = arrayMove(attachments, oldIndex, newIndex);
      onReorder(reordered.map(a => a.id));
    }
  };

  const confirmAction = useConfirm();

  const handleDelete = async (attachmentId: string) => {
    const ok = await confirmAction({
      title: 'Delete Attachment',
      message: 'Delete this attachment? This cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (ok) onDelete(attachmentId);
  };

  if (attachments.length === 0) {
    return (
      <div className="p-4">
        <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider block mb-4">
          Attachments
        </label>
        <div className="flex flex-col items-center justify-center h-48 text-center">
          <svg
            className="w-12 h-12 text-[var(--muted)] mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-[var(--muted)] mb-3">Add notes, images, or charts</p>
          <button
            onClick={() => setShowAddMenu(true)}
            className="px-5 py-2.5 rounded-xl bg-[var(--accent)] text-white font-semibold text-sm active:scale-95 transition-all"
          >
            + Add Attachment
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider block mb-3">
        Attachments
      </label>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={attachments.map(a => a.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {attachments.map((attachment) => (
              <SortableCard
                key={attachment.id}
                attachment={attachment}
                onEdit={() => onEdit(attachment)}
                onDelete={() => handleDelete(attachment.id)}
                onToggleDefault={() => onToggleDefault(attachment.id)}
                onNameChange={(name) => onNameChange(attachment.id, name)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Add button */}
      <div className="mt-3">
        <button
          onClick={() => setShowAddMenu(true)}
          className="w-full py-2.5 rounded-xl border-2 border-dashed border-[var(--border)] text-[var(--muted)] font-medium text-sm hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
        >
          + Add Attachment
        </button>
      </div>

      {/* Add attachment modal */}
      <Modal isOpen={showAddMenu} onClose={() => setShowAddMenu(false)} title="Add Attachment">
        <div className="grid grid-cols-2 gap-3 -mt-2">
          <button
            onClick={() => { onAddText(); setShowAddMenu(false); }}
            className="flex flex-col items-center gap-2.5 p-4 rounded-xl bg-[var(--card)] border border-[var(--border)] hover:border-blue-400 active:scale-95 transition-all"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h12" />
              </svg>
            </div>
            <span className="text-sm font-medium text-[var(--foreground)]">Text</span>
          </button>
          <button
            onClick={() => { onAddImage(); setShowAddMenu(false); }}
            className="flex flex-col items-center gap-2.5 p-4 rounded-xl bg-[var(--card)] border border-[var(--border)] hover:border-emerald-400 active:scale-95 transition-all"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-[var(--foreground)]">Image</span>
          </button>
          <button
            onClick={() => { onAddPdf(); setShowAddMenu(false); }}
            className="flex flex-col items-center gap-2.5 p-4 rounded-xl bg-[var(--card)] border border-[var(--border)] hover:border-red-400 active:scale-95 transition-all"
          >
            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17h6m-6-4h6" />
              </svg>
            </div>
            <span className="text-sm font-medium text-[var(--foreground)]">PDF</span>
          </button>
          <button
            onClick={() => { onAddDrawing(); setShowAddMenu(false); }}
            className="flex flex-col items-center gap-2.5 p-4 rounded-xl bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)] active:scale-95 transition-all"
          >
            <div className="w-10 h-10 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-[var(--foreground)]">Drawing</span>
          </button>
        </div>
      </Modal>
    </div>
  );
}
