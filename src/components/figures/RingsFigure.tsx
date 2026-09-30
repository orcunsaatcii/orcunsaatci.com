// src/components/figures/RingsFigure.tsx — kariyer halkaları (K4 journey-core, D3 cv-core; §4.10.8, §4.16.3, §6.6.5).
// Sunucu uyumlu; olay aboneliği yok. Merkez kariyer başlangıcı, dış halka build yılıdır (§5.10); yıl etiketli.
// Girdi bantlarının hepsi SSR'da çizilir; yalnız data-active taşıyan grup görünür. Gizleme opacity ile (hidden değil):
// değişim 240 ms solar, azaltılmış harekette 1 ms. Tüketici el.toggleAttribute('data-active', on) yazar (§4.16.2).
// BandMark, bant işaretidir (içi ink %6, iki 1.5 px accent sınır); SpecimenGlyph ve EntryGlyph de kullanır.
import type { SVGProps } from 'react';
import { ringRadius } from '@/lib/section-geometry';
import {
  BAND_EDGE,
  BAND_FILL,
  C,
  DISK,
  LABEL,
  LABEL_HALO,
  LINE,
  R_FIGURE,
  SIZE,
  bandGeometry,
  cx,
  r2,
  type BandGeometry,
} from './figure-style';

export interface RingsFigureProps {
  rings: number; // StageData.rings (4–24)
  startYear: number; // kariyer başlangıcı (merkez)
  currentYear: number; // build yılı (dış halka)
  /** "Kariyer halkaları: 2014 – 2026" (§10.4.4) */
  ariaLabel: string;
  /** girdilerin halka bantları (getStageData); null → o indekste çizim yok, indeksler kaymaz */
  bands?: ReadonlyArray<readonly [number, number] | null>;
  /** başlangıçta vurgulu bant (bands indeksi); null = yok */
  active?: number | null;
  className?: string;
}

/** Etkin bant grubu: data-active yoksa opacity 0 (DOM'da kalır) */
const BAND_TOGGLE =
  'opacity-0 transition-opacity duration-(--dur-base) ease-standard data-active:opacity-100';

type BandMarkProps = { geometry: BandGeometry } & Omit<SVGProps<SVGGElement>, 'ref'>;

/** Bant işareti: halka alanı (ink %6) + iç ve dış 1.5 px accent sınır; a = 0 iken iç sınır yoktur. */
export function BandMark({ geometry: g, ...rest }: BandMarkProps) {
  return (
    <g {...rest}>
      <circle cx={C} cy={C} r={g.mid} strokeWidth={g.width} className={BAND_FILL} />
      {g.inner > 0 ? <circle cx={C} cy={C} r={g.inner} className={BAND_EDGE} /> : null}
      <circle cx={C} cy={C} r={g.outer} className={BAND_EDGE} />
    </g>
  );
}

export function RingsFigure({
  rings,
  startYear,
  currentYear,
  ariaLabel,
  bands = [],
  active = null,
  className,
}: RingsFigureProps) {
  const n = Math.max(1, Math.floor(rings));
  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label={ariaLabel}
      data-rings-figure=""
      className={cx('block h-auto w-full', className)}
    >
      {/* disk kenarı en dış halkanın (n − 1) dış sınırıdır; iç sınırlar data-ring */}
      <circle cx={C} cy={C} r={R_FIGURE} className={DISK} />
      {Array.from({ length: n - 1 }, (_, i) => (
        <circle
          key={i}
          data-ring={i}
          cx={C}
          cy={C}
          r={r2(ringRadius(i, n, R_FIGURE))}
          className={LINE}
        />
      ))}
      {bands.map((band, i) => {
        const g = bandGeometry(band, n, R_FIGURE);
        return g ? (
          <BandMark
            key={i}
            geometry={g}
            data-band={i}
            data-active={i === active ? '' : undefined}
            className={BAND_TOGGLE}
          />
        ) : null;
      })}
      {/* merkez = başlangıç yılı (halkaların üstünde, surface halesiyle); dış halka = build yılı, saat 12'de */}
      <text
        data-year="start"
        x={C}
        y={C}
        textAnchor="middle"
        dominantBaseline="central"
        className={cx(LABEL, LABEL_HALO)}
      >
        {startYear}
      </text>
      <text
        data-year="current"
        x={C}
        y={C - R_FIGURE - 10}
        textAnchor="middle"
        dominantBaseline="central"
        className={LABEL}
      >
        {currentYear}
      </text>
    </svg>
  );
}
