'use client';

import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { TIME_SIGNATURE } from '../../lib/constants';

interface TimeSignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTimeSignature: string;
  onApply: (timeSignature: string) => void;
}

export default function TimeSignatureModal({
  isOpen,
  onClose,
  currentTimeSignature,
  onApply,
}: TimeSignatureModalProps) {
  const [numerator, setNumerator] = useState<number>(TIME_SIGNATURE.NUMERATOR.DEFAULT);
  const [numeratorInput, setNumeratorInput] = useState(String(TIME_SIGNATURE.NUMERATOR.DEFAULT));
  const [denominator, setDenominator] = useState<number>(TIME_SIGNATURE.DENOMINATOR.DEFAULT);

  // Sync with current time signature when modal opens
  useEffect(() => {
    if (isOpen) {
      const [num, den] = currentTimeSignature.split('/').map(Number);
      setNumerator(num || TIME_SIGNATURE.NUMERATOR.DEFAULT);
      setNumeratorInput(String(num || TIME_SIGNATURE.NUMERATOR.DEFAULT));
      setDenominator(den || TIME_SIGNATURE.DENOMINATOR.DEFAULT);
    }
  }, [isOpen, currentTimeSignature]);

  // Sync numeratorInput with numerator
  useEffect(() => {
    setNumeratorInput(String(numerator));
  }, [numerator]);

  const handleApply = () => {
    onApply(`${numerator}/${denominator}`);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Time Signature">
      <div className="flex items-center justify-center gap-4 mb-8">
        <div className="flex flex-col items-center gap-2">
          <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider">
            Beats
          </label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={numeratorInput}
            onChange={(e) => {
              const filtered = e.target.value.replace(/\D/g, '');
              setNumeratorInput(filtered);
            }}
            onBlur={() => {
              const val = parseInt(numeratorInput);
              if (!isNaN(val) && val > 0) {
                const clamped = Math.max(
                  TIME_SIGNATURE.NUMERATOR.MIN,
                  Math.min(TIME_SIGNATURE.NUMERATOR.MAX, val)
                );
                setNumerator(clamped);
                setNumeratorInput(String(clamped));
              } else {
                setNumeratorInput(String(numerator));
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur();
              }
            }}
            className="w-20 h-16 text-center text-3xl font-bold bg-[var(--card)] border-2 border-[var(--border)] rounded-xl text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>

        <span className="text-4xl font-bold text-[var(--muted)] mt-6">/</span>

        <div className="flex flex-col items-center gap-2">
          <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider">
            Note
          </label>
          <select
            value={denominator}
            onChange={(e) => setDenominator(parseInt(e.target.value))}
            className="w-20 h-16 text-center text-3xl font-bold bg-[var(--card)] border-2 border-[var(--border)] rounded-xl text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)] cursor-pointer appearance-none"
          >
            {TIME_SIGNATURE.DENOMINATOR.OPTIONS.map((den) => (
              <option key={den} value={den}>
                {den}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onClose}
          className="flex-1 h-12 rounded-xl bg-[var(--card)] hover:bg-[var(--border)] text-[var(--foreground)] font-semibold transition-all active:scale-95"
        >
          Cancel
        </button>
        <button
          onClick={handleApply}
          className="flex-1 h-12 rounded-xl bg-[var(--accent)] hover:brightness-110 text-white font-semibold transition-all active:scale-95"
        >
          Apply
        </button>
      </div>
    </Modal>
  );
}
