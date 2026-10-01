'use client';
// src/components/layout/HalkaIndicator.tsx — halka göstergesi (§4.14 #10, §4.14.4). aria-hidden SVG: 1 px
// --color-line iz; ilerleme yayı 1.5 px --color-ink, saat 12'den saat yönünde, açı = 360°·scrollProgress; ana sayfada
// her bölümün gerçek başlangıcında çentik (geçilen çentik --color-ink-muted → --color-ink); yay ucunda 3 px vurgu
// noktası, bölüm sınırı geçilince tek --ease-tick yerleşmesi (400 ms). Derin sayfalarda yalnız ilerleme ([SABİT] #15).
// Doğruluk kaynağı JS'dir: rAF ile birleştirilmiş kaydırma okuması (hareket paketi gerekmez); azaltılmış harekette
// doğrusal güncellenir, yerleşme yok. Çentikler resize'da ve director refresh'inde yeniden hesaplanır.
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { motion } from '@/design/tokens';
import { onStageEvent } from '@/stage/events';

const TICK = `cubic-bezier(${motion.ease.tick.join(', ')})`;

export function HalkaIndicator({ size = 40, className }: { size?: number; className?: string }) {
  const pathname = usePathname();
  const arc = useRef<SVGCircleElement>(null);
  const tip = useRef<SVGCircleElement>(null);
  const [ticks, setTicks] = useState<number[]>([]);
  const [passed, setPassed] = useState(-1);
  const c = size / 2;
  const R = c - 3;
  const C = 2 * Math.PI * R;

  // Çentikler: ana sayfada bölüm başlarının kaydırılabilir yüksekliğe oranı (hero hariç)
  useEffect(() => {
    const measure = () => {
      const home = document.querySelector('#main [data-chapter="hero"]');
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (!home || max <= 0) return setTicks([]);
      const ys = [...document.querySelectorAll<HTMLElement>('#main [data-chapter]')]
        .filter((el) => el.dataset.chapter !== 'hero')
        .map((el) => Math.min(1, (el.getBoundingClientRect().top + window.scrollY) / max));
      setTicks(ys);
    };
    measure();
    window.addEventListener('resize', measure);
    const off = onStageEvent('refresh', measure);
    return () => {
      window.removeEventListener('resize', measure);
      off();
    };
  }, [pathname]);

  // İlerleme: rAF ile birleştirilmiş kaydırma okuması
  useEffect(() => {
    let raf = 0;
    let last = -1;
    const draw = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      const a = 2 * Math.PI * p - Math.PI / 2;
      arc.current?.setAttribute('stroke-dashoffset', String(C * (1 - p)));
      tip.current?.setAttribute('cx', String(c + R * Math.cos(a)));
      tip.current?.setAttribute('cy', String(c + R * Math.sin(a)));
      let n = -1;
      ticks.forEach((t, i) => {
        if (p >= t - 1e-4) n = i;
      });
      if (n !== last) {
        if (last !== -1 && document.documentElement.dataset.motion !== 'reduce')
          tip.current?.animate([{ r: '2.6' }, { r: '1.5' }], { duration: 400, easing: TICK });
        last = n;
        setPassed(n);
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(draw);
    };
    draw();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [ticks, c, R, C]);

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={['halka-indicator shrink-0', className].filter(Boolean).join(' ')}
    >
      <circle cx={c} cy={c} r={R} fill="none" stroke="var(--color-line)" strokeWidth={1} />
      <circle
        ref={arc}
        cx={c}
        cy={c}
        r={R}
        fill="none"
        stroke="var(--color-ink)"
        strokeWidth={1.5}
        strokeDasharray={C}
        strokeDashoffset={C}
        transform={`rotate(-90 ${c} ${c})`}
      />
      {ticks.map((t, i) => {
        const a = 2 * Math.PI * t - Math.PI / 2;
        return (
          <line
            key={i}
            x1={c + (R - 2.5) * Math.cos(a)}
            y1={c + (R - 2.5) * Math.sin(a)}
            x2={c + (R + 2.5) * Math.cos(a)}
            y2={c + (R + 2.5) * Math.sin(a)}
            stroke={i <= passed ? 'var(--color-ink)' : 'var(--color-ink-muted)'}
            strokeWidth={1}
          />
        );
      })}
      <circle ref={tip} cx={c} cy={c - R} r={1.5} fill="var(--color-accent)" />
    </svg>
  );
}
