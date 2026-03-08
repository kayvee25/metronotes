'use client';

import { useRef, useEffect, useState } from 'react';
import getStroke from 'perfect-freehand';
import { DrawingData } from '../../types';

interface DrawingRendererProps {
  drawingData: DrawingData;
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

export default function DrawingRenderer({ drawingData }: DrawingRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0].contentRect.width;
      if (width > 0) setContainerWidth(width);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const { strokes, canvasWidth, canvasHeight } = drawingData;

  if (strokes.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-[var(--muted)]">
        <p>Empty drawing</p>
      </div>
    );
  }

  if (containerWidth === 0) {
    return <div ref={containerRef} className="w-full min-h-[100px]" />;
  }

  const scale = canvasWidth > 0 ? containerWidth / canvasWidth : 1;
  const scaledHeight = canvasHeight > 0 ? canvasHeight * scale : containerWidth * 0.75;

  return (
    <div ref={containerRef} className="w-full">
      <svg
        width={containerWidth}
        height={scaledHeight}
        viewBox={`0 0 ${canvasWidth || containerWidth} ${canvasHeight || scaledHeight}`}
        className="block bg-white rounded-lg"
      >
        {strokes.map((stroke) => {
          const outlinePoints = getStroke(stroke.points, {
            size: 4,
            thinning: 0.5,
            smoothing: 0.5,
            streamline: 0.5,
          });
          return (
            <path
              key={stroke.id}
              d={getSvgPathFromStroke(outlinePoints)}
              fill={stroke.color}
            />
          );
        })}
      </svg>
    </div>
  );
}
