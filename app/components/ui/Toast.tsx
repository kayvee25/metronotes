'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { ANIMATION } from '../../lib/constants';

type ToastVariant = 'error' | 'success' | 'info';

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  duration: number;
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

const VARIANT_STYLES: Record<ToastVariant, string> = {
  error: 'bg-[var(--accent-danger)] text-white',
  success: 'bg-green-600 text-white',
  info: 'bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)]',
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(() => onDismiss(toast.id), ANIMATION.TOAST_EXIT_MS);
    }, toast.duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium max-w-sm transition-all duration-200 flex items-center gap-2 ${
        VARIANT_STYLES[toast.variant]
      } ${exiting ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}`}
    >
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={() => {
          setExiting(true);
          setTimeout(() => onDismiss(toast.id), ANIMATION.TOAST_EXIT_MS);
        }}
        className="opacity-75 hover:opacity-100 text-lg leading-none flex-shrink-0"
        aria-label="Dismiss"
      >
        &times;
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idCounter = useRef(0);

  const addToast = useCallback((message: string, variant: ToastVariant = 'error', duration: number = ANIMATION.TOAST_AUTO_DISMISS_MS) => {
    const id = `toast-${++idCounter.current}`;
    setToasts((prev) => [...prev.slice(-4), { id, message, variant, duration }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      {toasts.length > 0 && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[70] flex flex-col items-center gap-2 pointer-events-none">
          {toasts.map((t) => (
            <div key={t.id} className="pointer-events-auto animate-in">
              <ToastItem toast={t} onDismiss={dismissToast} />
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}
