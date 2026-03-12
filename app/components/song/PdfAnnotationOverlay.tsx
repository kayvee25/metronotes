'use client';

import { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import { AnnotationLayer, Stroke } from '../../types';
import { useDrawing, DRAWING_COLORS, DrawingColor } from '../../hooks/useDrawing';
import { loadPdfJs } from '../../lib/pdf-loader';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import {
  useZoomPan, useDrawingGestures, MIN_ZOOM, MAX_ZOOM, DrawingHeader, StrokeRenderer,
} from './drawing-shared';
import { useConfirm } from '../ui/ConfirmModal';

interface PdfAnnotationOverlayProps {
  isOpen: boolean;
  storageUrl: string;
  pageCount?: number;
  initialPageAnnotations?: Record<number, AnnotationLayer> | null;
  onSave: (pageAnnotations: Record<number, AnnotationLayer>) => void;
  title?: string;
}

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
    }), [strokes, isDirty]);

    useEffect(() => {
      onToolbarUpdate({ strokes, activeTool, activeColor, setActiveTool, setActiveColor, undo, clearAll });
    }, [strokes, activeTool, activeColor, setActiveTool, setActiveColor, undo, clearAll, onToolbarUpdate]);

    const svgRef = useRef<SVGSVGElement>(null);

    const { handlePointerDown, handlePointerMove, handlePointerUp } = useDrawingGestures({
      svgRef, baseWidth, baseHeight,
      displayWidth,
      zoom, panX, panY,
      activeTool, strokes,
      startStroke, addPoint, endStroke, erase,
      onPinchZoomPan: onZoomPan,
    });

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
        <StrokeRenderer strokes={strokes} currentPoints={currentPoints} activeColor={activeColor} activeTool={activeTool} />
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
  const drawingRef = useRef<PageDrawingHandle>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pdfLoaded, setPdfLoaded] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });
  const [toolbarState, setToolbarState] = useState<ToolbarState | null>(null);
  const confirm = useConfirm();

  const {
    zoom, panX, panY, setZoom, setPanX, setPanY,
    containerRef, setContentSize, clampPan,
    handleZoomIn, handleZoomOut, handleZoomReset, handleWheel,
  } = useZoomPan();

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
    let loadedDoc: PDFDocumentProxy | null = null;

    loadPdfJs()
      .then((pdfjs) => pdfjs.getDocument(storageUrl).promise)
      .then((doc) => {
        if (!cancelled) {
          loadedDoc = doc;
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
      loadedDoc?.destroy();
    };
  }, [isOpen, storageUrl]);

  // Render current page to canvas (fit to viewport)
  useEffect(() => {
    if (!pdf || !canvasRef.current || !containerRef.current) return;
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let renderTask: any = null;

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

      renderTask = page.render({ canvasContext: ctx, viewport: scaledViewport });
      await renderTask.promise;
    };

    renderCurrentPage().catch(() => {});
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdf, currentPage]);

  // Sync content size to useZoomPan for proper pan clamping
  useEffect(() => {
    if (displaySize.width > 0 && displaySize.height > 0) {
      setContentSize(displaySize.width, displaySize.height);
    }
  }, [displaySize.width, displaySize.height, setContentSize]);

  const handleZoomPan = useCallback((newZoom: number, newPanX: number, newPanY: number) => {
    const [cx, cy] = clampPan(newPanX, newPanY, newZoom);
    setZoom(newZoom);
    setPanX(cx);
    setPanY(cy);
  }, [clampPan, setZoom, setPanX, setPanY]);

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
  }, [totalPages, currentPage, saveCurrentPageStrokes, setZoom, setPanX, setPanY]);

  // Auto-save on back
  const handleBack = useCallback(() => {
    saveCurrentPageStrokes();
    onSave(allAnnotationsRef.current);
  }, [saveCurrentPageStrokes, onSave]);

  const handleToolbarUpdate = useCallback((state: ToolbarState) => {
    setToolbarState(state);
  }, []);

  if (!isOpen) return null;

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-[var(--background)] flex flex-col items-center justify-center max-w-3xl mx-auto">
        <svg className="w-6 h-6 text-[var(--muted)] animate-spin mb-2" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={3} opacity={0.25} />
          <path d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
        </svg>
        <p className="text-sm text-[var(--muted)]">Loading PDF...</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-[var(--background)] flex flex-col max-w-3xl mx-auto">
      <DrawingHeader
        title={title}
        onBack={handleBack}
        trailing={totalPages > 1 ? (
          <span className="text-xs text-[var(--muted)] w-10 text-center">{currentPage + 1}/{totalPages}</span>
        ) : undefined}
      />

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
                onClick={async () => {
                  if (toolbarState.strokes.length > 0) {
                    const ok = await confirm({ title: 'Clear all?', message: 'This will remove all strokes on this page.', confirmLabel: 'Clear', variant: 'danger' });
                    if (ok) toolbarState.clearAll();
                  }
                }}
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

    </div>
  );
}
