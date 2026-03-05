'use client';

interface BottomNavProps {
  activeTab: 'songs' | 'setlists';
  onTabChange: (tab: 'songs' | 'setlists') => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
}

export default function BottomNav({ activeTab, onTabChange, isDarkMode, onToggleDarkMode }: BottomNavProps) {
  const tabs = [
    {
      id: 'songs' as const,
      label: 'Songs',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
          />
        </svg>
      )
    },
    {
      id: 'setlists' as const,
      label: 'Setlists',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 6h16M4 10h16M4 14h16M4 18h16"
          />
        </svg>
      )
    }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[var(--background)] border-t border-[var(--border)] px-2 pb-safe z-50">
      <div className="flex items-center h-16 max-w-lg mx-auto">
        <div className="flex items-center justify-around flex-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors ${
                activeTab === tab.id
                  ? 'text-[var(--accent-blue)]'
                  : 'text-[var(--muted)] hover:text-[var(--foreground)]'
              }`}
            >
              {tab.icon}
              <span className="text-xs font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
        {onToggleDarkMode && (
          <button
            onClick={onToggleDarkMode}
            className="w-10 h-10 rounded-lg hover:bg-[var(--card)] active:scale-95 transition-all flex items-center justify-center text-[var(--muted)]"
            aria-label="Toggle dark mode"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              {isDarkMode ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                />
              )}
            </svg>
          </button>
        )}
      </div>
    </nav>
  );
}
