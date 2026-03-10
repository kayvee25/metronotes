'use client';

import { useState, useRef, useCallback, useEffect, ReactNode } from 'react';

interface MenuItem {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger';
}

interface LongPressMenuProps {
  items: MenuItem[];
  children: ReactNode;
  onTap?: () => void;
  disabled?: boolean;
}

const LONG_PRESS_MS = 500;

export default function LongPressMenu({ items, children, onTap, disabled }: LongPressMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const movedRef = useRef(false);
  const startPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const triggeredRef = useRef(false);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleStart = useCallback((clientX: number, clientY: number) => {
    if (disabled) return;
    movedRef.current = false;
    triggeredRef.current = false;
    startPosRef.current = { x: clientX, y: clientY };
    clear();
    timerRef.current = setTimeout(() => {
      triggeredRef.current = true;
      setMenuPos({ x: clientX, y: clientY });
      setIsOpen(true);
      if (navigator.vibrate) navigator.vibrate(10);
    }, LONG_PRESS_MS);
  }, [disabled, clear]);

  const handleMove = useCallback((clientX: number, clientY: number) => {
    const dx = clientX - startPosRef.current.x;
    const dy = clientY - startPosRef.current.y;
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      movedRef.current = true;
      clear();
    }
  }, [clear]);

  const handleEnd = useCallback(() => {
    clear();
    if (!triggeredRef.current && !movedRef.current && onTap) {
      onTap();
    }
  }, [clear, onTap]);

  useEffect(() => clear, [clear]);

  const close = useCallback(() => setIsOpen(false), []);

  return (
    <>
      <div
        data-pressed={isOpen || undefined}
        onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
        onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
        onMouseUp={handleEnd}
        onTouchStart={(e) => {
          const t = e.touches[0];
          handleStart(t.clientX, t.clientY);
        }}
        onTouchMove={(e) => {
          const t = e.touches[0];
          handleMove(t.clientX, t.clientY);
        }}
        onTouchEnd={handleEnd}
        onContextMenu={(e) => e.preventDefault()}
        className={isOpen ? '[&>*]:bg-[var(--card)]' : ''}
        style={{ WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' } as React.CSSProperties}
      >
        {children}
      </div>

      {isOpen && (
        <>
          {/* Invisible click-catcher — no visible overlay */}
          <div className="fixed inset-0 z-50" onClick={close} onTouchEnd={close} />
          <div
            className="fixed bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xl overflow-hidden min-w-[160px] z-50"
            style={{
              left: Math.min(menuPos.x, window.innerWidth - 180),
              top: Math.min(menuPos.y, window.innerHeight - (items.length * 48 + 16)),
            }}
          >
            {items.map((item, i) => (
              <button
                key={i}
                onClick={() => {
                  setIsOpen(false);
                  item.onClick();
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors hover:bg-[var(--border)]/50 active:bg-[var(--border)] ${
                  item.variant === 'danger' ? 'text-[var(--accent-danger)]' : 'text-[var(--foreground)]'
                }`}
              >
                {item.icon && <span className="w-5 h-5 flex-shrink-0">{item.icon}</span>}
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}
