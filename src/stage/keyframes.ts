// src/stage/keyframes.ts — K0–K5 ve D1–D5 anahtar değerlerinin tek kaynağı (§5.8, D-42). Three-free ve saf.
// Sayılar §5.8.1 ve §5.8.2 tablolarından birebir alınmıştır. Track'ler (§5.9.4) from/to değerlerini buradan okur.
import { psiDeg, wrapNear } from '@/lib/section-geometry';
import type { AnchorId } from './anchors';

export type KeyframeKey =
  | 'hero'
  | 'about-lift'
  | 'about-cut-in'
  | 'about-half'
  | 'areas-plan'
  | 'work-specimen'
  | 'journey-core'
  | 'contact-ring'
  | 'folio'
  | 'plan-small'
  | 'cv-core'
  | 'about-page'
  | 'contact-page';

/** Sıra: K0, K1a, K1b, K1, K2, K3, K4, K5, D1, D2, D3, D4, D5 */
export const KEYFRAME_KEYS = [
  'hero',
  'about-lift',
  'about-cut-in',
  'about-half',
  'areas-plan',
  'work-specimen',
  'journey-core',
  'contact-ring',
  'folio',
  'plan-small',
  'cv-core',
  'about-page',
  'contact-page',
] as const satisfies readonly KeyframeKey[];

/** Tablolardaki kısa adlar (QA ızgarası ve onay paketi dosya adları) */
export const KEYFRAME_LABEL: Readonly<Record<KeyframeKey, string>> = {
  hero: 'K0',
  'about-lift': 'K1a',
  'about-cut-in': 'K1b',
  'about-half': 'K1',
  'areas-plan': 'K2',
  'work-specimen': 'K3',
  'journey-core': 'K4',
  'contact-ring': 'K5',
  folio: 'D1',
  'plan-small': 'D2',
  'cv-core': 'D3',
  'about-page': 'D4',
  'contact-page': 'D5',
};

export type Fills = readonly [number, number, number, number, number, number];

export interface Keyframe {
  anchor: AnchorId | 'blend'; // K1a: hero-rest → about-cut, mix 0.45
  r: number;
  az: number;
  el: number;
  fov: number;
  rotY: number;
  rotX: number;
  cut: number;
  ringContrast: number;
  sectorMix: number;
  ghost: number;
  arcGlow: number;
  lightAz: number;
  lightEl: number;
  rim: number;
  tone: number;
  bandVisible: number;
  fills: Fills;
}

export interface StageContentCtx {
  N: number; // alan sayısı (3–6; ≥ 7 → liste modu, sectors 0)
  areasMode: 'dial' | 'list';
  psi: readonly number[]; // psiDeg(k, N)
  W0: number; // §5.8.1
  lastPsi: number; // dial: 45 − (N−1)Δ; liste: 45
  projectAreas: readonly (number | null)[]; // öne çıkan projelerin alan indeksleri (P = 3–5)
  /** journey BODY dönüşü, derece (§4.12.1 satır 14; kısa BODY'de ölçeklenir, tracks.journeyTurnOf) */
  journeyTurn: number;
}

/** Journey BODY dönüşünün tavanı (varsayılan içerik, E = 6) */
export const JOURNEY_TURN_DEG = 60;

/** Areas liste moduna geçiş eşiği (§5.10: N ≥ 7 → liste, uSectors 0) */
export const LIST_MODE_MIN_AREAS = 7;

/**
 * İçerik bağlamı: alan sayısı ve öne çıkan projelerin alan indekslerinden ψ, W₀ ve lastPsi.
 * W₀ = wrapNear(ψ(proje 1'in alanı), lastPsi); proje 1'in alanı yoksa W₀ = lastPsi (§5.8.1).
 */
export function contentCtx(n: number, projectAreas: readonly (number | null)[]): StageContentCtx {
  const dial = n > 0 && n < LIST_MODE_MIN_AREAS;
  const psi = Array.from({ length: Math.max(n, 0) }, (_, k) => psiDeg(k, n));
  const lastPsi = dial ? 45 - ((n - 1) * 360) / n : 45;
  const first = projectAreas[0] ?? null;
  const W0 = first === null ? lastPsi : wrapNear(psiDeg(first, n), lastPsi);
  return {
    N: n,
    areasMode: dial ? 'dial' : 'list',
    psi,
    W0,
    lastPsi,
    projectAreas,
    journeyTurn: JOURNEY_TURN_DEG,
  };
}

