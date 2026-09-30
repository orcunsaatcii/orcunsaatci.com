'use client';
// src/components/figures/ClockFigure.tsx — 404 saati (D-19, §4.13.6, §6.6.5). SVG; WebGL yok.
// SSR'da ibre yok (hidrasyon uyumsuzluğu olmaz, JS'siz ibresiz kadran). Mount sonrası ziyaretçinin yerel saati
// çizilir, dakika sınırında güncellenir; data-motion="reduce" iken o anki saatte donar (WCAG 2.2.2, §10.2.2).
import { useEffect, useState } from 'react';
import { PREF_EVENTS } from '@/lib/head-script';
import { clockAngles, polar, ringRadius } from '@/lib/section-geometry';

const SIZE = 200;
const C = SIZE / 2;
const R = 88;
const RINGS = 4; // düşük kontrastlı iç halkalar: R/4, R/2, 3R/4 (dış halka disk kenarıdır)

const r2 = (n: number) => Math.round(n * 100) / 100;

// 12 saat indeksi (saat 12'den saat yönünde; polar() açıyı +X'ten saat yönü tersine alır)
const INDICES = Array.from({ length: 12 }, (_, i) => {
  const deg = 90 - 30 * i;
  const [x1, y1] = polar(C, C, R * 0.84, deg);
  const [x2, y2] = polar(C, C, R * 0.96, deg);
  return { x1: r2(x1), y1: r2(y1), x2: r2(x2), y2: r2(y2) };
});

const LINE =
  'stroke-ink-muted [vector-effect:non-scaling-stroke] forced-colors:stroke-[CanvasText]';
const HAND =
  'stroke-accent [stroke-linecap:round] [stroke-width:1.5] [vector-effect:non-scaling-stroke] forced-colors:stroke-[Highlight]';

interface ClockFigureProps {
  /** "Yerel saat {time}" / "Local time {time}" (dict.notFound.clock) */
  label: string;
  className?: string;
}

function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function ClockFigure({ label, className }: ClockFigureProps) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    let timer = 0;
    const tick = () => {
      window.clearTimeout(timer);
      setNow(new Date());
      if (root.getAttribute('data-motion') !== 'reduce') {
        timer = window.setTimeout(tick, 60_000 - (Date.now() % 60_000));
      }
    };
    timer = window.setTimeout(tick, 0);
    window.addEventListener(PREF_EVENTS.motion, tick);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(PREF_EVENTS.motion, tick);
    };
  }, []);

  const angles = now ? clockAngles(now) : null;
  const text = label.replace('{time}', now ? hhmm(now) : '').trim();

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label={text}
      data-live-time=""
      className={['block h-auto w-full', className].filter(Boolean).join(' ')}
    >
      <circle
        cx={C}
        cy={C}
        r={R}
        className="fill-surface stroke-line-strong [vector-effect:non-scaling-stroke] forced-colors:fill-[Canvas] forced-colors:stroke-[CanvasText]"
      />
      {Array.from({ length: RINGS - 1 }, (_, i) => (
        <circle
          key={i}
          cx={C}
          cy={C}
          r={r2(ringRadius(i, RINGS, R))}
          fill="none"
          className="stroke-line [vector-effect:non-scaling-stroke] forced-colors:stroke-[CanvasText]"
        />
      ))}
      {INDICES.map((p, i) => (
        <line key={i} {...p} className={LINE} />
      ))}
      {angles && (
        <g>
          <line
            data-hand="hour"
            x1={C}
            y1={C}
            x2={C}
            y2={r2(C - R * 0.55)}
            transform={`rotate(${r2(angles.hourDeg)} ${C} ${C})`}
            className={HAND}
          />
          <line
            data-hand="minute"
            x1={C}
            y1={C}
            x2={C}
            y2={r2(C - R * 0.85)}
            transform={`rotate(${r2(angles.minuteDeg)} ${C} ${C})`}
            className={HAND}
          />
          <circle cx={C} cy={C} r={3} className="fill-accent forced-colors:fill-[Highlight]" />
        </g>
      )}
    </svg>
  );
}
