'use client';

import { useRef, useCallback, useState } from 'react';
import { DrawingData } from '../../types';
import { useDrawing } from '../../hooks/useDrawing';
import {
  hitTest, pinchDistance, pinchCenter,
  useZoomPan, MIN_ZOOM, MAX_ZOOM,
  DrawingToolbar, ClearConfirmDialog, DrawingHeader, StrokeRenderer,
} from './drawing-shared';

// Fixed canvas size — portrait orientation for mobile-first use
const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1920;

interface DrawingCanvasProps {
  isOpen: boolean;
  initialData?: DrawingData | null;
  onSave: (data: DrawingData) => void;
}

export default function DrawingCanvas({ isOpen, initialData, onSave }: DrawingCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const {
    zoom, panX, panY, setZoom, setPanX, setPanY,
    containerRef, clampPan,
    handleZoomIn, handleZoomOut, handleZoomReset, handleWheel,
  } = useZoomPan();

  const canvasWidth = initialData?.canvasWidth || CANVAS_WIDTH;
  const canvasHeight = initialData?.canvasHeight || CANVAS_HEIGHT;

  const {
    strokes, currentPoints,
    activeTool, setActiveTool,
    activeColor, setActiveColor,
    startStroke, addPoint, endStroke,
    undo, clearAll, erase, getDrawingData,
  } = useDrawing({ initialData, canvasWidth, canvasHeight });

  // Gesture tracking
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const gestureRef = useRef<'none' | 'draw' | 'pinch'>('none');
  const isDrawingRef = useRef(false);
  const lastPinchRef = useRef<{ dist: number; cx: number; cy: number } | null>(null);

  const screenToBase = useCallback((clientX: number, clientY: number, pressure: number = 0.5): [number, number, number] => {
    if (!svgRef.current) return [0, 0, pressure];
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = canvasWidth / rect.width;
    const scaleY = canvasHeight / rect.height;
    return [(clientX - rect.left) * scaleX, (clientY - rect.top) * scaleY, pressure];
  }, [canvasWidth, canvasHeight]);

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
        const hit = hitTest(pos[0], pos[1], strokes);
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
  }, [activeTool, strokes, screenToBase, startStroke, erase, cancelCurrentStroke]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (gestureRef.current === 'draw' && pointersRef.current.size === 1) {
      const pos = screenToBase(e.clientX, e.clientY, e.pressure || 0.5);
      if (activeTool === 'eraser') {
        const hit = hitTest(pos[0], pos[1], strokes);
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
  }, [activeTool, strokes, screenToBase, addPoint, erase, zoom, panX, panY, clampPan, setZoom, setPanX, setPanY]);

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
    onSave(getDrawingData());
  }, [onSave, getDrawingData]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[var(--background)] flex flex-col max-w-3xl mx-auto">
      <DrawingHeader title="Drawing" onBack={handleBack} />

      {/* Canvas area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden bg-white relative flex items-center justify-center"
        onWheel={handleWheel}
      >
        <div
          style={{
            transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: zoom === 1 && panX === 0 && panY === 0 ? 'transform 0.2s ease' : 'none',
          }}
        >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
            className="block bg-white border border-gray-200"
            style={{ width: '100vw', maxWidth: '100vw', maxHeight: 'calc(100vh - 200px)', aspectRatio: `${canvasWidth}/${canvasHeight}`, touchAction: 'none' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <StrokeRenderer strokes={strokes} currentPoints={currentPoints} activeColor={activeColor} activeTool={activeTool} />
          </svg>
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
        label="strokes from the drawing"
      />
    </div>
  );
}
