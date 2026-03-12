'use client';

interface LiveTabProps {
  hasSongs: boolean;
  onCreateSong: () => void;
}

export default function LiveTab({ hasSongs, onCreateSong }: LiveTabProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center px-8">
      <svg
        className="w-20 h-20 text-[var(--muted)] mb-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <h2 className="text-xl font-semibold text-[var(--foreground)] mb-2">
        Select a song to start
      </h2>
      <p className="text-[var(--muted)] mb-6">
        Pick a song or setlist from your Library, or create one.
      </p>
      {!hasSongs && (
        <button
          onClick={onCreateSong}
          className="px-6 py-3 rounded-xl bg-[var(--accent)] text-white font-semibold hover:brightness-110 active:scale-95 transition-all"
        >
          Create your first song
        </button>
      )}
    </div>
  );
}
