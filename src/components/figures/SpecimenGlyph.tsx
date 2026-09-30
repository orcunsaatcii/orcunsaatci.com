// src/components/figures/SpecimenGlyph.tsx — proje başına numune glifi: bant + dilim (K3, D1; §4.9.9, §4.16.3, §6.6.5).
// Sunucu uyumlu, statik; aria-hidden (makale metasını tekrarlar, §10.4.4). Projenin alan dilimi accent 0.5 ve sabit
// −ψ(alan) dönüşüyle saat 9'dadır (§5.7.7); alan yoksa dönüş yok. Küçük boyutta halka çizgileri seyreltilir.
import { psiDeg, ringRadius, sectorPath } from '@/lib/section-geometry';
import {
  C,
  DISK,
  LINE,
  R_GLYPH,
  SECTOR,
  SIZE,
  bandGeometry,
  cx,
  indexIn,
  r2,
  sectorSpokes,
  visibleRings,
} from './figure-style';
import { BandMark } from './RingsFigure';

export interface SpecimenGlyphProps {
  rings: number;
  sectors: number; // N (0 = dilim yok, liste modu)
  band: readonly [number, number] | null;
  area: number | null; // projenin birincil alanı (dilim indeksi)
  /** px; varsayılan 64. Halka seyreltmesi bu boyuta göre yapılır. */
  size?: number;
  className?: string;
}

export function SpecimenGlyph({
  rings,
  sectors,
  band,
  area,
  size = 64,
  className,
}: SpecimenGlyphProps) {
  const n = Math.max(1, Math.floor(rings));
  const N = sectors >= 3 ? Math.floor(sectors) : 0;
  const k = indexIn(area, N);
  const g = bandGeometry(band, n, R_GLYPH);
  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      data-specimen-glyph=""
      className={cx('shrink-0', className)}
    >
      <circle cx={C} cy={C} r={R_GLYPH} className={DISK} />
      {N > 0 ? (
        <g
          data-sector-rotor=""
          transform={k !== null ? `rotate(${r2(-psiDeg(k, N))} ${C} ${C})` : undefined}
        >
          {k !== null ? (
            <path
              data-sector={k}
              data-active=""
              d={sectorPath(k, N, R_GLYPH, C, C)}
              className={SECTOR}
            />
          ) : null}
          {sectorSpokes(N, R_GLYPH).map((p, i) => (
            <line key={i} x1={C} y1={C} {...p} className={LINE} />
          ))}
        </g>
      ) : null}
      {visibleRings(n, size, R_GLYPH).map((i) => (
        <circle
          key={i}
          data-ring={i}
          cx={C}
          cy={C}
          r={r2(ringRadius(i, n, R_GLYPH))}
          className={LINE}
        />
      ))}
      {g ? <BandMark geometry={g} data-band="" /> : null}
    </svg>
  );
}
