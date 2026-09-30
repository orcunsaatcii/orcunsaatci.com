'use client';
// src/components/layout/MobileMenu.tsx — < 64rem tam ekran menü (§6.6.2, §10.3.4).
// Açılınca odak ilk bağlantıya gider; Tab/Shift+Tab menüde döner; Esc ya da kapat düğmesi kapatır ve odak açma
// düğmesine döner. Açıkken #main, header ve [data-site-footer] inert'tir; sayfa kaydırması kilitlidir.
// Açılış animasyonu (§4.14 #17) M7'dedir. Menü portal ile <body>'ye render edilir (§6.4.6).
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Locale } from '@/i18n/config';
import { NavLinks, type NavLabels } from './NavLinks';

interface MobileMenuProps {
  locale: Locale;
  enPaths: readonly string[];
  labels: NavLabels & { navLabel: string; menu: string; menuOpen: string; menuClose: string };
  children?: ReactNode; // dil değiştirici, tema seçici (sunucudan)
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';
const INERT_TARGETS = ['#main', 'body > header', '[data-site-footer]'];

function setBackgroundInert(on: boolean) {
  for (const sel of INERT_TARGETS) {
    document.querySelectorAll<HTMLElement>(sel).forEach((el) => {
      el.inert = on;
    });
  }
  document.documentElement.style.overflow = on ? 'hidden' : '';
}

export function MobileMenu({ locale, enPaths, labels, children }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const openButton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setBackgroundInert(false);
    setOpen(false);
    openButton.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    setBackgroundInert(true);
    panel.current?.querySelector<HTMLElement>('nav a')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== 'Tab' || !panel.current) return;
      // Radyo grubunda yalnız seçili radyo Tab durağıdır; işaretsizler sona sayılırsa odak menüden kaçar
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => !(el instanceof HTMLInputElement && el.type === 'radio' && !el.checked),
      );
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      setBackgroundInert(false);
    };
  }, [open, close]);

  return (
    <>
      <button
        ref={openButton}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={labels.menuOpen}
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-pill px-4 type-ui text-ink"
      >
        {labels.menu}
      </button>
      {open &&
        createPortal(
          <div
            ref={panel}
            id={menuId}
            role="dialog"
            aria-modal="true"
            aria-label={labels.navLabel}
            data-lenis-prevent=""
            className="fixed inset-0 z-(--z-menu) flex h-dvh flex-col overflow-y-auto bg-canvas pt-[env(safe-area-inset-top)] pb-[calc(16px+env(safe-area-inset-bottom))]"
          >
            <div className="container-page flex h-header shrink-0 items-center justify-end">
              <button
                type="button"
                onClick={close}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-pill px-4 type-ui text-ink"
              >
                {labels.menuClose}
              </button>
            </div>
            <nav aria-label={labels.navLabel} className="container-page mt-stack">
              <NavLinks
                locale={locale}
                enPaths={enPaths}
                labels={labels}
                onNavigate={close}
                className="flex flex-col gap-2"
                linkClassName="type-h3 inline-flex min-h-11 min-w-11 items-center text-ink aria-[current]:underline aria-[current]:decoration-1 aria-[current]:underline-offset-[0.15em]"
              />
            </nav>
            <div className="container-page mt-auto flex flex-col items-start gap-6 pt-block">
              {children}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
