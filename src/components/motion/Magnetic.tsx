'use client';
// src/components/motion/Magnetic.tsx — manyetik etiket (§4.14 #5, #8, §4.14.3). Yalnız iki hero CTA'sı, "Kopyala" ve
// e-posta bağlantısında kullanılır. Etkinleşme alanı: kapsayan a/button kutusu + 24 px. İçteki kapsayıcı span
// (işaretçi − merkez)·0.25 kayar (±10 px), etiket ek olarak ·0.15 (toplam ±14 px; max ile ölçeklenir, e-postada 6).
// gsap.quickTo 0.4 s power3.out; alandan çıkınca 0.6 s power3.out ile döner (elastik değil). Tıklama alanı (a/button)
// yerinde kalır; klavye odağı yer değiştirmez. Kapı: ince işaretçi + tam hareket (runtime yoksa statik span).
import { useEffect, useRef, type ReactNode } from 'react';
import { useMotionRuntime } from './MotionRoot';

const REACH = 24;
const BOX = 0.25;
const LABEL = 0.15;

export function Magnetic({
  children,
  max = 14,
  className = '[display:inline-block]',
}: {
  children: ReactNode;
  max?: number;
  /** etiket span'inin sınıfı (butonda içeriğin gap'li dizilimi korunur) */
  className?: string;
}) {
  const outer = useRef<HTMLSpanElement>(null);
  const inner = useRef<HTMLSpanElement>(null);
  const rt = useMotionRuntime();

  useEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!rt || !o || !i || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const { gsap } = rt;
    const host = o.closest<HTMLElement>('a, button') ?? o;
    const boxMax = (max * 10) / 14;
    const labelMax = max - boxMax;
    const q = {
      ox: gsap.quickTo(o, 'x', { duration: 0.4, ease: 'power3.out' }),
      oy: gsap.quickTo(o, 'y', { duration: 0.4, ease: 'power3.out' }),
      ix: gsap.quickTo(i, 'x', { duration: 0.4, ease: 'power3.out' }),
      iy: gsap.quickTo(i, 'y', { duration: 0.4, ease: 'power3.out' }),
    };
    const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v));
    let active = false;
    let raf = 0;
    let px = 0;
    let py = 0;
    const frame = () => {
      raf = 0;
      const r = host.getBoundingClientRect();
      const inside =
        px >= r.left - REACH &&
        px <= r.right + REACH &&
        py >= r.top - REACH &&
        py <= r.bottom + REACH;
      if (inside) {
        const dx = px - (r.left + r.width / 2);
        const dy = py - (r.top + r.height / 2);
        q.ox(clamp(dx * BOX, boxMax));
        q.oy(clamp(dy * BOX, boxMax));
        q.ix(clamp(dx * LABEL, labelMax));
        q.iy(clamp(dy * LABEL, labelMax));
        active = true;
      } else if (active) {
        active = false;
        gsap.to([o, i], { x: 0, y: 0, duration: 0.6, ease: 'power3.out', overwrite: true });
      }
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      px = e.clientX;
      py = e.clientY;
      if (!raf) raf = requestAnimationFrame(frame);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf);
      gsap.killTweensOf([o, i]);
      gsap.set([o, i], { clearProps: 'transform' });
    };
  }, [rt, max]);

  return (
    <span ref={outer} className="[display:inline-block] will-change-transform">
      <span ref={inner} className={className}>
        {children}
      </span>
    </span>
  );
}
