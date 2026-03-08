'use client';

import { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import getStroke from 'perfect-freehand';
import { AnnotationLayer, Stroke } from '../../types';
import { useDrawing, DRAWING_COLORS, DrawingColor } from '../../hooks/useDrawing';
import { loadPdfJs } from '../../lib/pdf-loader';
import type { PDFDocumentProxy } from 'pdfjs-dist';

interface PdfAnnotationOverlayProps {
  isOpen: boolean;
  storageUrl: string;
  pageCount?: number;
  initialPageAnnotations?: Record<number, AnnotationLayer> | null;
  onSave: (pageAnnotations: Record<number, AnnotationLayer>) => void;
  title?: string;
}

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

function hitTest(x: number, y: number, strokes: Stroke[], threshold: number = 20): string | null {
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

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 5;

// Inner component that manages drawing state per page — remounted via key
interface PageDrawingHandle {
  getStrokes: () => Stroke[];
  isDirty: () => boolean;
}

interface PageDrawingProps {
  baseWidth: number;
  baseHeight: number;
  displayWidth: number;
  displayHeight: number;
  zoom: number;
  panX: number;
  panY: number;
  onZoomPan: (zoom: number, panX: number, panY: number) => void;
  initialAnnotation?: AnnotationLayer | null;
  onToolbarUpdate: (state: ToolbarState) => void;
}

interface ToolbarState {
  strokes: Stroke[];
  activeTool: 'pen' | 'eraser';
  activeColor: string;
  setActiveTool: (tool: 'pen' | 'eraser') => void;
  setActiveColor: (color: DrawingColor) => void;
  undo: () => void;
  clearAll: () => void;
}

const PageDrawing = forwardRef<PageDrawingHandle, PageDrawingProps>(
  function PageDrawing({
    baseWidth, baseHeight, displayWidth, displayHeight,
    zoom, panX, panY, onZoomPan,
    initialAnnotation, onToolbarUpdate,
  }, ref) {
    const {
      strokes,
      currentPoints,
      activeTool,
      setActiveTool,
      activeColor,
      setActiveColor,
      isDirty,
      startStroke,
      addPoint,
      endStroke,
      undo,
      clearAll,
      erase,
    } = useDrawing({
      initialData: initialAnnotation ? {
        strokes: initialAnnotation.strokes,
        canvasWidth: baseWidth,
        canvasHeight: baseHeight,
      } : null,
      canvasWidth: baseWidth,
      canvasHeight: baseHeight,
    });

    useImperativeHandle(ref, () => ({
      getStrokes: () => strokes,
      isDirty: () => isDirty,
    }));

    useEffect(() => {
      onToolbarUpdate({ strokes, activeTool, activeColor, setActiveTool, setActiveColor, undo, clearAll });
    }, [strokes, activeTool, activeColor, setActiveTool, setActiveColor, undo, clearAll, onToolbarUpdate]);

    // Pointer tracking for gesture detection
    const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
    const gestureRef = useRef<'none' | 'draw' | 'pinch'>('none');
    const isDrawingRef = useRef(false);
    const lastPinchRef = useRef<{ dist: number; cx: number; cy: number } | null>(null);
    const svgRef = useRef<SVGSVGElement>(null);

    // Convert screen coords to base (SVG viewBox) coords, accounting for zoom/pan
    const screenToBase = useCallback((clientX: number, clientY: number): [number, number, number] => {
      if (!svgRef.current) return [0, 0, 0.5];
      const rect = svgRef.current.getBoundingClientRect();
      // rect already reflects CSS transform (zoom/pan)
      const scaleX = baseWidth / rect.width;
      const scaleY = baseHeight / rect.height;
      return [
        (clientX - rect.left) * scaleX,
        (clientY - rect.top) * scaleY,
        0.5,
      ];
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
        // Single finger — start drawing
        gestureRef.current = 'draw';
        const pos = screenToBase(e.clientX, e.clientY);
        if (activeTool === 'eraser') {
          const effectiveScale = displayWidth > 0 ? displayWidth * zoom / baseWidth : 1;
          const hit = hitTest(pos[0], pos[1], strokes, 20 / effectiveScale);
          if (hit) erase(hit);
          return;
        }
        isDrawingRef.current = true;
        startStroke([pos[0], pos[1], e.pressure || 0.5]);
      } else if (pointersRef.current.size === 2) {
        // Second finger — switch to pinch/pan, cancel any drawing
        cancelCurrentStroke();
        gestureRef.current = 'pinch';
        const [a, b] = Array.from(pointersRef.current.values());
        lastPinchRef.current = {
          dist: pinchDistance(a, b),
          cx: pinchCenter(a, b).x,
          cy: pinchCenter(a, b).y,
        };
      }
    }, [activeTool, strokes, screenToBase, startStroke, erase, cancelCurrentStroke, baseWidth, displayWidth, zoom]);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
      e.preventDefault();
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (gestureRef.current === 'draw' && pointersRef.current.size === 1) {
        const pos = screenToBase(e.clientX, e.clientY);
        if (activeTool === 'eraser') {
          const effectiveScale = displayWidth > 0 ? displayWidth * zoom / baseWidth : 1;
          const hit = hitTest(pos[0], pos[1], strokes, 20 / effectiveScale);
          if (hit) erase(hit);
          return;
        }
        if (isDrawingRef.current) {
          addPoint([pos[0], pos[1], e.pressure || 0.5]);
        }
      } else if (gestureRef.current === 'pinch' && pointersRef.current.size === 2 && lastPinchRef.current) {
        const [a, b] = Array.from(pointersRef.current.values());
        const newDist = pinchDistance(a, b);
        const newCenter = pinchCenter(a, b);

        // Zoom
        const zoomDelta = newDist / lastPinchRef.current.dist;
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * zoomDelta));

        // Pan
        const dx = newCenter.x - lastPinchRef.current.cx;
        const dy = newCenter.y - lastPinchRef.current.cy;
        const newPanX = panX + dx;
        const newPanY = panY + dy;

        lastPinchRef.current = { dist: newDist, cx: newCenter.x, cy: newCenter.y };
        onZoomPan(newZoom, newPanX, newPanY);
      }
    }, [activeTool, strokes, screenToBase, addPoint, erase, zoom, panX, panY, onZoomPan, baseWidth, displayWidth]);

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
      } else if (pointersRef.current.size === 1) {
        // Went from 2 fingers back to 1 — stay in pinch mode until all released
        // to prevent accidental strokes
      }
    }, [endStroke]);

    const currentPath = currentPoints.length >= 2 ? renderStrokeToPath(currentPoints) : '';

    return (
      <svg
        ref={svgRef}
        width={displayWidth}
        height={displayHeight}
        viewBox={`0 0 ${baseWidth} ${baseHeight}`}
        className="absolute inset-0 touch-none"
        style={{ touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {strokes.map((stroke) => (
          <path
            key={stroke.id}
            d={renderStrokeToPath(stroke.points)}
            fill={stroke.color}
            opacity={activeTool === 'eraser' ? 0.7 : 1}
          />
        ))}
        {currentPath && (
          <path d={currentPath} fill={activeColor} />
        )}
      </svg>
    );
  }
);

