// src/lib/section-geometry.ts — halka, bant, dilim, ψ, capRadius ve yay hesapları (§5.10).
// Three-free ve saf: shader uniform'ları ile bütün SVG figürleri aynı sayıları buradan alır.

export const RINGS_MIN = 4;
export const RINGS_MAX = 24;
export const NO_BAND = [-10, -10] as const;

export interface RingGeometry {
  careerStartYear: number;
  currentYear: number;
  years: number;
  rings: number;
  span: number;
}

const DAY_MS = 86_400_000;
const RAD = Math.PI / 180;

const clamp = (x: number, lo: number, hi: number): number => Math.min(Math.max(x, lo), hi);

/** years = currentYear − careerStartYear + 1; rings = clamp(years, 4, 24); span = max(years, rings) */
export function ringGeometry(careerStartYear: number, currentYear: number): RingGeometry {
  const years = currentYear - careerStartYear + 1;
  const rings = clamp(years, RINGS_MIN, RINGS_MAX);
  return { careerStartYear, currentYear, years, rings, span: Math.max(years, rings) };
}

/** clamp(rings − 1 − floor((currentYear − year) · rings / span), 0, rings − 1) */
export function ringOf(year: number, g: RingGeometry): number {
  const back = Math.floor(((g.currentYear - year) * g.rings) / g.span);
  return clamp(g.rings - 1 - back, 0, g.rings - 1);
}

/** [min, max] of ringOf(start), ringOf(end ?? currentYear). Yılı olmayan kayıt için çağıran NO_BAND kullanır. */
export function bandOf(
  start: number,
  end: number | null | undefined,
  g: RingGeometry,
): readonly [number, number] {
  const a = ringOf(start, g);
  const b = ringOf(end ?? g.currentYear, g);
  return a <= b ? [a, b] : [b, a];
}

/** 135 − 180/n (derece) */
export function sectorOffsetDeg(n: number): number {
  return 135 - 180 / n;
}

/** 45 − k·360/n (derece): plan görünümde dilim k'nın merkezini saat 9 yönüne getiren dönüş (§5.7.7) */
export function psiDeg(k: number, n: number): number {
  return 45 - (k * 360) / n;
}

/** angle + 360·round((ref − angle)/360): ref'e en fazla 180° uzak eşdeğer açı */
export function wrapNear(angle: number, ref: number): number {
  return angle + 360 * Math.round((ref - angle) / 360);
}

/** a − 360·round(a/360) */
export function wrap180(a: number): number {
  return a - 360 * Math.round(a / 360);
}

/** (|u|^n + |v|^n)^(1/n) */
export function superNorm(u: number, v: number, n: number): number {
  return (Math.abs(u) ** n + Math.abs(v) ** n) ** (1 / n);
}

/** |cut| ≥ radii.y → 0; aksi hâlde (1 − |cut/radii.y|^n2)^(1/n2) · radii.x (gürültü yok sayılır) */
export function capRadius(
  cut: number,
  radii: readonly [number, number, number],
  n2: number,
): number {
  const ry = radii[1];
  if (Math.abs(cut) >= ry) return 0;
  return (1 - Math.abs(cut / ry) ** n2) ** (1 / n2) * radii[0];
}

/**
 * XZ ayak izinin çevrel yarıçapı: süperelips |x|^n1 + |z|^n1 = 1'in merkezden en uzak noktası n1 ≥ 2 iken 45°'dedir
 * ve 2^(1/2 − 1/n1) · radii.x'tir; n1 < 2 iken eksendedir (radii.x). radii.x = radii.z varsayılır (tüm personalar).
 * SPEC-SAPMA: §5.7.5 — analitik ölçekte R0 bu değerdir (radii.x değil): D, köşeli şekillerde de Taş'ın ekrandaki çapı
 * olarak kalır (engineer n1 = 5 → 1.231; neutral n1 = 2.2 → 1.032).
 */
export function footprintRadius(radii: readonly [number, number, number], n1: number): number {
  return n1 >= 2 ? radii[0] * 2 ** (0.5 - 1 / n1) : radii[0];
}

