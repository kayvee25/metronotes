'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { AnnotationLayer } from '../../types';
import { useDrawing } from '../../hooks/useDrawing';
import { useConfirm } from '../ui/ConfirmModal';
import {
  useZoomPan, useDrawingGestures,
  DrawingToolbar, DrawingHeader, StrokeRenderer,
} from './drawing-shared';

interface AnnotationOverlayProps {
  isOpen: boolean;
  backgroundContent: React.ReactNode;
  baseWidth: number;
  baseHeight: number;
  initialAnnotations?: AnnotationLayer | null;
  onSave: (annotations: AnnotationLayer) => void;
  title?: string;
}

export default function AnnotationOverlay({
  isOpen,
  backgroundContent,
  baseWidth,
  baseHeight,
  initialAnnotations,
  onSave,
  title = 'Annotate',
}: AnnotationOverlayProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });
  const confirm = useConfirm();

  const {
    zoom, panX, panY, setZoom, setPanX, setPanY,
    containerRef, setContentSize, clampPan,
    handleZoomIn, handleZoomOut, handleZoomReset, handleWheel,
  } = useZoomPan();

  // Sync content size to useZoomPan for proper pan clamping
  useEffect(() => {
    if (displaySize.width > 0 && displaySize.height > 0) {
      setContentSize(displaySize.width, displaySize.height);
    }
  }, [displaySize.width, displaySize.height, setContentSize]);

  // Measure the displayed content size
  useEffect(() => {
    if (!isOpen || !contentRef.current) return;
    const measure = () => {
      if (!contentRef.current) return;
      const rect = contentRef.current.getBoundingClientRect();
      setDisplaySize({ width: rect.width, height: rect.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, [isOpen]);

  const {
    strokes, currentPoints,
    activeTool, setActiveTool,
    activeColor, setActiveColor,
    startStroke, addPoint, endStroke,
    undo, clearAll, erase,
  } = useDrawing({
    initialData: initialAnnotations ? {
      strokes: initialAnnotations.strokes,
      canvasWidth: baseWidth,
      canvasHeight: baseHeight,
    } : null,
    canvasWidth: baseWidth,
    canvasHeight: baseHeight,
  });

  // Pinch zoom/pan callback — clamp and apply
  const onPinchZoomPan = useCallback((newZoom: number, newPanX: number, newPanY: number) => {
    const [cx, cy] = clampPan(newPanX, newPanY, newZoom);
    setZoom(newZoom); setPanX(cx); setPanY(cy);
  }, [clampPan, setZoom, setPanX, setPanY]);

  const { handlePointerDown, handlePointerMove, handlePointerUp } = useDrawingGestures({
    svgRef, baseWidth, baseHeight,
    displayWidth: displaySize.width,
    zoom, panX, panY,
    activeTool, strokes,
    startStroke, addPoint, endStroke, erase,
    onPinchZoomPan,
  });

  const handleBack = useCallback(() => {
    onSave({ strokes, baseWidth, baseHeight });
  }, [onSave, strokes, baseWidth, baseHeight]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[var(--background)] flex flex-col max-w-3xl mx-auto">
      <DrawingHeader title={title} onBack={handleBack} />

      {/* Content area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden flex items-center justify-center bg-black/20 p-4"
        onWheel={handleWheel}
      >
        <div
          ref={contentRef}
          className="relative max-w-full max-h-full"
          style={{
            transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: zoom === 1 && panX === 0 && panY === 0 ? 'transform 0.2s ease' : 'none',
          }}
        >
          {backgroundContent}

          {displaySize.width > 0 && (
            <svg
              ref={svgRef}
              width={displaySize.width}
              height={displaySize.height}
              viewBox={`0 0 ${baseWidth} ${baseHeight}`}
              className="absolute inset-0 touch-none"
              style={{ touchAction: 'none' }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              <StrokeRenderer strokes={strokes} currentPoints={currentPoints} activeColor={activeColor} activeTool={activeTool} />
            </svg>
          )}
        </div>
      </div>

      <DrawingToolbar
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        activeColor={activeColor}
        setActiveColor={setActiveColor}
        strokeCount={strokes.length}
        onUndo={undo}
        onClear={async () => {
          if (strokes.length > 0) {
            const ok = await confirm({ title: 'Clear all?', message: 'This will remove all annotation strokes.', confirmLabel: 'Clear', variant: 'danger' });
            if (ok) clearAll();
          }
        }}
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleZoomReset}
      />
    </div>
  );
}
