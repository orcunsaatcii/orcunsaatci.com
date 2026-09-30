// src/stage/anchor-screen.ts — kare başına çapa ekran dikdörtgeni ve analitik ölçek (§5.7.5). Saf aritmetik, kare
// başına bellek ayırmaz. Yalnız rig (gl/StageRig) kullanır: sahne chunk'ına girer, ilk pakete girmez. Three-free.
import type { MeasuredAnchor } from './anchors';

export interface AnchorRect {
  cx: number;
  cy: number;
  D: number;
}

/**
 * §5.7.5 kare başına ekran dikdörtgeni (saf). y = window.scrollY; stoneRy = radii.y / R0 (bottom hizalama).
 * `out` verilirse ona yazar (useFrame içinde bellek ayırma YASAK).
 */
export function anchorScreen(
  a: MeasuredAnchor,
  y: number,
  stoneRy: number,
  out: AnchorRect = { cx: 0, cy: 0, D: 0 },
): AnchorRect {
  let top: number;
  if (a.kind === 'viewport') top = a.chapterOffsetTop ?? 0;
  else if (a.kind === 'sticky' && a.sticky) {
    const s = a.sticky;
    const sTop = Math.min(
      Math.max(s.naturalDocTop - y, s.top),
      s.containerDocBottom - y - s.height,
    );
    top = sTop + (a.docTop - s.naturalDocTop);
  } else top = a.docTop - y;
  const D =
    a.rule === 'hero'
      ? Math.min(0.68 * a.width, a.height - 24)
      : a.size * Math.min(a.width, a.height);
  out.cx = a.left + a.width / 2;
  out.cy = a.align === 'bottom' ? top + a.height - 0.5 * D * stoneRy : top + a.height / 2;
  out.D = Math.max(0, D);
  return out;
}

/**
 * Analitik ölçek (§5.7.5): scale = D · (2 · r · tan(fov/2)) / (2 · R0 · H). r ve fov damped değerlerdir; dolly-zoom
 * sırasında boyut sabit kalır. R0 = footprintRadius(radii, n1).
 */
export function stoneScale(D: number, r: number, fovDeg: number, R0: number, H: number): number {
  return (D * 2 * r * Math.tan((fovDeg * Math.PI) / 360)) / (2 * R0 * H);
}