const fills = (others: number, active?: number | null, activeValue = 0): Fills => {
  const f = [others, others, others, others, others, others];
  if (active !== null && active !== undefined && active >= 0 && active < 6) f[active] = activeValue;
  return f as unknown as Fills;
};

/** Saf: içerik bağlamı → anahtar değerleri (rotY'ler ψ/W₀ ile çözülmüş). */
export function keyframes(ctx: StageContentCtx): Record<KeyframeKey, Keyframe> {
  const { W0 } = ctx;
  const psi0 = ctx.psi[0] ?? 45;
  const project1Area = ctx.projectAreas[0] ?? null;
  // D1'in temel değeri öne çıkan proje 1'dir; proje sayfası preset'i (M7) sayfanın projesiyle değiştirir.
  const folioPsi =
    project1Area === null || ctx.areasMode === 'list' ? psi0 : (ctx.psi[project1Area] ?? psi0);
  const none = fills(0);

  // Anahtar değerleri §5.8.1 / §5.8.2 tablolarının sütun sırasıyla okunur.
  // prettier-ignore
  return {
    // K0: bütün Taş, kesilmemiş
    hero: {
      anchor: 'hero-rest',
      r: 5.2, az: -25, el: 12, fov: 30,
      rotY: 0, rotX: 0, cut: 1.1,
      ringContrast: 0, sectorMix: 0, ghost: 0, arcGlow: 0,
      lightAz: -60, lightEl: 38, rim: 0.25, tone: 1,
      bandVisible: 0, fills: none,
    },
    // K1a: about IN p = 0.30
    'about-lift': {
      anchor: 'blend',
      r: 5.2, az: -25, el: 12, fov: 30,
      rotY: 12, rotX: 0, cut: 1.1,
      ringContrast: 0, sectorMix: 0, ghost: 0, arcGlow: 0,
      lightAz: -60, lightEl: 38, rim: 0.25, tone: 1,
      bandVisible: 0, fills: none,
    },
    // K1b: about IN sonu
    'about-cut-in': {
      anchor: 'about-cut',
      r: 4.8, az: -14, el: 40, fov: 28,
      rotY: 30, rotX: 0, cut: 0.35,
      ringContrast: 0.6, sectorMix: 0, ghost: 0.1, arcGlow: 0,
      lightAz: -40, lightEl: 48, rim: 0.25, tone: 1,
      bandVisible: 0, fills: none,
    },
    // K1: about BODY sonu, yarım kesit
    'about-half': {
      anchor: 'about-cut',
      r: 4.6, az: -14, el: 55, fov: 28,
      rotY: 35, rotX: 0, cut: 0,
      ringContrast: 1, sectorMix: 0, ghost: 0.1, arcGlow: 0,
      lightAz: -30, lightEl: 55, rim: 0.25, tone: 1,
      bandVisible: 0, fills: none,
    },
    // K2: plan görünüşü; dilim 0 etkin
    'areas-plan': {
      anchor: 'areas-dial',
      r: 7.2, az: 0, el: 88, fov: 18,
      rotY: psi0, rotX: 0, cut: 0,
      ringContrast: 0.4, sectorMix: 1, ghost: 0.1, arcGlow: 0,
      lightAz: 0, lightEl: 80, rim: 0.25, tone: 1,
      bandVisible: 0, fills: fills(0.15, 0, 1),
    },
    // K3: numune; dolgu event'e bağlı (proje 1'in alanı 0.6, diğerleri 0.12)
    'work-specimen': {
      anchor: 'work-specimen',
      r: 5.6, az: 0, el: 20, fov: 26,
      rotY: W0, rotX: 62, cut: -0.02,
      ringContrast: 0.9, sectorMix: 0.5, ghost: 0, arcGlow: 0.35,
      lightAz: 25, lightEl: 22, rim: 0.25, tone: 1,
      bandVisible: 1, fills: fills(0.12, project1Area, 0.6),
    },
    // K4: karot
    'journey-core': {
      anchor: 'journey-core',
      r: 5.8, az: 0, el: 72, fov: 26,
      rotY: W0 + 50, rotX: 0, cut: 0,
      ringContrast: 1, sectorMix: 0, ghost: 0.06, arcGlow: 0.2,
      lightAz: -20, lightEl: 60, rim: 0.25, tone: 1,
      bandVisible: 1, fills: none,
    },
    // K5: bir sonraki halka
    'contact-ring': {
      anchor: 'contact-ring',
      r: 4.9, az: 0, el: 22, fov: 30,
      rotY: W0 + 70 + ctx.journeyTurn, rotX: 68, cut: -0.05,
      ringContrast: 0.7, sectorMix: 0, ghost: 0, arcGlow: 1,
      lightAz: 70, lightEl: 14, rim: 0.35, tone: 1,
      bandVisible: 0, fills: none,
    },
    // D1: proje sayfası (K3'ten: ışık, ghost, sectorMix, bant, diğer dolgular)
    folio: {
      anchor: 'page-folio',
      r: 5.6, az: 0, el: 20, fov: 26,
      rotY: folioPsi, rotX: 62, cut: -0.02,
      ringContrast: 0.9, sectorMix: 0, ghost: 0, arcGlow: 0.35,
      lightAz: 25, lightEl: 22, rim: 0.25, tone: 1,
      bandVisible: 1, fills: fills(0.12, project1Area, 0.6),
    },
    // D2: /projeler, /calisma-alanlari (filtre yoksa rotY = ψ₀, §4.12.4 #12)
    'plan-small': {
      anchor: 'page-folio',
      r: 7.2, az: 0, el: 88, fov: 18,
      rotY: psi0, rotX: 0, cut: 0,
      ringContrast: 0.4, sectorMix: 1, ghost: 0, arcGlow: 0,
      lightAz: 0, lightEl: 80, rim: 0.25, tone: 1,
      bandVisible: 0, fills: fills(0.15),
    },
    // D3: /cv (K4'ten: ışık, ghost, arcGlow, bant); rotY kaydırmayla +0 → +60
    'cv-core': {
      anchor: 'cv-core',
      r: 5.8, az: 0, el: 72, fov: 26,
      rotY: 0, rotX: 0, cut: 0,
      ringContrast: 1, sectorMix: 0, ghost: 0.06, arcGlow: 0.2,
      lightAz: -20, lightEl: 60, rim: 0.25, tone: 1,
      bandVisible: 1, fills: none,
    },
    // D4: /hakkimda (K1 gibi)
    'about-page': {
      anchor: 'page-folio',
      r: 4.6, az: -14, el: 55, fov: 28,
      rotY: 35, rotX: 0, cut: 0,
      ringContrast: 1, sectorMix: 0, ghost: 0.1, arcGlow: 0,
      lightAz: -30, lightEl: 55, rim: 0.25, tone: 1,
      bandVisible: 0, fills: none,
    },
    // D5: /iletisim (K5 gibi)
    'contact-page': {
      anchor: 'page-folio',
      r: 4.9, az: 0, el: 22, fov: 30,
      rotY: 60, rotX: 68, cut: -0.05,
      ringContrast: 0.7, sectorMix: 0, ghost: 0, arcGlow: 1,
      lightAz: 70, lightEl: 14, rim: 0.35, tone: 1,
      bandVisible: 0, fills: none,
    },
  };
}

/** Kamera konumu: (r·cos el·sin az, r·sin el, r·cos el·cos az); hedef daima (0, 0, 0) (§5.7.1) */
export function cameraPosition(k: Pick<Keyframe, 'r' | 'az' | 'el'>): [number, number, number] {
  const az = (k.az * Math.PI) / 180;
  const el = (k.el * Math.PI) / 180;
  return [k.r * Math.cos(el) * Math.sin(az), k.r * Math.sin(el), k.r * Math.cos(el) * Math.cos(az)];
}
