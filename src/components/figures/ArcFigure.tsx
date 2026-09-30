'use client';
// src/components/figures/ArcFigure.tsx — açık dış yay: bu yılın bugüne kadar oluşan kısmı (§4.11.7, §4.16.3, §6.6.5).
// K5 posterinin üstünde bindirme: disk dolgusu ve zemin yok, aria-hidden. Tarih yalnız istemcide (§5.10): SSR ve
// hidrasyon boş kabuk verir (sunucu anlık görüntüsü null), yay hidrasyondan hemen sonra arcFraction(new Date()) ile
// çizilir; hidrasyon uyumsuzluğu olmaz, JS'siz yay görünmez (§4.16.2). En dış halka alanında: oluşan kısım saat
// 12'den saat yönünde 2 px accent (dış kenar boyunca), kalan kısım 45° tarama (line). İkisi de arcPath kamasıyla kırpılır.
import { useId, useSyncExternalStore } from 'react';
import { arcFraction, arcPath, ringRadius } from '@/lib/section-geometry';
import { C, R_FIGURE, SIZE, cx, r2 } from './figure-style';

export interface ArcFigureProps {
  rings: number; // StageData.rings
  className?: string;
}

const HATCH = 3; // tarama aralığı (kullanıcı birimi)
const CLIP_R = SIZE; // kırpma kamasının yarıçapı: 2 px konturu her boyutta içine alır
const ARC =
  'fill-none stroke-accent [stroke-width:2] [vector-effect:non-scaling-stroke] forced-colors:stroke-[Highlight]';
const HATCH_LINE = 'stroke-line [stroke-width:0.6] forced-colors:stroke-[CanvasText]';

const noopSubscribe = () => () => {};
const clientFraction = () => arcFraction(new Date());
const serverFraction = () => null;

export function ArcFigure({ rings, className }: ArcFigureProps) {
  const id = `arc${useId().replace(/[^\w-]/g, '')}`;
  const fraction = useSyncExternalStore<number | null>(
    noopSubscribe,
    clientFraction,
    serverFraction,
  );
  const n = Math.max(1, Math.floor(rings));
  const rIn = ringRadius(n - 2, n, R_FIGURE); // en dış halkanın iç kenarı: R·(rings − 1)/rings
  const formed = fraction === null ? '' : arcPath(fraction, CLIP_R, 0, C, C);
  const rest = fraction === null ? '' : arcPath(1 - fraction, CLIP_R, 0, C, C);

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      aria-hidden="true"
      focusable="false"
      data-arc-figure=""
      className={cx('block h-auto w-full', className)}
    >
      {fraction !== null ? (
        <>
          <defs>
            <pattern
              id={`${id}-hatch`}
              width={HATCH}
              height={HATCH}
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <line x1={HATCH / 2} y1={0} x2={HATCH / 2} y2={HATCH} className={HATCH_LINE} />
            </pattern>
            {formed ? (
              <clipPath id={`${id}-formed`}>
                <path d={formed} />
              </clipPath>
            ) : null}
            {rest ? (
              // kalan kısım: aynı kama (1 − f), oluşan kısmın ucuna döndürülür
              <clipPath id={`${id}-rest`}>
                <path d={rest} transform={`rotate(${r2(fraction * 360)} ${C} ${C})`} />
              </clipPath>
            ) : null}
          </defs>
          {rest ? (
            <circle
              data-arc="rest"
              cx={C}
              cy={C}
              r={r2((R_FIGURE + rIn) / 2)}
              fill="none"
              stroke={`url(#${id}-hatch)`}
              strokeWidth={r2(R_FIGURE - rIn)}
              clipPath={`url(#${id}-rest)`}
            />
          ) : null}
          {formed ? (
            <circle
              data-arc="formed"
              cx={C}
              cy={C}
              r={R_FIGURE}
              clipPath={`url(#${id}-formed)`}
              className={ARC}
            />
          ) : null}
        </>
      ) : null}
    </svg>
  );
}
