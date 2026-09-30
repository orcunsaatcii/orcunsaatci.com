'use client';
// src/components/motion/CutLine.tsx — about kesit çizgisi + lede satır açılışı (§5.14.4, §4.7.4).
// Çizgi yalnız dekordur (aria-hidden): --cut-progress'i her about:cut olayında yazar (§4.3 beyaz liste #1).
// Lede bölünmez (D-46): satırlar clip-path ile 1lh adımlarıyla açılır; n asla azalmaz, n === L → .is-revealed.
// JS yoksa ve azaltılmış harekette lede baştan görünür, çizgi tam genişliktedir (globals.css).
import { useEffect, useRef } from 'react';
import { motion } from '@/design/tokens';
import { onStageEvent } from '@/stage/events';
import { useMotionRuntime } from './MotionRoot';

/** Satır k (0 tabanlı) cutProgress ≥ 0.05 + 0.60·k / max(1, L − 1) olunca açılır; son satır 0.65'te. */
export function ledeLinesAt(cutProgress: number, L: number): number {
  let n = 0;
  for (let k = 0; k < L; k++) if (cutProgress >= 0.05 + (0.6 * k) / Math.max(1, L - 1)) n = k + 1;
  return n;
}

export function CutLine({ className }: { className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const rt = useMotionRuntime();

  useEffect(() => {
    const line = ref.current;
    const lede = line
      ?.closest('[data-chapter="about"]')
      ?.querySelector<HTMLElement>('[data-reveal="lede"]');
    if (!rt || !line || !lede) return;
    let L = 1;
    let shown = 0;
    let instantNext = true; // ilk kurulumda (ve kesmede) o anki satırlar animasyonsuz açılır
    let lastCp = -1;

    const measure = () => {
      const lh = Number.parseFloat(getComputedStyle(lede).lineHeight);
      L = Math.max(1, Math.round(lede.offsetHeight / (lh > 0 ? lh : lede.offsetHeight || 1)));
    };
    measure();

    const show = (n: number, instant: boolean) => {
      if (n <= shown) return;
      shown = n;
      const done = () => {
        if (shown >= L) lede.classList.add('is-revealed'); // clip kalkar; son satır da açık
      };
      if (instant) {
        rt.gsap.killTweensOf(lede, '--lede-shown');
        lede.style.setProperty('--lede-shown', String(n));
        done();
        return;
      }
      rt.gsap.to(lede, {
        '--lede-shown': n,
        duration: motion.dur.slow / 1000,
        ease: motion.gsapEase.outExpo,
        onComplete: done,
      });
    };

    const offCut = onStageEvent('about:cut', (e) => {
      if (Math.abs(e.cutProgress - lastCp) > 1e-4) {
        lastCp = e.cutProgress;
        line.style.setProperty('--cut-progress', e.cutProgress.toFixed(4));
      }
      if (lede.classList.contains('is-revealed')) {
        shown = L;
        instantNext = false;
        return;
      }
      const instant = instantNext;
      instantNext = false;
      show(ledeLinesAt(e.cutProgress, L), instant);
    });
    const offRefresh = onStageEvent('refresh', () => {
      measure();
      instantNext = true;
    });
    const offSnap = onStageEvent('cut', (e) => {
      if (e.stage === 'snap') instantNext = true;
    });

    return () => {
      offCut();
      offRefresh();
      offSnap();
      rt.gsap.killTweensOf(lede);
      lede.style.removeProperty('--lede-shown');
      line.style.removeProperty('--cut-progress');
    };
  }, [rt]);

  return (
    <span
      ref={ref}
      aria-hidden="true"
      data-cut-line=""
      className={['cut-line', className].filter(Boolean).join(' ')}
    />
  );
}
