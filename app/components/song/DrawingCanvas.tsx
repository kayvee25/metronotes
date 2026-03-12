'use client';

import { useRef, useCallback, useEffect } from 'react';
import { DrawingData } from '../../types';
import { useDrawing } from '../../hooks/useDrawing';
import { useConfirm } from '../ui/ConfirmModal';
import {
  useZoomPan, useDrawingGestures,
  DrawingToolbar, DrawingHeader, StrokeRenderer,
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
  const confirm = useConfirm();

  const {
    zoom, panX, panY, setZoom, setPanX, setPanY,
    containerRef, setContentSize, clampPan,
    handleZoomIn, handleZoomOut, handleZoomReset, handleWheel,
  } = useZoomPan();

  // Set content size for pan clamping
  useEffect(() => {
    if (!svgRef.current) return;
    const update = () => {
      if (svgRef.current) {
        const r = svgRef.current.getBoundingClientRect();
        setContentSize(r.width, r.height);
      }
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(svgRef.current);
    return () => observer.disconnect();
  }, [setContentSize]);

  const canvasWidth = initialData?.canvasWidth || CANVAS_WIDTH;
  const canvasHeight = initialData?.canvasHeight || CANVAS_HEIGHT;

  const {
    strokes, currentPoints,
    activeTool, setActiveTool,
    activeColor, setActiveColor,
    startStroke, addPoint, endStroke,
    undo, clearAll, erase, getDrawingData,
  } = useDrawing({ initialData, canvasWidth, canvasHeight });

  // Pinch zoom/pan callback — clamp and apply
  const onPinchZoomPan = useCallback((newZoom: number, newPanX: number, newPanY: number) => {
    const [cx, cy] = clampPan(newPanX, newPanY, newZoom);
    setZoom(newZoom); setPanX(cx); setPanY(cy);
  }, [clampPan, setZoom, setPanX, setPanY]);

  const { handlePointerDown, handlePointerMove, handlePointerUp } = useDrawingGestures({
    svgRef, baseWidth: canvasWidth, baseHeight: canvasHeight,
    zoom, panX, panY,
    activeTool, strokes,
    startStroke, addPoint, endStroke, erase,
    onPinchZoomPan,
  });

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
        onClear={async () => {
          if (strokes.length > 0) {
            const ok = await confirm({ title: 'Clear all?', message: 'This will remove all strokes from the drawing.', confirmLabel: 'Clear', variant: 'danger' });
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
