'use client';
// src/components/motion/NavCutLine.tsx — gezinme ilerleme ipucu (§4.13.3, §5.15.2). Header'ın altında 1 px vurgu
// "kesim" çizgisi: dahili bağlantı tıklamasında 300 ms'de scaleX 0 → 0.7; yeni route commit olunca 1'e gider ve
// 160 ms'de söner. Aynı kökenli, değiştirici tuşsuz, download/target taşımayan ve aynı sayfaya hash olmayan <a>
// tıklamalarında başlar; tam sayfa yüklemede (dil değişimi) yarım kalması zararsızdır. Azaltılmış harekette çizilmez.
// WAAPI (motion runtime gerekmez); aria-hidden.
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { motion } from '@/design/tokens';

const EASE_OUT = `cubic-bezier(${motion.ease.out.join(', ')})`;

export function NavCutLine() {
  const pathname = usePathname();
  const line = useRef<HTMLSpanElement>(null);
  const pending = useRef(false);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
        return;
      const a = e.target instanceof Element ? e.target.closest<HTMLAnchorElement>('a[href]') : null;
      if (!a || a.target || a.hasAttribute('download')) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return; // aynı sayfa (hash ya da sorgu)
      const el = line.current;
      if (!el || document.documentElement.dataset.motion === 'reduce') return;
      pending.current = true;
      el.getAnimations().forEach((x) => x.cancel());
      el.animate(
        [
          { transform: 'scaleX(0)', opacity: 1 },
          { transform: 'scaleX(0.7)', opacity: 1 },
        ],
        { duration: 300, easing: EASE_OUT, fill: 'forwards' },
      );
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  useEffect(() => {
    if (!pending.current) return;
    pending.current = false;
    const el = line.current;
    if (!el) return;
    el.getAnimations().forEach((x) => x.cancel());
    el.animate(
      [
        { transform: 'scaleX(0.7)', opacity: 1 },
        { transform: 'scaleX(1)', opacity: 1, offset: 0.6 },
        { transform: 'scaleX(1)', opacity: 0 },
      ],
      { duration: 400, easing: EASE_OUT, fill: 'forwards' },
    );
  }, [pathname]);

  return <span ref={line} aria-hidden="true" className="nav-cut-line" />;
}