export default function PdfAnnotationOverlay({
  isOpen,
  storageUrl,
  pageCount: propPageCount,
  initialPageAnnotations,
  onSave,
  title = 'Annotate PDF',
}: PdfAnnotationOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const drawingRef = useRef<PageDrawingHandle>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pdfLoaded, setPdfLoaded] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });
  const [toolbarState, setToolbarState] = useState<ToolbarState | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Zoom & pan state
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);

  // Clamp pan so content can't scroll beyond its edges
  const clampPan = useCallback((px: number, py: number, z: number): [number, number] => {
    if (!containerRef.current || !canvasRef.current) return [px, py];
    const container = containerRef.current.getBoundingClientRect();
    const contentW = canvasRef.current.clientWidth;
    const contentH = canvasRef.current.clientHeight;
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

  const allAnnotationsRef = useRef<Record<number, AnnotationLayer>>(
    initialPageAnnotations ? { ...initialPageAnnotations } : {}
  );
  const anyDirtyRef = useRef(false);
  // Track current page annotation as state so we don't read the ref during render
  const [currentPageAnnotation, setCurrentPageAnnotation] = useState<AnnotationLayer | undefined>(
    () => initialPageAnnotations?.[0]
  );

  const totalPages = pdf?.numPages ?? propPageCount ?? 0;

  const loading = isOpen && !pdfLoaded;

  // Load PDF
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    loadPdfJs()
      .then((pdfjs) => pdfjs.getDocument(storageUrl).promise)
      .then((doc) => {
        if (!cancelled) {
          setPdf(doc);
          setPdfLoaded(true);
        } else {
          doc.destroy();
        }
      })
      .catch(() => {
        if (!cancelled) setPdfLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, storageUrl]);

  // Render current page to canvas (fit to viewport)
  useEffect(() => {
    if (!pdf || !canvasRef.current || !containerRef.current) return;
    let cancelled = false;

    const renderCurrentPage = async () => {
      const page = await pdf.getPage(currentPage + 1);
      if (cancelled) return;

      const viewport = page.getViewport({ scale: 1 });
      setPageDimensions({ width: viewport.width, height: viewport.height });

      const containerRect = containerRef.current!.getBoundingClientRect();
      const scaleW = containerRect.width / viewport.width;
      const scaleH = containerRect.height / viewport.height;
      const scale = Math.min(scaleW, scaleH);
      const scaledViewport = page.getViewport({ scale });

      const canvas = canvasRef.current!;
      const dpr = window.devicePixelRatio;
      canvas.width = scaledViewport.width * dpr;
      canvas.height = scaledViewport.height * dpr;
      canvas.style.width = `${scaledViewport.width}px`;
      canvas.style.height = `${scaledViewport.height}px`;

      setDisplaySize({ width: scaledViewport.width, height: scaledViewport.height });

      const ctx = canvas.getContext('2d')!;
      ctx.scale(dpr, dpr);

      await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
    };

    renderCurrentPage().catch(() => {});
    return () => { cancelled = true; };
  }, [pdf, currentPage]);

  const handleZoomPan = useCallback((newZoom: number, newPanX: number, newPanY: number) => {
    const [cx, cy] = clampPan(newPanX, newPanY, newZoom);
    setZoom(newZoom);
    setPanX(cx);
    setPanY(cy);
  }, [clampPan]);

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
    setZoom(1);
    setPanX(0);
    setPanY(0);
  }, []);

  const saveCurrentPageStrokes = useCallback(() => {
    if (!pageDimensions || !drawingRef.current) return;
    const strokes = drawingRef.current.getStrokes();
    if (drawingRef.current.isDirty()) anyDirtyRef.current = true;
    if (strokes.length > 0) {
      allAnnotationsRef.current[currentPage] = {
        strokes,
        baseWidth: pageDimensions.width,
        baseHeight: pageDimensions.height,
      };
    } else {
      delete allAnnotationsRef.current[currentPage];
    }
  }, [currentPage, pageDimensions]);

  const navigateToPage = useCallback((targetPage: number) => {
    if (targetPage < 0 || targetPage >= totalPages || targetPage === currentPage) return;
    saveCurrentPageStrokes();
    setCurrentPage(targetPage);
    setCurrentPageAnnotation(allAnnotationsRef.current[targetPage]);
    // Reset zoom/pan on page change
    setZoom(1);
    setPanX(0);
    setPanY(0);
  }, [totalPages, currentPage, saveCurrentPageStrokes]);

  // Auto-save on back
  const handleBack = useCallback(() => {
    saveCurrentPageStrokes();
    onSave(allAnnotationsRef.current);
  }, [saveCurrentPageStrokes, onSave]);

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

  const handleToolbarUpdate = useCallback((state: ToolbarState) => {
    setToolbarState(state);
  }, []);

  if (!isOpen) return null;

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-[var(--background)] flex flex-col items-center justify-center">
        <svg className="w-6 h-6 text-[var(--muted)] animate-spin mb-2" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={3} opacity={0.25} />
          <path d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
        </svg>
        <p className="text-sm text-[var(--muted)]">Loading PDF...</p>
      </div>
    );
  }

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
        <div className="text-center">
          <h2 className="text-lg font-bold text-[var(--foreground)]">{title}</h2>
          {totalPages > 1 && (
            <p className="text-xs text-[var(--muted)]">
              Page {currentPage + 1} of {totalPages}
            </p>
          )}
        </div>
        <div className="w-10" /> {/* Spacer for centering */}
      </header>

      {/* Page navigation for multi-page PDFs */}
      {totalPages > 1 && (
        <div className="flex-shrink-0 flex items-center justify-center gap-4 py-2 border-b border-[var(--border)]">
          <button
            onClick={() => navigateToPage(currentPage - 1)}
            disabled={currentPage === 0}
            className="w-10 h-10 rounded-lg bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--border)] flex items-center justify-center transition-all disabled:opacity-30"
            aria-label="Previous page"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-medium text-[var(--foreground)]">
            {currentPage + 1} / {totalPages}
          </span>
          <button
            onClick={() => navigateToPage(currentPage + 1)}
            disabled={currentPage >= totalPages - 1}
            className="w-10 h-10 rounded-lg bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--border)] flex items-center justify-center transition-all disabled:opacity-30"
            aria-label="Next page"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      {/* Content area — overflow hidden, zoom/pan handled manually */}
      <div ref={containerRef} className="flex-1 overflow-hidden flex items-center justify-center bg-black/20" onWheel={handleWheel}>
        <div
          className="relative"
          style={{
            transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: zoom === 1 && panX === 0 && panY === 0 ? 'transform 0.2s ease' : 'none',
          }}
        >
          <canvas ref={canvasRef} className="block rounded" />
          {pageDimensions && displaySize.width > 0 && (
            <PageDrawing
              key={currentPage}
              ref={drawingRef}
              baseWidth={pageDimensions.width}
              baseHeight={pageDimensions.height}
              displayWidth={displaySize.width}
              displayHeight={displaySize.height}
              zoom={zoom}
              panX={panX}
              panY={panY}
              onZoomPan={handleZoomPan}
              initialAnnotation={currentPageAnnotation}
              onToolbarUpdate={handleToolbarUpdate}
            />
          )}
        </div>
      </div>

      {/* Toolbar */}
      {toolbarState && (
        <div className="flex-shrink-0 border-t border-[var(--border)] bg-[var(--background)] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between max-w-lg mx-auto">
            <div className="flex items-center gap-1">
              <button
                onClick={() => toolbarState.setActiveTool('pen')}
                title="Pen"
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                  toolbarState.activeTool === 'pen'
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--border)]'
                }`}
                aria-label="Pen tool"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
              <button
                onClick={() => toolbarState.setActiveTool('eraser')}
                title="Eraser — drag over strokes to remove"
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                  toolbarState.activeTool === 'eraser'
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--border)]'
                }`}
                aria-label="Eraser tool"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 21h10" />
                  <path d="M5.5 13.5L12 7l6.5 6.5c.7.7.7 1.8 0 2.5L15 19.5c-.7.7-1.8.7-2.5 0L5.5 13.5z" />
                  <path d="M12 7l3 3" />
                </svg>
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              {DRAWING_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => { toolbarState.setActiveColor(color as DrawingColor); toolbarState.setActiveTool('pen'); }}
                  className={`w-6 h-6 rounded-full transition-all ${
                    toolbarState.activeColor === color && toolbarState.activeTool === 'pen'
                      ? 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--background)] scale-110'
                      : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: color }}
                  aria-label={`Color ${color}`}
                />
              ))}
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={toolbarState.undo}
                disabled={toolbarState.strokes.length === 0}
                title="Undo"
                className="w-9 h-9 rounded-lg bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--border)] flex items-center justify-center transition-all disabled:opacity-30"
                aria-label="Undo"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 015 5v2M3 10l4-4m-4 4l4 4" />
                </svg>
              </button>
              <button
                onClick={() => { if (toolbarState.strokes.length > 0) setShowClearConfirm(true); }}
                disabled={toolbarState.strokes.length === 0}
                title="Clear all"
                className="w-9 h-9 rounded-lg bg-[var(--card)] text-[var(--accent-danger)] hover:bg-[var(--border)] flex items-center justify-center transition-all disabled:opacity-30"
                aria-label="Clear page"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
              className="w-8 h-8 rounded-lg bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--border)] flex items-center justify-center transition-all disabled:opacity-30 text-sm font-bold"
              aria-label="Zoom out"
            >
              −
            </button>
            <button
              onClick={handleZoomReset}
              className="px-3 h-8 rounded-lg bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--border)] flex items-center justify-center transition-all text-xs font-medium min-w-[3.5rem]"
              aria-label="Reset zoom"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              onClick={handleZoomIn}
              disabled={zoom >= MAX_ZOOM}
              className="w-8 h-8 rounded-lg bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--border)] flex items-center justify-center transition-all disabled:opacity-30 text-sm font-bold"
              aria-label="Zoom in"
            >
              +
            </button>
          </div>
        </div>
      )}

      {/* Clear confirmation */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-[var(--background)] rounded-2xl p-6 max-w-sm w-full shadow-xl border border-[var(--border)]">
            <h3 className="text-lg font-bold text-[var(--foreground)] mb-2">Clear page annotations?</h3>
            <p className="text-sm text-[var(--muted)] mb-4">This will remove all strokes on this page.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-[var(--card)] text-[var(--foreground)] font-medium active:scale-95 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => { toolbarState?.clearAll(); setShowClearConfirm(false); }}
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
