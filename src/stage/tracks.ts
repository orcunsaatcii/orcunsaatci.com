// src/stage/tracks.ts — track modeli, ana sayfa track tablosu ve değerlendirme (§5.9.3–§5.9.4). Three-free.
// Sahne durumu (preset, scrollY, ölçülmüş layout, içerik)'in saf fonksiyonudur (§5.1.1). Bu modül stageTarget dışında
// DOM'a YAZMAZ (K-GEN-3); measureLayout yalnız okur. Mobil anahtar geçersiz kılmaları (anchor bantları) M6'dadır.
import { INTENSITY, type Intensity } from '@/experience/profile';
import { psiDeg, wrapNear } from '@/lib/section-geometry';
import type { AnchorId, MeasuredAnchor } from './anchors';
import { contentCtx, type Keyframe, type StageContentCtx } from './keyframes';
import type { ChapterId, PresetName, StageData, StageTarget } from './store';

export type { ChapterId } from './store';
export type TrackPhase = 'in' | 'body';
export type Ease = 'linear' | 'smooth' | 'inOut' | 'sineInOut' | 'power3InOut'; // son ikisi areas dönüşü (§5.6.7)
export type TrackProp =
  | 'camR'
  | 'camAz'
  | 'camEl'
  | 'camFov'
  | 'rotYScroll'
  | 'rotX'
  | 'cut'
  | 'ringContrast'
  | 'sectorMix'
  | 'fill0'
  | 'fill1'
  | 'fill2'
  | 'fill3'
  | 'fill4'
  | 'fill5'
  | 'bandVisible'
  | 'ghost'
  | 'arcGlow'
  | 'rim'
  | 'tone'
  | 'lightAz'
  | 'lightEl'
  | 'anchorMix'
  | 'opacityTrack';

export const TRACK_PROPS: readonly TrackProp[] = [
  'camR',
  'camAz',
  'camEl',
  'camFov',
  'rotYScroll',
  'rotX',
  'cut',
  'ringContrast',
  'sectorMix',
  'fill0',
  'fill1',
  'fill2',
  'fill3',
  'fill4',
  'fill5',
  'bandVisible',
  'ghost',
  'arcGlow',
  'rim',
  'tone',
  'lightAz',
  'lightEl',
  'anchorMix',
  'opacityTrack',
];

export const FILL_PROPS = ['fill0', 'fill1', 'fill2', 'fill3', 'fill4', 'fill5'] as const;
export type FillProp = (typeof FILL_PROPS)[number];

export interface Track {
  prop: TrackProp;
  chapter: ChapterId;
  phase: TrackPhase;
  start: number; // yerel p ∈ [0, 1]
  end: number; // start < end
  from: number;
  to: number;
  ease: Ease; // varsayılan 'smooth'
  anchors?: readonly [AnchorId, AnchorId]; // yalnız prop === 'anchorMix'
}

export interface PhaseRange {
  chapter: ChapterId;
  phase: TrackPhase;
  y0: number;
  y1: number;
  order: number; // bölümIndeksi·2 + (body ? 1 : 0)
}

export interface Layout {
  vh: number;
  maxScroll: number;
  mobile: boolean;
  phases: readonly PhaseRange[]; // DOM sırasıyla
  anchors: readonly MeasuredAnchor[]; // M5
  activation: { work: number[]; journey: number[]; cv: number[] }; // "top 55%" çizgileri: docTop − 0.55·vh
  areas: { bodyY0: number; bodyLen: number; S: number; N: number } | null; // null = pin yok (liste modu)
  heroExit: number;
}

export interface ResolvedTrack extends Track {
  y0: number;
  y1: number;
  o0: number;
  o1: number;
}

export const EASE: Readonly<Record<Ease, (t: number) => number>> = {
  linear: (t) => t,
  smooth: (t) => t * t * (3 - 2 * t), // smoothstep
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2), // power2.inOut
  sineInOut: (t) => -(Math.cos(Math.PI * t) - 1) / 2, // sine.inOut (calm)
  power3InOut: (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2), // power3.inOut (expressive)
};

