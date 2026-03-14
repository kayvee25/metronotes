'use client';

import { MUSICAL_KEYS } from '../lib/constants';

interface KeySelectorProps {
  value: string;
  onChange: (key: string) => void;
  className?: string;
  compact?: boolean;
}

export default function KeySelector({ value, onChange, className = '', compact = false }: KeySelectorProps) {
  if (compact) {
    return (
      <div className={`relative flex flex-col items-center justify-center bg-[var(--card)] border border-[var(--border)] rounded-lg ${className}`}>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          data-testid="select-key"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        >
          <option value="">-</option>
          {MUSICAL_KEYS.map((key) => (
            <option key={key} value={key}>
              {key}
            </option>
          ))}
        </select>
        <span className="text-lg font-bold text-[var(--foreground)] leading-tight pointer-events-none">
          {value || '-'}
        </span>
        <span className="text-[10px] font-medium text-[var(--muted)] uppercase tracking-wider pointer-events-none">
          Key
        </span>
      </div>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      data-testid="select-key"
      className={`px-4 bg-[var(--card)] border border-[var(--border)] rounded-xl text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)] cursor-pointer ${className}`}
    >
      <option value="">Key not set</option>
      {MUSICAL_KEYS.map((key) => (
        <option key={key} value={key}>
          {key}
        </option>
      ))}
    </select>
  );
}
