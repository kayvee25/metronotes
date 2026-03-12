'use client';

import { useState, useRef, useEffect, useLayoutEffect, useCallback, ReactNode } from 'react';
import getStroke from 'perfect-freehand';
import { Stroke } from '../../types';
import { DRAWING_COLORS, DrawingColor, DrawingTool } from '../../hooks/useDrawing';

// ─── SVG path rendering ───

export function getSvgPathFromStroke(stroke: number[][]): string {
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

export function renderStrokeToPath(points: Array<[number, number, number]>): string {
  const outlinePoints = getStroke(points, {
    size: 4,
    thinning: 0.5,
    smoothing: 0.5,
    streamline: 0.5,
  });
  return getSvgPathFromStroke(outlinePoints);
}

// ─── Hit testing ───

export function hitTest(x: number, y: number, strokes: Stroke[], threshold: number = 20): string | null {
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

// ─── Pinch gesture helpers ───

export function pinchDistance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function pinchCenter(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// ─── Zoom/pan hook ───

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 5;

export function useZoomPan() {
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentSizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });

  // Refs for reading current values in callbacks without nested setState
  const zoomRef = useRef(zoom);
  const panXRef = useRef(panX);
  const panYRef = useRef(panY);
  useLayoutEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useLayoutEffect(() => { panXRef.current = panX; }, [panX]);
  useLayoutEffect(() => { panYRef.current = panY; }, [panY]);

  const setContentSize = useCallback((w: number, h: number) => {
    contentSizeRef.current = { width: w, height: h };
  }, []);

  const clampPan = useCallback((px: number, py: number, z: number): [number, number] => {
    if (!containerRef.current) return [px, py];
    const container = containerRef.current.getBoundingClientRect();
    const { width: contentW, height: contentH } = contentSizeRef.current;
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

  const handleZoomIn = useCallback(() => {
    setZoom(z => Math.min(MAX_ZOOM, z * 1.3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(z => {
      const newZoom = Math.max(MIN_ZOOM, z / 1.3);
      if (newZoom <= 1) { setPanX(0); setPanY(0); }
      return newZoom;
    });
  }, []);

  const handleZoomReset = useCallback(() => {
    setZoom(1); setPanX(0); setPanY(0);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const delta = -e.deltaY * 0.01;
      setZoom(prevZoom => {
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prevZoom * (1 + delta)));
        if (newZoom <= 1) {
          setPanX(0);
          setPanY(0);
        }
        return newZoom;
      });
    } else {
      const [cx, cy] = clampPan(panXRef.current - e.deltaX, panYRef.current - e.deltaY, zoomRef.current);
      setPanX(cx);
      setPanY(cy);
    }
  }, [clampPan]);

  return {
    zoom, panX, panY, setZoom, setPanX, setPanY,
    containerRef, setContentSize, clampPan,
    handleZoomIn, handleZoomOut, handleZoomReset, handleWheel,
  };
}

// ─── Drawing toolbar ───

interface DrawingToolbarProps {
  activeTool: DrawingTool;
  setActiveTool: (tool: DrawingTool) => void;
  activeColor: string;
  setActiveColor: (color: DrawingColor) => void;
  strokeCount: number;
  onUndo: () => void;
  onClear: () => void | Promise<void>;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
}

export function DrawingToolbar({
  activeTool, setActiveTool,
  activeColor, setActiveColor,
  strokeCount, onUndo, onClear,
  zoom, onZoomIn, onZoomOut, onZoomReset,
}: DrawingToolbarProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showColorPicker) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      const target = e instanceof TouchEvent ? e.touches[0]?.target || e.target : e.target;
      if (colorPickerRef.current && !colorPickerRef.current.contains(target as Node)) {
        setShowColorPicker(false);
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowColorPicker(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler, { passive: true });
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [showColorPicker]);

  return (
    <div className="flex-shrink-0 border-t border-[var(--border)] bg-[var(--background)] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-between max-w-lg mx-auto">
        {/* Tools */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTool('pen')}
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
            onClick={() => setActiveTool('eraser')}
            title="Eraser"
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

        {/* Color picker */}
        <div className="relative" ref={colorPickerRef}>
          <button
            onClick={() => setShowColorPicker(v => !v)}
            className="w-10 h-10 rounded-lg bg-[var(--card)] flex items-center justify-center"
            aria-label="Pick color"
          >
            <div className="w-6 h-6 rounded-full border-2 border-[var(--border)]" style={{ backgroundColor: activeColor }} />
          </button>
          {showColorPicker && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-lg p-2 flex gap-1.5">
              {DRAWING_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => { setActiveColor(color as DrawingColor); setActiveTool('pen'); setShowColorPicker(false); }}
                  className={`w-7 h-7 rounded-full transition-all ${
                    activeColor === color && activeTool === 'pen'
                      ? 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--card)] scale-110'
                      : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: color }}
                  aria-label={`Color ${color}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onUndo}
            disabled={strokeCount === 0}
            title="Undo"
            className="w-10 h-10 rounded-lg bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--border)] flex items-center justify-center transition-all disabled:opacity-30"
            aria-label="Undo"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 015 5v2M3 10l4-4m-4 4l4 4" />
            </svg>
          </button>
          <button
            onClick={onClear}
            disabled={strokeCount === 0}
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
          onClick={onZoomOut}
          disabled={zoom <= MIN_ZOOM}
          className="w-8 h-8 rounded-lg bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--border)] flex items-center justify-center transition-all disabled:opacity-30 text-sm font-bold"
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          onClick={onZoomReset}
          className="px-3 h-8 rounded-lg bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--border)] flex items-center justify-center transition-all text-xs font-medium min-w-[3.5rem]"
          aria-label="Reset zoom"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          onClick={onZoomIn}
          disabled={zoom >= MAX_ZOOM}
          className="w-8 h-8 rounded-lg bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--border)] flex items-center justify-center transition-all disabled:opacity-30 text-sm font-bold"
          aria-label="Zoom in"
        >
          +
        </button>
      </div>
    </div>
  );
}

// ─── Drawing editor header ───

interface DrawingHeaderProps {
  title: string;
  onBack: () => void;
  trailing?: ReactNode;
}

export function DrawingHeader({ title, onBack, trailing }: DrawingHeaderProps) {
  return (
    <header className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
      <button
        onClick={onBack}
        className="w-10 h-10 rounded-xl hover:bg-[var(--card)] active:scale-95 transition-all flex items-center justify-center"
        aria-label="Back"
      >
        <svg className="w-6 h-6 text-[var(--foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <h2 className="text-lg font-bold text-[var(--foreground)]">{title}</h2>
      {trailing || <div className="w-10" />}
    </header>
  );
}

// ─── SVG stroke renderer ───

interface StrokeRendererProps {
  strokes: Stroke[];
  currentPoints: Array<[number, number, number]>;
  activeColor: string;
  activeTool: DrawingTool;
}

export function StrokeRenderer({ strokes, currentPoints, activeColor, activeTool }: StrokeRendererProps) {
  const currentPath = currentPoints.length >= 2 ? renderStrokeToPath(currentPoints) : '';
  return (
    <>
      {strokes.map((stroke) => (
        <path
          key={stroke.id}
          d={renderStrokeToPath(stroke.points)}
          style={{ fill: stroke.color, opacity: activeTool === 'eraser' ? 0.7 : 1 }}
        />
      ))}
      {currentPath && (
        <path d={currentPath} style={{ fill: activeColor }} />
      )}
    </>
  );
}
