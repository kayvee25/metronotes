'use client';

interface PlayButtonProps {
  isPlaying: boolean;
  onClick: () => void;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'round' | 'rect';
  className?: string;
}

// Play triangle icon
const PlayIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M8 5v14l11-7z" />
  </svg>
);

// Pause/Stop icon
const PauseIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <rect x="6" y="6" width="4" height="12" />
    <rect x="14" y="6" width="4" height="12" />
  </svg>
);

const sizeClasses = {
  sm: { button: 'w-10 h-10', icon: 'w-5 h-5' },
  md: { button: 'h-10', icon: 'w-6 h-6' },
  lg: { button: 'w-14 h-14', icon: 'w-8 h-8' },
};

export default function PlayButton({
  isPlaying,
  onClick,
  size = 'md',
  variant = 'rect',
  className = '',
}: PlayButtonProps) {
  const { button, icon } = sizeClasses[size];
  const shapeClass = variant === 'round' ? 'rounded-full' : 'rounded-xl';

  return (
    <button
      onClick={onClick}
      className={`${button} ${shapeClass} flex items-center justify-center gap-2 transition-all active:scale-95 ${
        isPlaying ? 'bg-[var(--accent-danger)]' : 'bg-[var(--accent)]'
      } ${className}`}
      aria-label={isPlaying ? 'Stop' : 'Start'}
    >
      {isPlaying ? (
        <PauseIcon className={`${icon} text-white`} />
      ) : (
        <PlayIcon className={`${icon} text-white`} />
      )}
    </button>
  );
}