/** INTENSITY.areasTurnEase (GSAP adı) → track easing'i (§5.6.7) */
const TURN_EASE: Readonly<Record<string, Ease>> = {
  'sine.inOut': 'sineInOut',
  smoothstep: 'smooth',
  'power3.inOut': 'power3InOut',
};
export const areasTurnEase = (intensity: Intensity = 'standard'): Ease =>
  TURN_EASE[INTENSITY[intensity].areasTurnEase] ?? 'smooth';

export interface TrackVariant {
  layout: 'desktop' | 'mobile' | 'landscape';
  areasList: boolean; // N ≥ 7 ya da pin koşulu sağlanmıyor
  testimonials: boolean;
  shortViewport: boolean; // masaüstü, innerHeight < 760
}

/** Masaüstü areas adımı (svh); mobil pin 40 (§4.8.8) */
export const AREAS_STEP = { desktop: 50, mobile: 40 } as const;
/** Yatay telefon: mobil ve innerHeight < 500 (§5.9.4) */
const LANDSCAPE_MAX_VH = 500;
/** Kısa masaüstü görüntü alanı: innerHeight < 760 (§4.9.4 [SABİT]) */
export const SHORT_VIEWPORT_VH = 760;

export function variantOf(layout: Layout): TrackVariant {
  const has = (c: ChapterId) => layout.phases.some((p) => p.chapter === c);
  const landscape = layout.mobile && layout.vh < LANDSCAPE_MAX_VH;
  return {
    layout: landscape ? 'landscape' : layout.mobile ? 'mobile' : 'desktop',
    areasList: layout.areas === null,
    testimonials: has('testimonials'),
    shortViewport: !layout.mobile && layout.vh < SHORT_VIEWPORT_VH,
  };
}

/**
 * İçerik bağlamı + ölçülmüş layout. Pin yoksa (liste modu varyantı) referans açı ψ₀ = 45'tir (§5.8.1):
 * lastPsi 45, W₀ bu açıya göre sarılır. Dilim açıları (ψ) N'den gelir; N ≥ 7'de sectors 0'dır.
 */
export function stageCtx(data: StageData, layout: Layout | null): StageContentCtx {
  const base = contentCtx(
    data.sectors,
    data.projects.map((p) => p.area),
  );
  if (base.areasMode === 'list' || !layout || layout.areas) return base;
  const first = base.projectAreas[0] ?? null;
  const lastPsi = 45;
  return {
    ...base,
    areasMode: 'list',
    lastPsi,
    W0: first === null ? lastPsi : wrapNear(psiDeg(first, base.N), lastPsi),
  };
}

/** Son öne çıkan projenin event deseni: alanında 0.6, diğer i < N için 0.12 (§5.9.4 pattern(P)) */
export function lastProjectPattern(ctx: StageContentCtx): number[] {
  const area = ctx.projectAreas[ctx.projectAreas.length - 1] ?? null;
  return FILL_PROPS.map((_, i) => (i >= ctx.N ? 0 : i === area ? 0.6 : 0.12));
}

type Row = readonly [
  prop: TrackProp,
  start: number,
  end: number,
  from: number,
  to: number,
  ease?: Ease,
];

/** Tablo satırlarını track'lere çevirir (varsayılan ease 'smooth'). */
function rows(chapter: ChapterId, phase: TrackPhase, list: readonly Row[]): Track[] {
  return list.map(([prop, start, end, from, to, ease]) => ({
    prop,
    chapter,
    phase,
    start,
    end,
    from,
    to,
    ease: ease ?? 'smooth',
  }));
}

const mix = (
  chapter: ChapterId,
  phase: TrackPhase,
  start: number,
  end: number,
  from: number,
  to: number,
  anchors: readonly [AnchorId, AnchorId],
): Track => ({ prop: 'anchorMix', chapter, phase, start, end, from, to, ease: 'smooth', anchors });

const fill = (i: number): FillProp => FILL_PROPS[i] as FillProp;

/**
 * §5.9.4 ana sayfa tablosu + varyantlar. Derin preset'ler (D1–D5) M7'dedir; 'none' ve diğerleri boş liste döner.
 * turnEase: areas adım dönüşünün easing'i (persona yoğunluğu, §5.6.7).
 */
