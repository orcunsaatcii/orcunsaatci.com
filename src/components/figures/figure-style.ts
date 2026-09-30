// src/components/figures/figure-style.ts — SVG figürlerinin ortak ölçüleri, sınıfları ve küçük yardımcıları (§6.6.5).
// Renk yalnız Tailwind renk yardımcılarıyla (CSS değişkenleri) verilir; figür temaya kendiliğinden uyar.
// Geometri formülleri section-geometry.ts'tedir (§5.10); burada yalnız çizim ölçüleri ve sınıflar durur.
import { polar, ringRadius, sectorOffsetDeg } from '@/lib/section-geometry';

export const SIZE = 200; // viewBox 0 0 200 200
export const C = SIZE / 2;
/**
 * Çapa figürleri (Dial, Rings, Arc): disk kutunun 0.8'i, posterdeki Taş oranıyla aynı (POSTER_STONE_FRAC, §5.16.4).
 * Figür poster kutusuna konursa disk çapı D olur; kenar payı etiketlere kalır.
 */
export const R_FIGURE = 80;
/** Glifler (64 / 24 px): etiket yok; 24 px'te 1.5 px bant çizgisi (≈ 6.3 birim) viewBox'tan taşmaz. */
export const R_GLYPH = 88;
/** Küçük boyutta iki halka çizgisi arasındaki en küçük aralık (px); altında halkalar gri bir lekeye döner. */
export const MIN_RING_GAP_PX = 2.5;

export const r2 = (n: number) => Math.round(n * 100) / 100;

export const cx = (...parts: ReadonlyArray<string | false | null | undefined>): string =>
  parts.filter(Boolean).join(' ');

/* ───────────── sınıflar (§6.6.5 ortak görsel sözleşme; forced-colors: çizgi CanvasText, etkin Highlight) ───────────── */

/** Kesit diski: surface dolgu, 1 px line-strong dış çizgi */
export const DISK =
  'fill-surface stroke-line-strong [vector-effect:non-scaling-stroke] forced-colors:fill-[Canvas] forced-colors:stroke-[CanvasText]';
/** Halkalar ve dilim çizgileri: 1 px ink-muted */
export const LINE =
  'fill-none stroke-ink-muted [vector-effect:non-scaling-stroke] forced-colors:stroke-[CanvasText]';
/** Geri çekilmiş halkalar: plan görünüşü (K2 ringContrast 0.4, §4.8.5); ClockFigure iç halkalarıyla aynı */
export const LINE_FAINT =
  'fill-none stroke-line [vector-effect:non-scaling-stroke] forced-colors:stroke-[CanvasText]';
/**
 * Dilim kaması: yol her zaman DOM'dadır, görünürlüğü öznitelikler verir: data-active → 0.5, data-preview → 0.25
 * (etkin olan önizlemeyi ezer). 240 ms fill-opacity geçişi; azaltılmış harekette globals.css 1 ms yapar.
 */
export const SECTOR =
  'fill-accent stroke-none [fill-opacity:0] transition-[fill-opacity] duration-(--dur-base) ease-standard data-active:[fill-opacity:0.5] [&[data-preview]:not([data-active])]:[fill-opacity:0.25] forced-colors:fill-[Highlight]';
/** Etkin bandın iç ve dış sınırı: 1.5 px accent */
export const BAND_EDGE =
  'fill-none stroke-accent [stroke-width:1.5] [vector-effect:non-scaling-stroke] forced-colors:stroke-[Highlight]';
/** Bandın içi: renk yok, ink %6. Halka alanı tek kalın konturdur (kalınlık = bant genişliği, kullanıcı biriminde). */
export const BAND_FILL =
  'fill-none stroke-ink [stroke-opacity:0.06] forced-colors:stroke-[CanvasText]';
/**
 * Etiket (yıl, alan indeksi): type-meta + ink-subtle dolgu. SVG'de CSS px kullanıcı birimidir ve viewBox'la ölçeklenir;
 * type-meta'nın rem boyutu bu yüzden viewBox biriminde ezilir (8 birim: 310 px figürde ≈ 12 px, 530 px'te ≈ 21 px).
 */
export const LABEL = 'type-meta [font-size:8px]! fill-ink-subtle forced-colors:fill-[CanvasText]';
/** Halkaların üstündeki etiketin halesi: dolgunun altında surface renkli kontur (paint-order) */
export const LABEL_HALO =
  '[paint-order:stroke] stroke-surface [stroke-width:3px] [stroke-linejoin:round] forced-colors:stroke-[Canvas]';

/* ───────────── yardımcılar ───────────── */

/** 0 ≤ i < n olan tam sayı → i; aksi hâlde null */
export function indexIn(i: number | null | undefined, n: number): number | null {
  return i != null && Number.isInteger(i) && i >= 0 && i < n ? i : null;
}

export interface BandGeometry {
  inner: number; // halka a'nın iç kenarı (a = 0 → 0: iç sınır çizgisi yok)
  outer: number; // halka b'nin dış kenarı = ringRadius(b)
  mid: number;
  width: number;
}

/**
 * Bant [a, b] (halka indeksleri; halka i, R·i/rings … R·(i+1)/rings aralığıdır): R·a/rings … R·(b+1)/rings.
 * null ve NO_BAND ([-10, -10]) → null; indeksler [0, rings − 1]'e kırpılır.
 */
export function bandGeometry(
  band: readonly [number, number] | null | undefined,
  rings: number,
  R: number,
): BandGeometry | null {
  if (!band || Math.max(band[0], band[1]) < 0 || rings < 1) return null;
  const clampRing = (i: number) => Math.min(Math.max(Math.round(i), 0), rings - 1);
  const a = clampRing(Math.min(band[0], band[1]));
  const b = clampRing(Math.max(band[0], band[1]));
  const inner = a > 0 ? ringRadius(a - 1, rings, R) : 0;
  const outer = ringRadius(b, rings, R);
  return {
    inner: r2(inner),
    outer: r2(outer),
    mid: r2((inner + outer) / 2),
    width: r2(outer - inner),
  };
}

/**
 * Küçük glifte çizilen iç halka sınırları (ringRadius indeksleri, 0 … rings − 2; dıştaki sınır disk kenarıdır).
 * Yarıçapa sığan sınır sayısı `fit` (aralık ≥ MIN_RING_GAP_PX) halka sayısından azsa sınırlar eşit aralıkla seyreltilir:
 * 24 px'te en çok 4, 64 px'te en çok 11 sınır. Bant konumu gerçek halka sayısıyla hesaplanır, orantılı kalır.
 */
export function visibleRings(rings: number, sizePx: number, R: number): number[] {
  const radiusPx = (R / SIZE) * sizePx;
  const fit = Math.min(rings, Math.max(1, Math.floor(radiusPx / MIN_RING_GAP_PX)));
  return Array.from({ length: fit - 1 }, (_, j) => Math.round(((j + 1) * rings) / fit) - 1);
}

/** N dilim sınırı: merkezden R'ye, offset + k·360/N doğrultusunda (plan görünüm) */
export function sectorSpokes(n: number, R: number): Array<{ x2: number; y2: number }> {
  return Array.from({ length: n }, (_, k) => {
    const [x, y] = polar(C, C, R, sectorOffsetDeg(n) + (k * 360) / n);
    return { x2: r2(x), y2: r2(y) };
  });
}

/** Dilim k'nın orta doğrultusu: offset + (k + ½)·360/N */
export function sectorCenterDeg(k: number, n: number): number {
  return sectorOffsetDeg(n) + ((k + 0.5) * 360) / n;
}
