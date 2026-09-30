'use client';
// src/components/ui/Toast.tsx — role="status" bildirim (§6.6.3, §10.4.5). Portal → <body> (§6.4.6).
// Canlı bölge mount'ta boş kurulur; ileti değişince duyurulur. Giriş 12 px fade-up 240 ms, görünür 4000 ms,
// çıkış opaklık 160 ms --ease-in. Odaklanmış öğeyi örtmez: çakışırsa üst kenara geçer (WCAG 2.4.11).
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

export const TOAST_MS = 4000;

const noopSubscribe = () => () => {};

interface ToastProps {
  message: string | null;
  onClose: () => void;
  closeLabel: string; // dict.a11y.close
}

function overlaps(a: DOMRect, b: DOMRect): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

export function Toast({ message, onClose, closeLabel }: ToastProps) {
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const region = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    const el = card.current;
    const root = document.documentElement;
    if (!el || root.getAttribute('data-motion') === 'reduce' || typeof el.animate !== 'function') {
      onClose();
      return;
    }
    const cs = getComputedStyle(root);
    const anim = el.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: parseFloat(cs.getPropertyValue('--dur-fast')) || 160,
      easing: cs.getPropertyValue('--ease-in').trim() || 'ease-in',
      fill: 'forwards',
    });
    anim.finished.then(onClose, onClose);
  }, [onClose]);

  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(close, TOAST_MS);
    const place = () => {
      const r = region.current;
      const c = card.current;
      const focused = document.activeElement;
      if (!r || !c) return;
      r.dataset.edge = 'bottom';
      if (focused instanceof HTMLElement && focused !== document.body && !c.contains(focused)) {
        if (overlaps(focused.getBoundingClientRect(), c.getBoundingClientRect()))
          r.dataset.edge = 'top';
      }
    };
    place();
    document.addEventListener('focusin', place);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('focusin', place);
    };
  }, [message, close]);

  if (!mounted) return null;
  return createPortal(
    <div
      ref={region}
      role="status"
      aria-live="polite"
      data-edge="bottom"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(16px+env(safe-area-inset-bottom))] z-(--z-toast) flex justify-center px-4 data-[edge=top]:top-[calc(16px+env(safe-area-inset-top))] data-[edge=top]:bottom-auto"
    >
      {message && (
        <div
          key={message}
          ref={card}
          className="pointer-events-auto flex max-w-[min(90vw,28rem)] animate-fade-up-sm items-center gap-2 rounded-md bg-raised py-1 pl-4 type-ui text-ink shadow-float"
        >
          <span>{message}</span>
          <button
            type="button"
            onClick={close}
            aria-label={closeLabel}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-pill"
          >
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}
    </div>,
    document.body,
  );
}