export function buildTracks(
  preset: PresetName,
  ctx: StageContentCtx,
  layout: Layout,
  v: TrackVariant,
  turnEase: Ease = 'smooth',
): Track[] {
  if (preset !== 'home') return [];
  const { W0, lastPsi } = ctx;
  const N = ctx.areasMode === 'dial' ? ctx.N : Math.min(ctx.N, 6);
  const out: Track[] = [];

  // about · IN
  out.push(
    mix('about', 'in', 0, 0.3, 0, 0.45, ['hero-rest', 'about-cut']),
    mix('about', 'in', 0.3, 0.6, 0.45, 1, ['hero-rest', 'about-cut']),
    ...rows('about', 'in', [
      ['rotYScroll', 0, 0.3, 0, 12],
      ['camR', 0.3, 1, 5.2, 4.8],
      ['camAz', 0.3, 1, -25, -14],
      ['camEl', 0.3, 1, 12, 40],
      ['camFov', 0.3, 1, 30, 28],
      ['cut', 0.3, 1, 1.1, 0.35, 'linear'],
      ['rotYScroll', 0.3, 1, 12, 30],
      ['ringContrast', 0.3, 1, 0, 0.6],
      ['ghost', 0.3, 1, 0, 0.1],
      ['lightAz', 0.3, 1, -60, -40],
      ['lightEl', 0.3, 1, 38, 48],
    ]),
  );
  // about · BODY
  out.push(
    ...rows('about', 'body', [
      ['camR', 0, 1, 4.8, 4.6],
      ['camEl', 0, 1, 40, 55],
      ['cut', 0, 1, 0.35, 0, 'linear'],
      ['rotYScroll', 0, 1, 30, 35],
      ['ringContrast', 0, 1, 0.6, 1],
      ['lightAz', 0, 1, -40, -30],
      ['lightEl', 0, 1, 48, 55],
    ]),
  );
  // areas · IN (dolly-zoom)
  out.push(
    mix('areas', 'in', 0, 0.7, 0, 1, ['about-cut', 'areas-dial']),
    ...rows('areas', 'in', [
      ['camR', 0, 1, 4.6, 7.2],
      ['camFov', 0, 1, 28, 18],
      ['camEl', 0, 1, 55, 88],
      ['camAz', 0, 1, -14, 0],
      ['rotYScroll', 0, 1, 35, ctx.psi[0] ?? 45],
      ['ringContrast', 0, 1, 1, 0.4],
      ['lightAz', 0, 1, -30, 0],
      ['lightEl', 0, 1, 55, 80],
      ['sectorMix', 0.4, 1, 0, 1],
    ]),
  );
  if (N > 0) out.push(...rows('areas', 'in', [['fill0', 0.8, 1, 0, 1]]));
  for (let i = 1; i < N; i++) out.push(...rows('areas', 'in', [[fill(i), 0.6, 1, 0, 0.15]]));

  // areas · BODY (yalnız pin / dial)
  if (!v.areasList && layout.areas && ctx.areasMode === 'dial') {
    const S = layout.areas.S;
    const L = 20 + S * N;
    for (let k = 1; k < N; k++) {
      const a = (10 + S * k) / L;
      const b = (10 + S * k + 0.3 * S) / L;
      out.push(
        ...rows('areas', 'body', [
          ['rotYScroll', a, b, ctx.psi[k - 1] ?? 45, ctx.psi[k] ?? 45, turnEase],
          [fill(k - 1), a, b, 1, 0.15],
          [fill(k), a, b, 0.15, 1],
        ]),
      );
    }
    const r = (10 + S * N) / L;
    out.push(
      ...rows('areas', 'body', [
        ['sectorMix', r, 1, 1, 0.5],
        [fill(N - 1), r, 1, 1, 0.15],
      ]),
    );
  } else {
    // SPEC-SAPMA: §5.9.4 — liste modunda BODY dönüşleri yoktur, ama "bırakma" (sectorMix 1 → 0.5, fill0 1 → 0.15)
    // BODY boyunca kalır: aksi hâlde work IN (0.15 → 0.12) ve journey IN (0.5 → 0) süreklilik değişmezini (§5.9.3 #2)
    // bozar ve K3 sectorMix 1 olurdu. Sahne bu aralıkta söner (opacityTrack 0); görünür etkisi yoktur.
    out.push(...rows('areas', 'body', [['sectorMix', 0, 1, 1, 0.5]]));
    if (N > 0) out.push(...rows('areas', 'body', [['fill0', 0, 1, 1, 0.15]]));
  }

  // work · IN
  out.push(
    mix('work', 'in', 0, 0.8, 0, 1, ['areas-dial', 'work-specimen']),
    ...rows('work', 'in', [
      ['camR', 0, 1, 7.2, 5.6],
      ['camEl', 0, 1, 88, 20],
      ['camFov', 0, 1, 18, 26],
      ['rotYScroll', 0, 1, lastPsi, W0],
      ['ringContrast', 0, 1, 0.4, 0.9],
      ['ghost', 0, 1, 0.1, 0],
      ['lightAz', 0, 1, 0, 25],
      ['lightEl', 0, 1, 80, 22],
      ['arcGlow', 0, 1, 0, 0.35],
      ['rotX', 0.3, 1, 0, 62],
      ['cut', 0.3, 1, 0, -0.02],
      ['bandVisible', 0.7, 1, 0, 1],
    ]),
  );
  for (let i = 0; i < N; i++) out.push(...rows('work', 'in', [[fill(i), 0, 0.6, 0.15, 0.12]]));
  // work · BODY: dolgular event'lerindir
  out.push(...rows('work', 'body', [['rotYScroll', 0, 1, W0, W0 + 30, 'linear']]));

  // journey · IN
  const pattern = lastProjectPattern(ctx);
  out.push(
    mix('journey', 'in', 0, 0.7, 0, 1, ['work-specimen', 'journey-core']),
    ...rows('journey', 'in', [
      ['camR', 0, 1, 5.6, 5.8],
      ['camEl', 0, 1, 20, 72],
      ['rotX', 0, 1, 62, 0],
      ['rotYScroll', 0, 1, W0 + 30, W0 + 50],
      ['sectorMix', 0, 0.5, 0.5, 0],
      ['cut', 0, 1, -0.02, 0],
      ['ringContrast', 0, 1, 0.9, 1],
      ['ghost', 0, 1, 0, 0.06],
      ['arcGlow', 0, 1, 0.35, 0.2],
      ['lightAz', 0, 1, 25, -20],
      ['lightEl', 0, 1, 22, 60],
    ]),
  );
  for (let i = 0; i < N; i++)
    out.push(...rows('journey', 'in', [[fill(i), 0, 0.5, pattern[i] ?? 0.12, 0]]));
  // journey · BODY
  out.push(...rows('journey', 'body', [['rotYScroll', 0, 1, W0 + 50, W0 + 110, 'linear']]));

  // contact · IN
  out.push(
    mix('contact', 'in', 0, 0.5, 0, 1, ['journey-core', 'contact-ring']),
    ...rows('contact', 'in', [
      ['camR', 0, 0.5, 5.8, 4.9],
      ['camEl', 0, 0.5, 72, 22],
      ['camFov', 0, 0.5, 26, 30],
      ['rotYScroll', 0, 0.5, W0 + 110, W0 + 130],
      ['bandVisible', 0, 0.4, 1, 0],
      ['ghost', 0, 0.5, 0.06, 0],
      ['rotX', 0.5, 1, 0, 68],
      ['cut', 0.5, 1, 0, -0.05],
      ['ringContrast', 0.5, 1, 1, 0.7],
      ['arcGlow', 0.5, 1, 0.2, 1],
      ['lightAz', 0.5, 1, -20, 70],
      ['lightEl', 0.5, 1, 60, 14],
      ['rim', 0.5, 1, 0.25, 0.35],
    ]),
  );

  // Varyantlar (§5.9.4): opaklık ve ton track'leri
  if (v.layout === 'landscape') {
    out.push(...rows('about', 'in', [['opacityTrack', 0.2, 0.5, 1, 0]]));
  } else if (v.layout === 'mobile') {
    if (v.areasList) out.push(...rows('areas', 'in', [['opacityTrack', 0.2, 0.5, 1, 0]]));
    else out.push(...rows('work', 'in', [['opacityTrack', 0.2, 0.5, 1, 0]]));
    const body = layout.phases.find((p) => p.chapter === 'journey' && p.phase === 'body');
    const len = body ? body.y1 - body.y0 : 0;
    // bant görünümden çıkarken: BODY [0.20·vh/len, 0.36·vh/len], 1'e kırpılır (§5.9.4 mobile)
    const b = len > 0 ? Math.min(1, (0.36 * layout.vh) / len) : 1;
    const a = Math.min(len > 0 ? (0.2 * layout.vh) / len : 0, b - 1e-6);
    out.push(
      ...rows('journey', 'in', [['opacityTrack', 0.3, 0.6, 0, 1]]),
      ...rows('journey', 'body', [['opacityTrack', a, b, 1, 0]]),
      ...rows('contact', 'in', [['opacityTrack', 0.3, 0.6, 0, 1]]),
    );
  } else {
    if (v.areasList)
      out.push(
        ...rows('areas', 'in', [['opacityTrack', 0.2, 0.5, 1, 0]]),
        ...rows('work', 'in', [['opacityTrack', 0.2, 0.5, 0, 1]]),
      );
    if (v.testimonials)
      out.push(
        ...rows('testimonials', 'in', [['opacityTrack', 0, 1, 1, 0.4]]),
        ...rows('contact', 'in', [['opacityTrack', 0, 0.5, 0.4, 1]]),
      );
    if (v.shortViewport)
      out.push(
        ...rows('work', 'in', [['tone', 0, 0.5, 1, 0]]),
        ...rows('journey', 'in', [['tone', 0, 0.5, 0, 1]]),
      );
  }
  return out;
}

