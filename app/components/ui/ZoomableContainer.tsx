'use client';

import { useRef, useState, useCallback, ReactNode } from 'react';

interface ZoomableContainerProps {
  children: ReactNode;
  className?: string;
  minZoom?: number;
  maxZoom?: number;
}

function pinchDistance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pinchCenter(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export default function ZoomableContainer({
  children,
  className = '',
  minZoom = 0.5,
  maxZoom = 4,
}: ZoomableContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);

  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const lastPinchRef = useRef<{ dist: number; cx: number; cy: number } | null>(null);
  const gestureRef = useRef<'none' | 'pinch'>('none');

  // Clamp pan so content can't scroll beyond its edges
  // transformOrigin is 'top center', so scaling expands downward and equally left/right from center
  const clampPan = useCallback((px: number, py: number, z: number): [number, number] => {
    if (!containerRef.current || !contentRef.current) return [px, py];
    const container = containerRef.current.getBoundingClientRect();
    const contentW = contentRef.current.scrollWidth;
    const contentH = contentRef.current.scrollHeight;

    const scaledW = contentW * z;
    const scaledH = contentH * z;

    // Horizontal: if scaled content fits within container, no horizontal pan
    let clampedX = px;
    if (scaledW <= container.width) {
      clampedX = 0;
    } else {
      const maxPanX = (scaledW - container.width) / 2;
      clampedX = Math.max(-maxPanX, Math.min(maxPanX, px));
    }

    // Vertical: content scales from top, so it extends downward
    let clampedY = py;
    if (scaledH <= container.height) {
      clampedY = 0;
    } else {
      // Can pan up to reveal bottom, but not past top
      const maxPanUp = scaledH - container.height;
      clampedY = Math.max(-maxPanUp, Math.min(0, py));
    }

    return [clampedX, clampedY];
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2) {
      e.preventDefault();
      gestureRef.current = 'pinch';
      const [a, b] = Array.from(pointersRef.current.values());
      lastPinchRef.current = {
        dist: pinchDistance(a, b),
        cx: pinchCenter(a, b).x,
        cy: pinchCenter(a, b).y,
      };
    }
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (gestureRef.current === 'pinch' && pointersRef.current.size === 2 && lastPinchRef.current) {
      e.preventDefault();
      const [a, b] = Array.from(pointersRef.current.values());
      const newDist = pinchDistance(a, b);
      const newCenter = pinchCenter(a, b);
      const zoomDelta = newDist / lastPinchRef.current.dist;
      const newZoom = Math.max(minZoom, Math.min(maxZoom, zoom * zoomDelta));
      const dx = newCenter.x - lastPinchRef.current.cx;
      const dy = newCenter.y - lastPinchRef.current.cy;
      lastPinchRef.current = { dist: newDist, cx: newCenter.x, cy: newCenter.y };
      const [cx, cy] = clampPan(panX + dx, panY + dy, newZoom);
      setZoom(newZoom);
      setPanX(cx);
      setPanY(cy);
    }
  }, [zoom, panX, panY, minZoom, maxZoom, clampPan]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) {
      gestureRef.current = 'none';
      lastPinchRef.current = null;
    }
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = -e.deltaY * 0.01;
      const newZoom = Math.max(minZoom, Math.min(maxZoom, zoom * (1 + delta)));
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
      e.preventDefault();
      const [cx, cy] = clampPan(panX - e.deltaX, panY - e.deltaY, zoom);
      setPanX(cx);
      setPanY(cy);
    }
  }, [zoom, panX, panY, minZoom, maxZoom, clampPan]);

  const handleDoubleClick = useCallback(() => {
    if (zoom !== 1) {
      setZoom(1); setPanX(0); setPanY(0);
    } else {
      setZoom(2);
    }
  }, [zoom]);

  const isZoomed = zoom !== 1;

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
      style={{ touchAction: isZoomed ? 'none' : 'pan-y' }}
    >
      <div
        ref={contentRef}
        style={{
          transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
          transformOrigin: 'top center',
          transition: zoom === 1 && panX === 0 && panY === 0 ? 'transform 0.2s ease' : 'none',
        }}
      >
        {children}
      </div>
      {isZoomed && (
        <button
          onClick={() => { setZoom(1); setPanX(0); setPanY(0); }}
          className="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-black/60 text-white text-xs font-medium backdrop-blur-sm active:scale-95 transition-all"
        >
          {Math.round(zoom * 100)}% ✕
        </button>
      )}
    </div>
  );
}
