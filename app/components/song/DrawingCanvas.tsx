'use client';

import { useRef, useCallback, useState, useEffect } from 'react';
import getStroke from 'perfect-freehand';
import { DrawingData, Stroke } from '../../types';
import { useDrawing, DRAWING_COLORS, DrawingColor } from '../../hooks/useDrawing';

interface DrawingCanvasProps {
  isOpen: boolean;
  initialData?: DrawingData | null;
  onSave: (data: DrawingData) => void;
}

// Fixed canvas size — independent of screen
const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 5;

function getSvgPathFromStroke(stroke: number[][]) {
  if (!stroke.length) return '';

  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ['M', ...stroke[0], 'Q']
  );

  d.push('Z');
  return d.join(' ');
}

function renderStrokeToPath(points: Array<[number, number, number]>): string {
  const outlinePoints = getStroke(points, {
    size: 4,
    thinning: 0.5,
    smoothing: 0.5,
    streamline: 0.5,
  });
  return getSvgPathFromStroke(outlinePoints);
}

function hitTest(
  x: number,
  y: number,
  strokes: Stroke[],
  threshold: number = 20
): string | null {
  for (let i = strokes.length - 1; i >= 0; i--) {
    const stroke = strokes[i];
    for (const [px, py] of stroke.points) {
      const dx = x - px;
      const dy = y - py;
      if (dx * dx + dy * dy < threshold * threshold) {
        return stroke.id;
      }
    }
  }
  return null;
}