/** y0 = range.y0 + start·(range.y1 − range.y0); o0 = range.order + start. Fazı olmayan bölümün track'i düşer. */
export function resolveTracks(
  tracks: readonly Track[],
  layout: Layout,
): Map<TrackProp, ResolvedTrack[]> {
  const groups = new Map<TrackProp, ResolvedTrack[]>();
  for (const t of tracks) {
    const r = layout.phases.find((p) => p.chapter === t.chapter && p.phase === t.phase);
    if (!r) continue;
    const len = r.y1 - r.y0;
    const resolved: ResolvedTrack = {
      ...t,
      y0: r.y0 + t.start * len,
      y1: r.y0 + t.end * len,
      o0: r.order + t.start,
      o1: r.order + t.end,
    };
    const list = groups.get(t.prop);
    if (list) list.push(resolved);
    else groups.set(t.prop, [resolved]);
  }
  for (const list of groups.values()) list.sort((a, b) => a.o0 - b.o0 || a.y0 - b.y0);
  return groups;
}

/** SAF: çıktı yalnızca (gruplar, y) girdisine bağlıdır; kaydırma geçmişine bağlı değildir. */
export function evaluateTracks(
  groups: ReadonlyMap<TrackProp, readonly ResolvedTrack[]>, // prop başına y0'a göre sıralı
  y: number,
  out: StageTarget,
  anchorIndex: (id: AnchorId) => number,
  eventOwned: (prop: TrackProp, y: number) => boolean,
): void {
  for (const [prop, list] of groups) {
    if (eventOwned(prop, y)) continue; // o pencerede alan event'lerindir
    let cur = list[0];
    if (!cur) continue;
    let v = cur.from; // ilk track'ten önce: ilk 'from'
    for (const t of list) {
      if (y < t.y0) break;
      cur = t;
      if (y <= t.y1) {
        const u = Math.min(1, Math.max(0, (y - t.y0) / Math.max(1, t.y1 - t.y0)));
        v = t.from + (t.to - t.from) * EASE[t.ease](u);
        break;
      }
      v = t.to; // track'ler arası: son 'to' korunur
    }
    if (prop === 'anchorMix' && cur.anchors) {
      out.anchorFrom = anchorIndex(cur.anchors[0]);
      out.anchorTo = anchorIndex(cur.anchors[1]);
    }
    out[prop] = v;
  }
}

