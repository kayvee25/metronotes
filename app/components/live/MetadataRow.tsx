'use client';

interface MetadataRowProps {
  timeSignature: string;
  bpm: number;
  musicalKey?: string;
}

export default function MetadataRow({ timeSignature, bpm, musicalKey }: MetadataRowProps) {
  const parts = [timeSignature, `${bpm} BPM`];
  if (musicalKey) parts.push(musicalKey);

  return (
    <div className="px-4 py-1.5 border-b border-[var(--border)]/50 text-center">
      <span className="text-xs text-[var(--muted)]">
        {parts.join('  ·  ')}
      </span>
    </div>
  );
}
