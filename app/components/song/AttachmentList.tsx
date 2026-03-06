'use client';

import { useState } from 'react';
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
  onReorder: (orderedIds: string[]) => void;
  onAddText: () => void;
  onAddImage: () => void;
}

function SortableCard({
  attachment,
  onEdit,
  onDelete,
  onToggleDefault,
}: {
  attachment: Attachment;
  onEdit: () => void;
  onDelete: () => void;
  onToggleDefault: () => void;
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
  onReorder,
  onAddText,
  onAddImage,
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

  const handleDelete = (attachmentId: string) => {
    if (confirm('Delete this attachment?')) {
      onDelete(attachmentId);
    }
  };

  if (attachments.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-4 pb-20">
        <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider block mb-4">
          Attachments
        </label>
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <svg
            className="w-16 h-16 text-[var(--muted)] mb-4"
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
          <p className="text-[var(--muted)] mb-2">Add notes, images, or charts</p>
          <div className="flex gap-2 mt-2">
            <button
              onClick={onAddText}
              className="px-4 py-2 rounded-xl bg-[var(--accent)] text-white font-semibold text-sm active:scale-95 transition-all"
            >
              + Text
            </button>
            <button
              onClick={onAddImage}
              className="px-4 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] font-semibold text-sm active:scale-95 transition-all"
            >
              + Image
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 pb-20">
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
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Add button */}
      <div className="relative mt-3">
        <button
          onClick={() => setShowAddMenu(!showAddMenu)}
          className="w-full py-2.5 rounded-xl border-2 border-dashed border-[var(--border)] text-[var(--muted)] font-medium text-sm hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
        >
          + Add
        </button>
        {showAddMenu && (
          <div className="absolute left-0 right-0 top-full mt-1 bg-[var(--background)] border border-[var(--border)] rounded-xl shadow-lg z-10 py-1 overflow-hidden">
            <button
              onClick={() => { onAddText(); setShowAddMenu(false); }}
              className="w-full text-left px-4 py-2.5 text-sm text-[var(--foreground)] hover:bg-[var(--card)] flex items-center gap-2"
            >
              <svg className="w-4 h-4 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Text
            </button>
            <button
              onClick={() => { onAddImage(); setShowAddMenu(false); }}
              className="w-full text-left px-4 py-2.5 text-sm text-[var(--foreground)] hover:bg-[var(--card)] flex items-center gap-2"
            >
              <svg className="w-4 h-4 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Image
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