/**
 * §5.9.3 adım 1: taban anahtarının bütün track alanlarını stageTarget'a yazar (kopya; bellek ayırmaz).
 * base null ise (preset 'none') yalnız opacityTrack 0 olur. fillsOwned: dolgular o konumda event'lerindir
 * (§5.9.5); taban onları ezmez, yoksa her güncelleme event tween'inin sonucunu silerdi.
 */
export function applyBase(
  out: StageTarget,
  k: Keyframe | null,
  anchorIndex: (id: AnchorId) => number,
  fillsOwned = false,
): void {
  if (!k) {
    out.opacityTrack = 0;
    return;
  }
  out.camR = k.r;
  out.camAz = k.az;
  out.camEl = k.el;
  out.camFov = k.fov;
  out.rotYScroll = k.rotY;
  out.rotX = k.rotX;
  out.cut = k.cut;
  out.ringContrast = k.ringContrast;
  out.sectorMix = k.sectorMix;
  if (!fillsOwned) {
    out.fill0 = k.fills[0];
    out.fill1 = k.fills[1];
    out.fill2 = k.fills[2];
    out.fill3 = k.fills[3];
    out.fill4 = k.fills[4];
    out.fill5 = k.fills[5];
  }
  out.bandVisible = k.bandVisible;
  out.ghost = k.ghost;
  out.arcGlow = k.arcGlow;
  out.rim = k.rim;
  out.tone = k.tone;
  out.lightAz = k.lightAz;
  out.lightEl = k.lightEl;
  out.anchorMix = 0;
  const a = k.anchor === 'blend' ? -1 : anchorIndex(k.anchor);
  out.anchorFrom = a;
  out.anchorTo = a;
  out.opacityTrack = 1;
}

