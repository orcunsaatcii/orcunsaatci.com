// src/components/layout/SkipLink.tsx
'use client';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

export function SkipLink({ label }: { label: string }) {
  const pathname = usePathname();
  const prev = useRef(pathname); // StrictMode'daki çift effect'te de ilk yüklemeyi atlar
  useEffect(() => {
    if (prev.current === pathname) return; // ilk yüklemede odak tarayıcıda kalır
    prev.current = pathname;
    if (window.location.hash) return; // hash hedefi §10.3.2 kuralıyla odaklanır
    const h1 = document.querySelector<HTMLElement>('#main h1');
    const target = h1 ?? document.getElementById('main');
    if (!target) return;
    if (h1 && !h1.hasAttribute('tabindex')) h1.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true }); // kaydırma §5.13.3 RouteScrollSync'indir
  }, [pathname]);
  // Görünüm §6.6.2: gizli; :focus-visible iken sol üstte (güvenli alan dahil), bg-ink text-canvas, ≥ 44 px
  return (
    <a
      href="#main"
      data-print="hide"
      className="sr-only fixed top-[calc(0.75rem+env(safe-area-inset-top))] left-[calc(0.75rem+env(safe-area-inset-left))] z-(--z-skip) inline-flex min-h-11 items-center rounded-md bg-ink px-4 type-ui text-canvas focus-visible:not-sr-only"
    >
      {label}
    </a>
  );
}
