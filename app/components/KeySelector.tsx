'use client';

import { MUSICAL_KEYS } from '../lib/constants';

interface KeySelectorProps {
  value: string;
  onChange: (key: string) => void;
  className?: string;
}

export default function KeySelector({ value, onChange, className = '' }: KeySelectorProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`px-4 bg-[var(--card)] border border-[var(--border)] rounded-xl text-[var(--foreground)] focus:outline-none focus:border-[var(--accent-blue)] cursor-pointer ${className}`}
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
