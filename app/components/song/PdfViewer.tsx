'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { loadPdfJs } from '../../lib/pdf-loader';
import { AnnotationLayer } from '../../types';
import AnnotationRenderer from './AnnotationRenderer';
import type { PDFDocumentProxy } from 'pdfjs-dist';

interface PdfViewerProps {
  storageUrl: string;
  pageCount?: number;
  className?: string;
  pageAnnotations?: Record<number, AnnotationLayer> | null;
  showAnnotations?: boolean;
}

interface PageInfo {
  width: number;
  height: number;
}

function PdfPage({
  pdf,
  pageNumber,
  containerWidth,
  annotation,
  showAnnotations = true,
}: {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  containerWidth: number;
  annotation?: AnnotationLayer | null;
  showAnnotations?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderingRef = useRef(false);
  const [dimensions, setDimensions] = useState<PageInfo | null>(null);
  const [rendered, setRendered] = useState(false);
  const [error, setError] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get page dimensions on mount
  useEffect(() => {
    let cancelled = false;
    pdf.getPage(pageNumber).then((page) => {
      if (cancelled) return;
      const viewport = page.getViewport({ scale: 1 });
      setDimensions({ width: viewport.width, height: viewport.height });
    }).catch(() => {
      if (!cancelled) setError(true);
    });
    return () => { cancelled = true; };
  }, [pdf, pageNumber]);

  const renderPage = useCallback(async () => {
    if (renderingRef.current || rendered || !canvasRef.current || !dimensions) return;
    renderingRef.current = true;

    try {
      const page = await pdf.getPage(pageNumber);
      const scale = containerWidth / dimensions.width;
      const viewport = page.getViewport({ scale });

      const canvas = canvasRef.current;
      canvas.width = viewport.width * window.devicePixelRatio;
      canvas.height = viewport.height * window.devicePixelRatio;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      const ctx = canvas.getContext('2d')!;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

      await page.render({ canvasContext: ctx, viewport }).promise;
      setRendered(true);
    } catch {
      setError(true);
    } finally {
      renderingRef.current = false;
    }
  }, [pdf, pageNumber, dimensions, containerWidth, rendered]);

  // IntersectionObserver for lazy rendering
  useEffect(() => {
    if (!containerRef.current || !dimensions) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          renderPage();
        }
      },
      { rootMargin: '200% 0px' } // render 1 page above/below viewport
    );

    observerRef.current.observe(containerRef.current);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [dimensions, renderPage]);

  if (error) {
    const aspectRatio = dimensions ? dimensions.height / dimensions.width : 1.414;
    return (
      <div
        className="w-full bg-[var(--card)] flex items-center justify-center text-[var(--muted)] text-sm rounded"
        style={{ aspectRatio: `${1 / aspectRatio}` }}
      >
        Error rendering page {pageNumber}
      </div>
    );
  }

  if (!dimensions) {
    return (
      <div className="w-full bg-[var(--card)] rounded animate-pulse" style={{ aspectRatio: '1/1.414' }} />
    );
  }

  const aspectRatio = dimensions.height / dimensions.width;

  return (
    <div ref={containerRef} className="w-full relative" style={{ aspectRatio: `${1 / aspectRatio}` }}>
      <canvas ref={canvasRef} className="block" />
      {!rendered && (
        <div
          className="absolute inset-0 bg-[var(--card)] rounded animate-pulse"
        />
      )}
      {rendered && annotation && annotation.strokes.length > 0 && showAnnotations && (
        <AnnotationRenderer
          annotations={annotation}
          containerWidth={containerWidth}
          containerHeight={Math.round(containerWidth * (dimensions.height / dimensions.width))}
          visible={true}
        />
      )}
    </div>
  );
}

export default function PdfViewer({ storageUrl, pageCount, className, pageAnnotations, showAnnotations = true }: PdfViewerProps) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const totalPages = pdf?.numPages ?? pageCount ?? 0;
  const loading = loadedUrl !== storageUrl;

  // Measure container width
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0].contentRect.width;
      if (width > 0) setContainerWidth(width);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [loading]);

  // Load PDF
  useEffect(() => {
    let cancelled = false;
    let loadedDoc: PDFDocumentProxy | null = null;

    loadPdfJs()
      .then((pdfjs) => pdfjs.getDocument(storageUrl).promise)
      .then((doc) => {
        if (!cancelled) {
          loadedDoc = doc;
          setPdf(doc);
          setLoadedUrl(storageUrl);
          setError(null);
        } else {
          doc.destroy();
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.message || 'Failed to load PDF');
          setLoadedUrl(storageUrl);
        }
      });

    return () => {
      cancelled = true;
      if (loadedDoc) {
        loadedDoc.destroy();
      }
    };
  }, [storageUrl]);

  if (loading) {
    return (
      <div className={`flex flex-col items-center justify-center py-12 ${className || ''}`}>
        <svg className="w-6 h-6 text-[var(--muted)] animate-spin mb-2" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={3} opacity={0.25} />
          <path d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
        </svg>
        <p className="text-sm text-[var(--muted)]">Loading PDF viewer...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center py-12 ${className || ''}`}>
        <svg className="w-12 h-12 text-[var(--muted)] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
        <p className="text-sm text-[var(--muted)]">Could not load PDF</p>
      </div>
    );
  }

  if (!pdf || containerWidth === 0) {
    return <div ref={containerRef} className={`w-full min-h-[100px] ${className || ''}`} />;
  }

  return (
    <div ref={containerRef} className={`w-full space-y-1 ${className || ''}`}>
      {Array.from({ length: totalPages }, (_, i) => (
        <PdfPage
          key={i}
          pdf={pdf}
          pageNumber={i + 1}
          containerWidth={containerWidth}
          annotation={pageAnnotations?.[i]}
          showAnnotations={showAnnotations}
        />
      ))}
    </div>
  );
}
