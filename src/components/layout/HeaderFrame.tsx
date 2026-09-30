'use client';
// src/components/layout/HeaderFrame.tsx — <header> öğesi ve "üstte / kaydırılmış" durumu (§4.5.5, §6.6.2).
// SSR ve JS'siz görünüm opak zemindir (kaydırılmış durum); JS varken en üstte saydam olur (data-top).
// Mobilde aşağı kaydırınca gizlenme (K-MOBILE-2) M4'te eklenir.
import { useSyncExternalStore, type ReactNode } from 'react';

const TOP_THRESHOLD = 8; // scrollY > 8 → kaydırılmış (§6.6.2)

const subscribe = (cb: () => void) => {
  window.addEventListener('scroll', cb, { passive: true });
  return () => window.removeEventListener('scroll', cb);
};
const isTop = () => window.scrollY <= TOP_THRESHOLD;

export function HeaderFrame({ className, children }: { className?: string; children: ReactNode }) {
  const top = useSyncExternalStore(subscribe, isTop, () => null);
  return (
    <header className={className} data-top={top ? '' : undefined}>
      {children}
    </header>
  );
}
