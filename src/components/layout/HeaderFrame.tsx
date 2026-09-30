'use client';
// src/components/layout/HeaderFrame.tsx — <header> öğesi, "üstte / kaydırılmış" durumu ve mobil gizle/göster
// (§4.5.5, §6.6.2). SSR ve JS'siz görünüm opak zemindir (kaydırılmış durum); JS varken en üstte saydam olur (data-top).
// < 64rem: aşağı kaydırınca gizlenir, yukarıda döner (translateY(−100%) ↔ 0, 240 ms); eşik [SABİT] aynı yönde
// ≥ 8 px birikmiş kayma ve scrollY > header yüksekliği. Header'da odak varken ya da menü açıkken daima görünür.
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';

const TOP_THRESHOLD = 8; // scrollY > 8 → kaydırılmış (§6.6.2)
const HIDE_DELTA = 8; // [SABİT] #2

const subscribe = (cb: () => void) => {
  window.addEventListener('scroll', cb, { passive: true });
  return () => window.removeEventListener('scroll', cb);
};
const isTop = () => window.scrollY <= TOP_THRESHOLD;

export function HeaderFrame({ className, children }: { className?: string; children: ReactNode }) {
  const top = useSyncExternalStore(subscribe, isTop, () => null);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const header = ref.current;
    if (!header) return;
    const mobile = window.matchMedia('(max-width: 63.99rem)');
    let lastY = window.scrollY;
    let acc = 0; // aynı yönde birikmiş kayma (+ aşağı, − yukarı)
    let raf = 0;
    const show = () => header.removeAttribute('data-hidden');
    const update = () => {
      raf = 0;
      const y = window.scrollY;
      const dy = y - lastY;
      lastY = y;
      if (!mobile.matches || header.contains(document.activeElement)) return show();
      if (document.documentElement.hasAttribute('data-menu-open')) return show();
      if (dy === 0) return;
      acc = Math.sign(dy) === Math.sign(acc) ? acc + dy : dy;
      if (acc >= HIDE_DELTA && y > header.offsetHeight) header.setAttribute('data-hidden', '');
      else if (acc <= -HIDE_DELTA || y <= header.offsetHeight) show();
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    const onChange = () => {
      if (!mobile.matches) show();
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    header.addEventListener('focusin', show);
    mobile.addEventListener('change', onChange);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      header.removeEventListener('focusin', show);
      mobile.removeEventListener('change', onChange);
      show();
    };
  }, []);

  return (
    <header ref={ref} className={className} data-top={top ? '' : undefined} data-print="hide">
      {children}
    </header>
  );
}
