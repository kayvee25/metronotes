'use client';

import { ANIMATION } from '../../lib/constants';

interface BeatIndicatorProps {
  beatsPerMeasure: number;
  currentBeat: number;
  isBeating: boolean;
  className?: string;
}

export default function BeatIndicator({
  beatsPerMeasure,
  currentBeat,
  isBeating,
  className = '',
}: BeatIndicatorProps) {
  return (
    <div className={`flex justify-center gap-2 py-3 ${className}`}>
      {Array.from({ length: beatsPerMeasure }).map((_, index) => (
        <div
          key={index}
          className={`w-3 h-3 rounded-full transition-all duration-${ANIMATION.BEAT_INDICATOR_MS} ${
            index === currentBeat
              ? isBeating
                ? index === 0
                  ? 'bg-[var(--accent-danger)] scale-150'
                  : 'bg-[var(--accent)] scale-150'
                : index === 0
                  ? 'bg-[var(--accent-danger)] scale-125'
                  : 'bg-[var(--accent)] scale-125'
              : 'bg-[var(--card)]'
          }`}
        />
      ))}
    </div>
  );
}
