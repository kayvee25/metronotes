'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function useConfirm(): (options: ConfirmOptions) => Promise<boolean> {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx.confirm;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const handleClose = useCallback((result: boolean) => {
    setOptions(null);
    resolveRef.current?.(result);
    resolveRef.current = null;
  }, []);

  // Escape key to dismiss
  useEffect(() => {
    if (!options) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [options, handleClose]);

  return (
    <ConfirmContext value={{ confirm }}>
      {children}
      {options && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => handleClose(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            className="bg-[var(--background)] rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-[var(--border)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="confirm-title" className="text-lg font-bold text-[var(--foreground)] text-center mb-2">
              {options.title}
            </h2>
            <p className="text-sm text-[var(--muted)] text-center mb-6">
              {options.message}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleClose(false)}
                className="flex-1 h-12 rounded-xl bg-[var(--card)] hover:bg-[var(--border)] text-[var(--foreground)] font-semibold transition-all active:scale-95"
              >
                {options.cancelLabel || 'Cancel'}
              </button>
              <button
                onClick={() => handleClose(true)}
                autoFocus
                className={`flex-1 h-12 rounded-xl font-semibold transition-all active:scale-95 ${
                  options.variant === 'danger'
                    ? 'bg-[var(--accent-danger)] hover:brightness-110 text-white'
                    : 'bg-[var(--accent)] hover:brightness-110 text-white'
                }`}
              >
                {options.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext>
  );
}
