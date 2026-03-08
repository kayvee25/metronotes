'use client';

import getStroke from 'perfect-freehand';
import { AnnotationLayer } from '../../types';

interface AnnotationRendererProps {
  annotations: AnnotationLayer;
  containerWidth: number;
  containerHeight: number;
  visible?: boolean;
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

export default function AnnotationRenderer({
  annotations,
  containerWidth,
  containerHeight,
  visible = true,
}: AnnotationRendererProps) {
  if (!annotations.strokes.length || !visible) return null;

  return (
    <svg
      width={containerWidth}
      height={containerHeight}
      viewBox={`0 0 ${annotations.baseWidth} ${annotations.baseHeight}`}
      className="absolute inset-0 pointer-events-none"
      preserveAspectRatio="xMidYMid meet"
    >
      {annotations.strokes.map((stroke) => {
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
  );
}
