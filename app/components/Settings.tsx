'use client';

import { useAuth } from '../hooks/useAuth';
import { FontSize, FontFamily } from '../hooks/usePerformanceSettings';
import { MetronomeSound } from '../hooks/useMetronomeAudio';

const FONT_SIZE_OPTIONS: { value: FontSize; label: string }[] = [
  { value: 'sm', label: 'Small' },
  { value: 'md', label: 'Medium' },
  { value: 'lg', label: 'Large' },
  { value: 'xl', label: 'Extra Large' },
];

const FONT_FAMILY_OPTIONS: { value: FontFamily; label: string }[] = [
  { value: 'mono', label: 'Monospace' },
  { value: 'sans', label: 'Sans-serif' },
  { value: 'serif', label: 'Serif' },
];

const SOUND_OPTIONS: { value: MetronomeSound; label: string }[] = [
  { value: 'default', label: 'Default Click' },
  { value: 'wood', label: 'Wood Block' },
  { value: 'cowbell', label: 'Cowbell' },
];

interface SettingsProps {
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  fontSize: FontSize;
  onFontSizeChange: (v: FontSize) => void;
  fontFamily: FontFamily;
  onFontFamilyChange: (v: FontFamily) => void;
  metronomeSound: MetronomeSound;
  onMetronomeSoundChange: (v: MetronomeSound) => void;
  keepScreenOn: boolean;
  onKeepScreenOnChange: (v: boolean) => void;
}

function Toggle({ enabled, onToggle, label }: { enabled: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      onClick={onToggle}
      className={`relative w-12 h-7 rounded-full transition-colors ${
        enabled ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'
      }`}
      aria-label={label}
    >
      <div
        className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
          enabled ? 'translate-x-[22px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex bg-[var(--background)] rounded-lg p-0.5 gap-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 px-2 py-1.5 rounded-md text-sm font-medium transition-colors ${
            value === opt.value
              ? 'bg-[var(--accent)] text-white'
              : 'text-[var(--muted)] hover:text-[var(--foreground)]'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function Settings({
  isDarkMode,
  onToggleDarkMode,
  fontSize,
  onFontSizeChange,
  fontFamily,
  onFontFamilyChange,
  metronomeSound,
  onMetronomeSoundChange,
  keepScreenOn,
  onKeepScreenOnChange,
}: SettingsProps) {
  const { user, authState, signOut, exitGuestMode } = useAuth();
  const isGuest = authState === 'guest';
  const wakeLockSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto w-full">
      <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] min-h-[64px]">
        <h1 className="text-xl font-bold text-[var(--foreground)]">Settings</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-20 space-y-4">
        {/* Account section */}
        {isGuest ? (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
            <p className="text-[var(--foreground)] font-medium mb-1">Sign in to sync</p>
            <p className="text-sm text-[var(--muted)] mb-4">
              Sign in to sync your data across devices
            </p>
            <button
              onClick={exitGuestMode}
              className="w-full h-11 rounded-xl bg-[var(--accent)] text-white font-semibold hover:brightness-110 active:scale-95 transition-all text-sm"
            >
              Sign In
            </button>
          </div>
        ) : (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-[var(--accent)] flex items-center justify-center text-white font-bold text-lg">
                {(user?.displayName?.[0] || user?.email?.[0] || '?').toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                {user?.displayName && (
                  <p className="text-[var(--foreground)] font-medium truncate">{user.displayName}</p>
                )}
                <p className="text-sm text-[var(--muted)] truncate">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={signOut}
              className="w-full h-11 rounded-xl bg-[var(--accent-danger)]/10 text-[var(--accent-danger)] font-semibold hover:bg-[var(--accent-danger)]/20 active:scale-95 transition-all text-sm"
            >
              Sign Out
            </button>
          </div>
        )}

        {/* Performance Font */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 space-y-4">
          <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Performance Font</p>

          <div>
            <p className="text-sm text-[var(--foreground)] mb-2">Size</p>
            <SegmentedControl options={FONT_SIZE_OPTIONS} value={fontSize} onChange={onFontSizeChange} />
          </div>

          <div>
            <p className="text-sm text-[var(--foreground)] mb-2">Family</p>
            <SegmentedControl options={FONT_FAMILY_OPTIONS} value={fontFamily} onChange={onFontFamilyChange} />
          </div>
        </div>

        {/* Metronome */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 space-y-4">
          <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Metronome</p>

          <div>
            <p className="text-sm text-[var(--foreground)] mb-2">Sound</p>
            <SegmentedControl options={SOUND_OPTIONS} value={metronomeSound} onChange={onMetronomeSoundChange} />
          </div>

        </div>

        {/* Display */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 space-y-4">
          <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Display</p>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-[var(--foreground)] font-medium">Dark Mode</p>
              <p className="text-sm text-[var(--muted)]">Toggle dark appearance</p>
            </div>
            <Toggle enabled={isDarkMode} onToggle={onToggleDarkMode} label="Toggle dark mode" />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-[var(--foreground)] font-medium">Keep Screen On</p>
              <p className="text-sm text-[var(--muted)]">
                {wakeLockSupported
                  ? 'Prevent screen from sleeping during performance'
                  : 'Not supported on this device'}
              </p>
            </div>
            <Toggle
              enabled={keepScreenOn}
              onToggle={() => onKeepScreenOnChange(!keepScreenOn)}
              label="Toggle keep screen on"
            />
          </div>
        </div>

        {/* App info */}
        <div className="text-center text-sm text-[var(--muted)] pt-4">
          <p>MetroNotes v0.3.0</p>
        </div>
      </div>
    </div>
  );
}
