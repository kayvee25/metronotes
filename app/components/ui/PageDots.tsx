'use client';

import { useRef, useEffect } from 'react';

interface PageDotsProps {
  count: number;
  current: number;
  onDotClick: (index: number) => void;
}

export default function PageDots({ count, current, onDotClick }: PageDotsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const dotRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Auto-scroll active dot into view
  useEffect(() => {
    const dot = dotRefs.current[current];
    if (dot && scrollRef.current) {
      dot.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [current]);

  if (count <= 1) return null;

  return (
    <div
      ref={scrollRef}
      className="flex items-center justify-center gap-2 overflow-x-auto no-scrollbar py-1"
    >
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          ref={el => { dotRefs.current[i] = el; }}
          onClick={() => onDotClick(i)}
          className={`flex-shrink-0 rounded-full transition-all ${
            i === current
              ? 'w-2.5 h-2.5 bg-[var(--accent)]'
              : 'w-2 h-2 bg-[var(--muted)] opacity-50 hover:opacity-75'
          }`}
          aria-label={`Page ${i + 1}${i === current ? ' (current)' : ''}`}
        />
      ))}
    </div>
  );
}
