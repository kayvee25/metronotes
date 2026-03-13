'use client';

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
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useConfirm } from '../ui/ConfirmModal';
import type { QueueItem } from '../../lib/live-session/protocol';

interface SessionQueueProps {
  queue: QueueItem[];
  currentIndex: number | null;
  onNavigate?: (index: number) => void;
  onRemove?: (index: number) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  isHost: boolean;
  onAddSongs?: () => void;
  songDownloadStatus?: Map<string, { total: number; received: number }>;
}

interface SortableQueueItemProps {
  item: QueueItem;
  index: number;
  isCurrent: boolean;
  isPast: boolean;
  isHost: boolean;
  onNavigate?: (index: number) => void;
  onRemove?: (index: number) => void;
  downloadStatus?: { total: number; received: number } | null;
}

function SortableQueueItem({
  item,
  index,
  isCurrent,
  isPast,
  isHost,
  onNavigate,
  onRemove,
  downloadStatus,
}: SortableQueueItemProps) {
  const canDrag = isHost;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `queue-${index}`,
    disabled: !canDrag,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : isPast ? 0.5 : 1,
    zIndex: isDragging ? 1 : 0,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
        isCurrent
          ? 'bg-[var(--accent)]/15 border border-[var(--accent)]/30'
          : isPast
            ? ''
            : 'bg-[var(--surface)]'
      } ${isDragging ? 'shadow-lg' : ''}`}
    >
      {/* Drag handle (host, upcoming only) — spacer for alignment on non-draggable */}
      {isHost && (
        canDrag ? (
          <button
            {...attributes}
            {...listeners}
            className="w-6 h-6 flex items-center justify-center shrink-0 cursor-grab active:cursor-grabbing touch-none text-[var(--muted)]"
            aria-label="Drag to reorder"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="9" cy="6" r="1.5" />
              <circle cx="15" cy="6" r="1.5" />
              <circle cx="9" cy="12" r="1.5" />
              <circle cx="15" cy="12" r="1.5" />
              <circle cx="9" cy="18" r="1.5" />
              <circle cx="15" cy="18" r="1.5" />
            </svg>
          </button>
        ) : (
          <span className="w-6 shrink-0" />
        )
      )}

      {/* Index number */}
      <span
        className={`text-xs font-mono w-5 text-center shrink-0 ${
          isCurrent ? 'text-[var(--accent)] font-bold' : 'text-[var(--muted)]'
        }`}
      >
        {index + 1}
      </span>

      {/* Song info */}
      {onNavigate && isHost ? (
        <button
          onClick={() => onNavigate(index)}
          className="flex-1 text-left min-w-0"
        >
          <p
            className={`text-sm font-medium truncate ${
              isCurrent ? 'text-[var(--accent)]' : 'text-[var(--foreground)]'
            }`}
          >
            {item.song.name}
          </p>
          {item.song.artist && (
            <p className="text-xs text-[var(--muted)] truncate">
              {item.song.artist}
            </p>
          )}
        </button>
      ) : (
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-medium truncate ${
              isCurrent ? 'text-[var(--accent)]' : 'text-[var(--foreground)]'
            }`}
          >
            {item.song.name}
          </p>
          {item.song.artist && (
            <p className="text-xs text-[var(--muted)] truncate">
              {item.song.artist}
            </p>
          )}
        </div>
      )}

      {/* Download / current status (member) */}
      {!isHost && downloadStatus && downloadStatus.total > 0 && (
        downloadStatus.received >= downloadStatus.total ? (
          <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <div className="flex items-center gap-1 shrink-0">
            <div className="w-3.5 h-3.5 border-2 border-[var(--muted)] border-t-[var(--accent)] rounded-full animate-spin" />
            <span className="text-[10px] text-[var(--muted)] tabular-nums">
              {downloadStatus.received}/{downloadStatus.total}
            </span>
          </div>
        )
      )}
      {isCurrent && !isHost && (
        <span className="text-xs text-[var(--accent)] font-medium shrink-0">
          Now
        </span>
      )}

      {/* Remove button (host, upcoming only) */}
      {isHost && !isPast && !isCurrent && onRemove && (
        <button
          onClick={() => onRemove(index)}
          className="text-[var(--muted)] hover:text-red-400 transition-colors p-1 shrink-0"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

export default function SessionQueue({
  queue,
  currentIndex,
  onNavigate,
  onRemove,
  onReorder,
  isHost,
  onAddSongs,
  songDownloadStatus,
}: SessionQueueProps) {
  const confirm = useConfirm();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const handleRemove = async (index: number) => {
    const songName = queue[index]?.song.name ?? 'this song';
    const confirmed = await confirm({
      title: 'Remove from Queue',
      message: `Remove "${songName}" from the session queue?`,
      confirmLabel: 'Remove',
      variant: 'danger',
    });
    if (confirmed && onRemove) {
      onRemove(index);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !onReorder) return;

    const fromIndex = Number(String(active.id).replace('queue-', ''));
    const toIndex = Number(String(over.id).replace('queue-', ''));
    onReorder(fromIndex, toIndex);
  };

  if (queue.length === 0) {
    if (isHost && onAddSongs) {
      return (
        <button
          onClick={onAddSongs}
          className="w-full text-center py-6 text-[var(--muted)] text-sm border border-dashed border-[var(--border)] rounded-lg hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
        >
          + Add songs from Library
        </button>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
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
            d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
          />
        </svg>
        <p className="text-[var(--muted)] text-sm">
          Waiting for host to add songs...
        </p>
      </div>
    );
  }

  const sortableIds = queue.map((_, idx) => `queue-${idx}`);

  const queueItems = queue.map((item, idx) => {
    const isCurrent = idx === currentIndex;
    const isPast = currentIndex !== null && idx < currentIndex;
    return (
      <SortableQueueItem
        key={`${item.songId}-${idx}`}
        item={item}
        index={idx}
        isCurrent={isCurrent}
        isPast={isPast}
        isHost={isHost}
        onNavigate={onNavigate}
        onRemove={isHost ? handleRemove : undefined}
        downloadStatus={songDownloadStatus?.get(item.songId) ?? null}
      />
    );
  });

  if (isHost && onReorder) {
    return (
      <div className="space-y-1">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortableIds}
            strategy={verticalListSortingStrategy}
          >
            {queueItems}
          </SortableContext>
        </DndContext>
        {onAddSongs && (
          <button
            onClick={onAddSongs}
            className="w-full text-center py-2.5 text-sm text-[var(--muted)] hover:text-[var(--accent)] border border-dashed border-[var(--border)] rounded-lg hover:border-[var(--accent)] transition-colors"
          >
            + Add more songs
          </button>
        )}
      </div>
    );
  }

  return <div className="space-y-1">{queueItems}</div>;
}
