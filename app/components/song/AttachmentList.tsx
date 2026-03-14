'use client';

import { useState } from 'react';
import { useConfirm } from '../ui/ConfirmModal';
import Modal from '../ui/Modal';
import { Attachment } from '../../types';
import type { CloudProviderId } from '../../lib/cloud-providers/types';
import { getAvailableProviders } from '../../lib/cloud-providers';
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
  onAddCamera: () => void;
  onAddPdf: () => void;
  onAddDrawing: () => void;
  onAddFromCloud?: (providerId: CloudProviderId) => void;
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
    <div ref={setNodeRef} style={style} {...attributes} data-testid="attachment-item">
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
  onAddCamera,
  onAddPdf,
  onAddDrawing,
  onAddFromCloud,
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

  const addMenuModal = (
    <Modal isOpen={showAddMenu} onClose={() => setShowAddMenu(false)} title="Add Attachment">
      <div className="space-y-1.5 -mt-2">
        <button
          data-testid="attach-type-text"
          onClick={() => { onAddText(); setShowAddMenu(false); }}
          className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--background)] active:scale-[0.98] transition-all"
        >
          <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
            <svg className="w-4.5 h-4.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h12" />
            </svg>
          </div>
          <span className="text-sm font-medium text-[var(--foreground)]">Text</span>
        </button>
        <button
          data-testid="attach-type-image"
          onClick={() => { onAddImage(); setShowAddMenu(false); }}
          className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--background)] active:scale-[0.98] transition-all"
        >
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
            <svg className="w-4.5 h-4.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="text-sm font-medium text-[var(--foreground)]">Image</span>
        </button>
        <button
          data-testid="attach-type-camera"
          onClick={() => { onAddCamera(); setShowAddMenu(false); }}
          className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--background)] active:scale-[0.98] transition-all"
        >
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
            <svg className="w-4.5 h-4.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <circle cx="12" cy="13" r="3" />
            </svg>
          </div>
          <span className="text-sm font-medium text-[var(--foreground)]">Camera</span>
        </button>
        <button
          data-testid="attach-type-pdf"
          onClick={() => { onAddPdf(); setShowAddMenu(false); }}
          className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--background)] active:scale-[0.98] transition-all"
        >
          <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
            <svg className="w-4.5 h-4.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17h6m-6-4h6" />
            </svg>
          </div>
          <span className="text-sm font-medium text-[var(--foreground)]">PDF</span>
        </button>
        <button
          data-testid="attach-type-drawing"
          onClick={() => { onAddDrawing(); setShowAddMenu(false); }}
          className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--background)] active:scale-[0.98] transition-all"
        >
          <div className="w-9 h-9 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center flex-shrink-0">
            <svg className="w-4.5 h-4.5 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </div>
          <span className="text-sm font-medium text-[var(--foreground)]">Drawing</span>
        </button>
      </div>
      {onAddFromCloud && (
        <div className="mt-1.5 pt-1.5 border-t border-[var(--border)] space-y-1.5">
          {getAvailableProviders().map((provider) => (
            <button
              key={provider.id}
              onClick={() => { onAddFromCloud(provider.id); setShowAddMenu(false); }}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--background)] active:scale-[0.98] transition-all"
            >
              <div className="w-9 h-9 rounded-lg bg-[#4285F4]/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-4.5 h-4.5" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                  <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H1.5c0 1.55.4 3.1 1.2 4.5l3.9 9.35z" fill="#0066DA"/>
                  <path d="M43.65 25L29.9 1.2C28.55 2 27.4 3.1 26.6 4.5L1.5 48.2c-.8 1.4-1.2 2.95-1.2 4.5h27.5L43.65 25z" fill="#00AC47"/>
                  <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8L53 65.3l-9.35 11.5h16.25c3.8 0 7.3-1.3 10.15-3.5z" fill="#EA4335"/>
                <path d="M43.65 25L57.4 1.2C56.05.4 54.5 0 52.85 0H34.44c-1.65 0-3.2.4-4.55 1.2L43.65 25z" fill="#00832D"/>
                <path d="M59.8 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.55 1.2h36.65c1.65 0 3.2-.4 4.55-1.2L59.8 53z" fill="#2684FC"/>
                <path d="M73.4 26.5l-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25l16.15 28h27.5c0-1.55-.4-3.1-1.2-4.5L73.4 26.5z" fill="#FFBA00"/>
              </svg>
              </div>
              <span className="text-sm font-medium text-[var(--foreground)]">From {provider.name}</span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );

  if (attachments.length === 0) {
    return (
      <div className="p-4">
        <label data-testid="section-attachments" className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider block mb-3">
          Attachments
        </label>
        <p className="text-sm text-[var(--muted)] mb-3">Add sheet music, chord charts, lyrics, or reference images</p>
        <button
          data-testid="btn-add-attachment"
          onClick={() => setShowAddMenu(true)}
          className="w-full py-3 rounded-xl border-2 border-dashed border-[var(--border)] text-[var(--muted)] font-medium text-sm hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          + Add Attachment
        </button>
        {addMenuModal}
      </div>
    );
  }

  return (
    <div className="p-4">
      <label data-testid="section-attachments" className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider block mb-3">
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
      <div className="mt-3">
        <button
          data-testid="btn-add-attachment"
          onClick={() => setShowAddMenu(true)}
          className="w-full py-2.5 rounded-xl border-2 border-dashed border-[var(--border)] text-[var(--muted)] font-medium text-sm hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          + Add Attachment
        </button>
      </div>

      {addMenuModal}
    </div>
  );
}
