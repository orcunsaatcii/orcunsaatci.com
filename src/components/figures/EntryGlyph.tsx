// src/components/figures/EntryGlyph.tsx — CV / journey girdisi başına 24 px halka glifi: girdinin bandı (§4.10.7, §6.6.5).
// Sunucu, statik; aria-hidden (yıllar yanındaki metinde, §10.4.4). 24 px'te 24 halka gri bir lekeye döner: çizilen
// sınırlar ≥ 2.5 px aralıkla eşit seyreltilir (en çok 4), bant ise gerçek halka sayısıyla orantılı çizilir.
import { ringRadius } from '@/lib/section-geometry';
import { C, DISK, LINE, R_GLYPH, SIZE, bandGeometry, cx, r2, visibleRings } from './figure-style';
import { BandMark } from './RingsFigure';

export interface EntryGlyphProps {
  rings: number;
  band: readonly [number, number] | null;
  /** px; varsayılan 24 */
  size?: number;
  className?: string;
}

export function EntryGlyph({ rings, band, size = 24, className }: EntryGlyphProps) {
  const n = Math.max(1, Math.floor(rings));
  const g = bandGeometry(band, n, R_GLYPH);
  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      data-entry-glyph=""
      className={cx('shrink-0', className)}
    >
      <circle cx={C} cy={C} r={R_GLYPH} className={DISK} />
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