function pinchDistance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pinchCenter(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export default function DrawingCanvas({ isOpen, initialData, onSave }: DrawingCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  // Clear announcement after screen reader has time to read it
  useEffect(() => {
    if (!announcement) return;
    const timer = setTimeout(() => setAnnouncement(''), 1000);
    return () => clearTimeout(timer);
  }, [announcement]);

  // Zoom & pan state
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);

  // Clamp pan so content can't scroll beyond its edges
  const clampPan = useCallback((px: number, py: number, z: number): [number, number] => {
    if (!containerRef.current || !svgRef.current) return [px, py];
    const container = containerRef.current.getBoundingClientRect();
    const svg = svgRef.current;
    const contentW = svg.clientWidth;
    const contentH = svg.clientHeight;
    const scaledW = contentW * z;
    const scaledH = contentH * z;

    let cx = px, cy = py;
    if (scaledW <= container.width) {
      cx = 0;
    } else {
      const maxPan = (scaledW - container.width) / 2;
      cx = Math.max(-maxPan, Math.min(maxPan, px));
    }
    if (scaledH <= container.height) {
      cy = 0;
    } else {
      const maxPan = (scaledH - container.height) / 2;
      cy = Math.max(-maxPan, Math.min(maxPan, py));
    }
    return [cx, cy];
  }, []);

  // Use fixed canvas size, or preserved size from initial data
  const canvasWidth = initialData?.canvasWidth || CANVAS_WIDTH;
  const canvasHeight = initialData?.canvasHeight || CANVAS_HEIGHT;

  const {
    strokes,
    currentPoints,
    activeTool,
    setActiveTool,
    activeColor,
    setActiveColor,
    startStroke,
    addPoint,
    endStroke,
    undo,
    clearAll,
    erase,
    getDrawingData,
  } = useDrawing({
    initialData,
    canvasWidth,
    canvasHeight,
  });

  // Gesture tracking
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const gestureRef = useRef<'none' | 'draw' | 'pinch'>('none');
  const isDrawingRef = useRef(false);
  const lastPinchRef = useRef<{ dist: number; cx: number; cy: number } | null>(null);

  // Convert screen coords to SVG viewBox coords (accounts for CSS transform)
  const screenToBase = useCallback((clientX: number, clientY: number, pressure: number = 0.5): [number, number, number] => {
    if (!svgRef.current) return [0, 0, pressure];
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = canvasWidth / rect.width;
    const scaleY = canvasHeight / rect.height;
    return [
      (clientX - rect.left) * scaleX,
      (clientY - rect.top) * scaleY,
      pressure,
    ];
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
      lastPinchRef.current = {
        dist: pinchDistance(a, b),
        cx: pinchCenter(a, b).x,
        cy: pinchCenter(a, b).y,
      };
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
      setZoom(newZoom);
      setPanX(cx);
      setPanY(cy);
    }
  }, [activeTool, strokes, screenToBase, addPoint, erase, zoom, panX, panY, clampPan]);

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

  // Wheel handler for desktop zoom/pan
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const delta = -e.deltaY * 0.01;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * (1 + delta)));
      if (newZoom <= 1) {
        setZoom(newZoom);
        setPanX(0);
        setPanY(0);
      } else {
        const [cx, cy] = clampPan(panX, panY, newZoom);
        setZoom(newZoom);
        setPanX(cx);
        setPanY(cy);
      }
    } else {
      const [cx, cy] = clampPan(panX - e.deltaX, panY - e.deltaY, zoom);
      setPanX(cx);
      setPanY(cy);
    }
  }, [zoom, panX, panY, clampPan]);

  // Auto-save on back
  const handleBack = useCallback(() => {
    onSave(getDrawingData());
  }, [onSave, getDrawingData]);

  const handleClearAll = useCallback(() => {
    if (strokes.length === 0) return;
    setShowClearConfirm(true);
  }, [strokes.length]);

  const confirmClear = useCallback(() => {
    clearAll();
    setShowClearConfirm(false);
  }, [clearAll]);

  const handleZoomIn = useCallback(() => {
    setZoom(z => Math.min(MAX_ZOOM, z * 1.3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(z => Math.max(MIN_ZOOM, z / 1.3));
  }, []);

  const handleZoomReset = useCallback(() => {
    setZoom(1); setPanX(0); setPanY(0);
  }, []);

  if (!isOpen) return null;

  const currentPath = currentPoints.length >= 2 ? renderStrokeToPath(currentPoints) : '';

  return (
    <div className="fixed inset-0 z-50 bg-[var(--background)] flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <button
          onClick={handleBack}
          className="w-10 h-10 rounded-xl hover:bg-[var(--card)] active:scale-95 transition-all flex items-center justify-center"
          aria-label="Back"
        >
          <svg className="w-6 h-6 text-[var(--foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-lg font-bold text-[var(--foreground)]">Drawing</h2>
        <div className="w-10" />
      </header>

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
            style={{ width: '100vw', maxWidth: '100vw', aspectRatio: `${canvasWidth}/${canvasHeight}`, touchAction: 'none' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {/* Completed strokes */}
            {strokes.map((stroke) => (
              <path
                key={stroke.id}
                d={renderStrokeToPath(stroke.points)}
                fill={stroke.color}
                opacity={activeTool === 'eraser' ? 0.7 : 1}
              />
            ))}
            {/* Current stroke in progress */}
            {currentPath && (
              <path d={currentPath} fill={activeColor} />
            )}
          </svg>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex-shrink-0 border-t border-[var(--border)] bg-[var(--background)] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          {/* Tool buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setActiveTool('pen'); setAnnouncement('Pen tool selected'); }}
              title="Pen"
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                activeTool === 'pen'
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--border)]'
              }`}
              aria-label="Pen tool"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
            <button
              onClick={() => { setActiveTool('eraser'); setAnnouncement('Eraser tool selected'); }}
              title="Eraser — drag over strokes to remove"
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                activeTool === 'eraser'
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--border)]'
              }`}
              aria-label="Eraser tool"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 21h10" />
                <path d="M5.5 13.5L12 7l6.5 6.5c.7.7.7 1.8 0 2.5L15 19.5c-.7.7-1.8.7-2.5 0L5.5 13.5z" />
                <path d="M12 7l3 3" />
              </svg>
            </button>
          </div>

          {/* Color swatches */}
          <div className="flex items-center gap-1.5">
            {DRAWING_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => { setActiveColor(color as DrawingColor); setActiveTool('pen'); setAnnouncement(`${color} color selected`); }}
                className={`w-7 h-7 rounded-full transition-all ${
                  activeColor === color && activeTool === 'pen'
                    ? 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--background)] scale-110'
                    : 'hover:scale-110'
                }`}
                style={{ backgroundColor: color }}
                aria-label={`Color ${color}`}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={undo}
              disabled={strokes.length === 0}
              title="Undo"
              className="w-10 h-10 rounded-lg bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--border)] flex items-center justify-center transition-all disabled:opacity-30"
              aria-label="Undo"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 015 5v2M3 10l4-4m-4 4l4 4" />
              </svg>
            </button>
            <button
              onClick={handleClearAll}
              disabled={strokes.length === 0}
              title="Clear all"
              className="w-10 h-10 rounded-lg bg-[var(--card)] text-[var(--accent-danger)] hover:bg-[var(--border)] flex items-center justify-center transition-all disabled:opacity-30"
              aria-label="Clear all"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center justify-center gap-2 mt-2">
          <button
            onClick={handleZoomOut}
            disabled={zoom <= MIN_ZOOM}
            title="Zoom out"
            className="w-8 h-8 rounded-lg bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--border)] flex items-center justify-center transition-all disabled:opacity-30 text-sm font-bold"
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            onClick={handleZoomReset}
            title="Reset zoom"
            className="px-3 h-8 rounded-lg bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--border)] flex items-center justify-center transition-all text-xs font-medium min-w-[3.5rem]"
            aria-label="Reset zoom"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={handleZoomIn}
            disabled={zoom >= MAX_ZOOM}
            title="Zoom in"
            className="w-8 h-8 rounded-lg bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--border)] flex items-center justify-center transition-all disabled:opacity-30 text-sm font-bold"
            aria-label="Zoom in"
          >
            +
          </button>
        </div>
      </div>

      {/* Screen reader announcements */}
      <div className="sr-only" role="status" aria-live="polite">{announcement}</div>

      {/* Clear all confirmation */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-[var(--background)] rounded-2xl p-6 max-w-sm w-full shadow-xl border border-[var(--border)]">
            <h3 className="text-lg font-bold text-[var(--foreground)] mb-2">Clear all?</h3>
            <p className="text-sm text-[var(--muted)] mb-4">This will remove all strokes from the drawing.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-[var(--card)] text-[var(--foreground)] font-medium active:scale-95 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmClear}
                className="flex-1 py-2.5 rounded-xl bg-[var(--accent-danger)] text-white font-medium active:scale-95 transition-all"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