/* ───────────── ölçüm (yalnız okur; refresh'te) ───────────── */

const docTop = (el: Element): number => el.getBoundingClientRect().top + window.scrollY;

/**
 * Fazlar, "top 55%" aktivasyon çizgileri, areas pin geometrisi ve heroExit (§5.9.3). Seçiciler daima kapsamlıdır
 * (root = [data-stage-scope], §5.13.6 kural 2). Anchor ölçümü M5'tedir (anchors: []).
 */
export function measureLayout(root: HTMLElement, preset: PresetName): Layout {
  const vh = window.innerHeight;
  const maxScroll = Math.max(0, document.documentElement.scrollHeight - vh);
  const mobile = !window.matchMedia('(min-width: 64rem)').matches;
  const clamp = (y: number) => Math.min(Math.max(y, 0), maxScroll);
  const phases: PhaseRange[] = [];
  const activation = { work: [] as number[], journey: [] as number[], cv: [] as number[] };
  let areas: Layout['areas'] = null;
  let heroExit = 0;

  if (preset === 'home') {
    const chapters = root.querySelectorAll<HTMLElement>('[data-chapter]');
    chapters.forEach((el, i) => {
      const id = el.dataset.chapter as ChapterId;
      if (id === 'hero') return;
      const top = docTop(el);
      const h = el.offsetHeight;
      phases.push({ chapter: id, phase: 'in', y0: clamp(top - vh), y1: clamp(top), order: i * 2 });
      phases.push({
        chapter: id,
        phase: 'body',
        y0: clamp(top),
        y1: clamp(Math.max(top, top + h - vh)),
        order: i * 2 + 1,
      });
    });
    const line = (el: Element) => docTop(el) - 0.55 * vh;
    activation.work = [
      ...root.querySelectorAll('[data-chapter="work"] article[data-work-article]'),
    ].map(line);
    activation.journey = [
      ...root.querySelectorAll('[data-chapter="journey"] [data-journey-entry]'),
    ].map(line);
    const aboutIn = phases.find((p) => p.chapter === 'about' && p.phase === 'in');
    heroExit = aboutIn ? aboutIn.y0 + 0.3 * (aboutIn.y1 - aboutIn.y0) : 0;
    const stage = root.querySelector<HTMLElement>('[data-areas-stage]');
    const body = phases.find((p) => p.chapter === 'areas' && p.phase === 'body');
    const n = Number(root.querySelector<HTMLElement>('[data-chapter="areas"]')?.dataset.areasN);
    if (stage && body && n >= 3 && n <= 6 && getComputedStyle(stage).position === 'sticky') {
      areas = {
        bodyY0: body.y0,
        bodyLen: body.y1 - body.y0,
        S: mobile ? AREAS_STEP.mobile : AREAS_STEP.desktop,
        N: n,
      };
    }
  }
  return { vh, maxScroll, mobile, phases, anchors: [], activation, areas, heroExit };
}