/** dayOfYear / daysInYear, yerel saat. YALNIZCA client'ta, mount sonrası çağrılır (SSR'da asla). */
export function arcFraction(d: Date): number {
  const y = d.getFullYear();
  const dayOfYear = (Date.UTC(y, d.getMonth(), d.getDate()) - Date.UTC(y, 0, 1)) / DAY_MS + 1;
  const daysInYear = (Date.UTC(y + 1, 0, 1) - Date.UTC(y, 0, 1)) / DAY_MS;
  return dayOfYear / daysInYear;
}

/**
 * growth deseni: normalize kümülatif kenarlar [0, …, 1]; uzunluk = weights.length + 1 (≤ 25).
 * Pozitif olmayan ağırlıklar 0 sayılır. Ağırlıkların toplamı 0 ise halkalar eşit genişliktedir.
 */
export function ringEdges(weights: readonly number[]): number[] {
  const w = weights.slice(0, RINGS_MAX).map((x) => (Number.isFinite(x) && x > 0 ? x : 0));
  if (w.length === 0) return [0, 1];
  const total = w.reduce((sum, x) => sum + x, 0);
  const edges = [0];
  let acc = 0;
  for (let i = 0; i < w.length; i++) {
    acc += total > 0 ? (w[i] ?? 0) : 1;
    edges.push(acc / (total > 0 ? total : w.length));
  }
  edges[edges.length - 1] = 1;
  return edges;
}

// SVG yardımcıları (plan görünüm; ekran yukarısı = −Z; açı saat yönü tersine, +X'ten)

/** R·(i + 1)/rings */
export function ringRadius(i: number, rings: number, R: number): number {
  return (R * (i + 1)) / rings;
}

/** (cx + r·cos, cy − r·sin); açı derece */
export function polar(cx: number, cy: number, r: number, deg: number): readonly [number, number] {
  return [cx + r * Math.cos(deg * RAD), cy - r * Math.sin(deg * RAD)];
}

const f2 = (n: number): string => String(Math.round(n * 100) / 100);

/** Dilim k'nın kama yolu: [offset + kΔ, offset + (k+1)Δ], ekranda saat yönünün tersine */
export function sectorPath(k: number, n: number, R: number, cx: number, cy: number): string {
  const delta = 360 / n;
  const a0 = sectorOffsetDeg(n) + k * delta;
  const [x0, y0] = polar(cx, cy, R, a0);
  const [x1, y1] = polar(cx, cy, R, a0 + delta);
  const large = delta > 180 ? 1 : 0;
  return `M${f2(cx)} ${f2(cy)}L${f2(x0)} ${f2(y0)}A${f2(R)} ${f2(R)} 0 ${large} 0 ${f2(x1)} ${f2(y1)}Z`;
}

/** Açık yay: saat 12'den saat yönünde fraction·360°. rInner ≤ 0 ise kama. */
export function arcPath(
  fraction: number,
  rOuter: number,
  rInner: number,
  cx: number,
  cy: number,
): string {
  const f = clamp(fraction, 0, 0.99999);
  if (f === 0) return '';
  const a0 = 90;
  const a1 = 90 - f * 360;
  const large = f > 0.5 ? 1 : 0;
  const [ox0, oy0] = polar(cx, cy, rOuter, a0);
  const [ox1, oy1] = polar(cx, cy, rOuter, a1);
  const outer = `M${f2(ox0)} ${f2(oy0)}A${f2(rOuter)} ${f2(rOuter)} 0 ${large} 1 ${f2(ox1)} ${f2(oy1)}`;
  if (rInner <= 0) return `${outer}L${f2(cx)} ${f2(cy)}Z`;
  const [ix1, iy1] = polar(cx, cy, rInner, a1);
  const [ix0, iy0] = polar(cx, cy, rInner, a0);
  return `${outer}L${f2(ix1)} ${f2(iy1)}A${f2(rInner)} ${f2(rInner)} 0 ${large} 0 ${f2(ix0)} ${f2(iy0)}Z`;
}

/** ClockFigure (SVG 404, D-19): saat 12'den saat yönünde; akrep 30°·(h mod 12) + 0.5°·m, yelkovan 6°·m (§4.13.6) */
export function clockAngles(d: Date): { hourDeg: number; minuteDeg: number } {
  const m = d.getMinutes();
  return { hourDeg: 30 * (d.getHours() % 12) + 0.5 * m, minuteDeg: 6 * m };
}
