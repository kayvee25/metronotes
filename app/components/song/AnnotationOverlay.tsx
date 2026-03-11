'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { AnnotationLayer } from '../../types';
import { useDrawing } from '../../hooks/useDrawing';
import {
  hitTest, pinchDistance, pinchCenter,
  useZoomPan, MIN_ZOOM, MAX_ZOOM,
  DrawingToolbar, ClearConfirmDialog, DrawingHeader, StrokeRenderer,
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
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const {
    zoom, panX, panY, setZoom, setPanX, setPanY,
    containerRef, clampPan,
    handleZoomIn, handleZoomOut, handleZoomReset, handleWheel,
  } = useZoomPan();

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

  // Gesture tracking
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const gestureRef = useRef<'none' | 'draw' | 'pinch'>('none');
  const isDrawingRef = useRef(false);
  const lastPinchRef = useRef<{ dist: number; cx: number; cy: number } | null>(null);

  const screenToBase = useCallback((clientX: number, clientY: number, pressure: number = 0.5): [number, number, number] => {
    if (!svgRef.current) return [0, 0, pressure];
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = baseWidth / rect.width;
    const scaleY = baseHeight / rect.height;
    return [(clientX - rect.left) * scaleX, (clientY - rect.top) * scaleY, pressure];
  }, [baseWidth, baseHeight]);

  const cancelCurrentStroke = useCallback(() => {
    if (isDrawingRef.current) {
      isDrawingRef.current = false;
      endStroke();
    }
  }, [endStroke]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 1) {
      gestureRef.current = 'draw';
      const pos = screenToBase(e.clientX, e.clientY, e.pressure || 0.5);
      if (activeTool === 'eraser') {
        const effectiveScale = displaySize.width > 0 ? displaySize.width * zoom / baseWidth : 1;
        const hit = hitTest(pos[0], pos[1], strokes, 20 / effectiveScale);
        if (hit) erase(hit);
        return;
      }
      isDrawingRef.current = true;
      startStroke(pos);
    } else if (pointersRef.current.size === 2) {
      cancelCurrentStroke();
      gestureRef.current = 'pinch';
      const [a, b] = Array.from(pointersRef.current.values());
      lastPinchRef.current = { dist: pinchDistance(a, b), cx: pinchCenter(a, b).x, cy: pinchCenter(a, b).y };
    }
  }, [activeTool, strokes, screenToBase, startStroke, erase, cancelCurrentStroke, baseWidth, displaySize.width, zoom]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (gestureRef.current === 'draw' && pointersRef.current.size === 1) {
      const pos = screenToBase(e.clientX, e.clientY, e.pressure || 0.5);
      if (activeTool === 'eraser') {
        const effectiveScale = displaySize.width > 0 ? displaySize.width * zoom / baseWidth : 1;
        const hit = hitTest(pos[0], pos[1], strokes, 20 / effectiveScale);
        if (hit) erase(hit);
        return;
      }
      if (isDrawingRef.current) addPoint(pos);
    } else if (gestureRef.current === 'pinch' && pointersRef.current.size === 2 && lastPinchRef.current) {
      const [a, b] = Array.from(pointersRef.current.values());
      const newDist = pinchDistance(a, b);
      const newCenter = pinchCenter(a, b);
      const zoomDelta = newDist / lastPinchRef.current.dist;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * zoomDelta));
      const dx = newCenter.x - lastPinchRef.current.cx;
      const dy = newCenter.y - lastPinchRef.current.cy;
      lastPinchRef.current = { dist: newDist, cx: newCenter.x, cy: newCenter.y };
      const [cx, cy] = clampPan(panX + dx, panY + dy, newZoom);
      setZoom(newZoom); setPanX(cx); setPanY(cy);
    }
  }, [activeTool, strokes, screenToBase, addPoint, erase, zoom, panX, panY, baseWidth, displaySize.width, clampPan, setZoom, setPanX, setPanY]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size === 0) {
      if (gestureRef.current === 'draw' && isDrawingRef.current) {
        isDrawingRef.current = false;
        endStroke();
      }
      gestureRef.current = 'none';
      lastPinchRef.current = null;
    }
  }, [endStroke]);

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
        onClear={() => { if (strokes.length > 0) setShowClearConfirm(true); }}
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleZoomReset}
      />

      <ClearConfirmDialog
        isOpen={showClearConfirm}
        onCancel={() => setShowClearConfirm(false)}
        onConfirm={() => { clearAll(); setShowClearConfirm(false); }}
        label="annotation strokes"
      />
    </div>
  );
}
