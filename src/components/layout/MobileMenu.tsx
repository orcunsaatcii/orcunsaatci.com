'use client';
// src/components/layout/MobileMenu.tsx — < 64rem tam ekran menü (§6.6.2, §10.3.4).
// Açılınca odak ilk bağlantıya gider; Tab/Shift+Tab menüde döner; Esc ya da kapat düğmesi kapatır ve odak açma
// düğmesine döner. Açıkken #main, header ve [data-site-footer] inert'tir; sayfa kaydırması kilitlidir.
// Açılış (§4.14 #17): menü düğmesinden daire clip-path (0 → %150, 500 ms --ease-in-out), bağlantılar 50 ms kademeli;
// kapanış ≈ 330 ms (çıkış ≈ 0.66 × giriş). Azaltılmış harekette anında. Menü portal ile <body>'ye render edilir (§6.4.6).
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { getLenis } from '@/components/motion/LenisProvider';
import { motion } from '@/design/tokens';
import type { Locale } from '@/i18n/config';
import { HalkaIndicator } from './HalkaIndicator';
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
const EASE_IN_OUT = `cubic-bezier(${motion.ease.inOut.join(', ')})`;
const OPEN_MS = 500;
const CLOSE_MS = 330;
const reduced = () => document.documentElement.dataset.motion === 'reduce';

function setBackgroundInert(on: boolean) {
  for (const sel of INERT_TARGETS) {
    document.querySelectorAll<HTMLElement>(sel).forEach((el) => {
      el.inert = on;
    });
  }
  const root = document.documentElement;
  root.style.overflow = on ? 'hidden' : '';
  root.toggleAttribute('data-menu-open', on); // header menü açıkken daima görünür (§4.5.5)
  if (on) getLenis()?.stop();
  else getLenis()?.start();
}

export function MobileMenu({ locale, enPaths, labels, children }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const openButton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  /** clip-path dairesinin merkezi: menü düğmesi */
  const circle = (r: string) => {
    const b = openButton.current?.getBoundingClientRect();
    const at = b ? `${b.left + b.width / 2}px ${b.top + b.height / 2}px` : '100% 0';
    return `circle(${r} at ${at})`;
  };

  const close = useCallback(() => {
    const done = () => {
      setBackgroundInert(false);
      setOpen(false);
      openButton.current?.focus();
    };
    const el = panel.current;
    if (!el || reduced()) return done();
    el.animate([{ clipPath: circle('150%') }, { clipPath: circle('0px') }], {
      duration: CLOSE_MS,
      easing: EASE_IN_OUT,
      fill: 'forwards',
    }).finished.then(done, done);
  }, []);

  useEffect(() => {
    if (!open) return;
    setBackgroundInert(true);
    panel.current?.querySelector<HTMLElement>('nav a')?.focus();
    if (panel.current && !reduced()) {
      panel.current.animate([{ clipPath: circle('0px') }, { clipPath: circle('150%') }], {
        duration: OPEN_MS,
        easing: EASE_IN_OUT,
      });
      panel.current.querySelectorAll<HTMLElement>('nav a').forEach((a, i) =>
        a.animate(
          [
            { opacity: 0, transform: 'translateY(8px)' },
            { opacity: 1, transform: 'none' },
          ],
          { duration: 240, delay: 120 + 50 * i, easing: EASE_IN_OUT, fill: 'backwards' },
        ),
      );
    }
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
        className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-pill px-4 type-ui text-ink"
      >
        <HalkaIndicator size={32} />
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
                linkClassName="type-h3 inline-flex min-h-11 min-w-11 items-center text-ink aria-[current]:after:ml-3 aria-[current]:after:size-[5px] aria-[current]:after:rounded-full aria-[current]:after:bg-accent aria-[current]:after:content-[''] forced-colors:aria-[current]:underline"
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
