// src/stage/event-targets.ts — event indeksleri, sahiplik pencereleri, hedef çözümleyici ve uygulama (§5.9.5).
// Three-free. Yalnız director (director.ts) kullanır: motion runtime ile gelir, ilk pakete girmez (PB-1). İndeksler ve
// hedefler y'nin saf fonksiyonudur; ScrollTrigger yalnız refresh'te çizgileri ölçer. Kaydırma döngüsünde bellek ayırma
// YASAK (§5.13.5): hedefler yeniden kullanılan nesnelere yazılır.
import type { MotionRuntime } from '@/lib/gsap';
import { NO_BAND, psiDeg, wrap180 } from '@/lib/section-geometry';
import { areasIndexAt, emit } from './events';
import type { StageContentCtx } from './keyframes';
import { stageStore, stageTarget, type PresetName, type StageData } from './store';
import { FILL_PROPS, type Layout, type TrackProp } from './tracks';

/* ───────────── indeksler (saf) ───────────── */

export interface EventIndices {
  areas: number;
  work: number;
  journey: number;
  cv: number;
  /** y, dolguların work event penceresinde mi (§5.9.5 sahiplik tablosu) */
  fillWindow: boolean;
}

const countBelow = (lines: readonly number[], y: number): number => {
  let n = 0;
  for (const l of lines) if (l <= y) n++;
  return n - 1;
};

const fillWindows = new WeakMap<Layout, readonly [number, number] | null>();
/** work IN p 0.6 → work BODY p 1 (refresh başına bir kez hesaplanır) */
function fillWindowOf(layout: Layout): readonly [number, number] | null {
  let w = fillWindows.get(layout);
  if (w === undefined) {
    const wIn = layout.phases.find((p) => p.chapter === 'work' && p.phase === 'in');
    const wBody = layout.phases.find((p) => p.chapter === 'work' && p.phase === 'body');
    w = wIn && wBody ? [wIn.y0 + 0.6 * (wIn.y1 - wIn.y0), wBody.y1] : null;
    fillWindows.set(layout, w);
  }
  return w;
}

export function computeIndices(layout: Layout, y: number, out?: EventIndices): EventIndices {
  const o = out ?? { areas: 0, work: -1, journey: -1, cv: -1, fillWindow: false };
  o.areas = areasIndexAt(layout.areas, y);
  o.work = countBelow(layout.activation.work, y);
  o.journey = countBelow(layout.activation.journey, y);
  o.cv = countBelow(layout.activation.cv, y);
  o.fillWindow = eventOwned(layout, 'fill0', y);
  return o;
}

/** Saf: prop o konumda event'lerin mi? Ana sayfada yalnız dolgular (work penceresi) track'ten alınır. */
export function eventOwned(layout: Layout, prop: TrackProp, y: number): boolean {
  if (!prop.startsWith('fill')) return false;
  const w = fillWindowOf(layout);
  return w !== null && y >= w[0] && y <= w[1];
}

/* ───────────── hedefler (saf) ───────────── */

export interface EventTargets {
  rotYEvent: number;
  bandStart: number;
  bandEnd: number;
  /** yalnız fillsActive iken anlamlıdır (pencere dışı = track'lerin) */
  fills: [number, number, number, number, number, number];
  fillsActive: boolean;
}

export const createEventTargets = (): EventTargets => ({
  rotYEvent: 0,
  bandStart: NO_BAND[0],
  bandEnd: NO_BAND[1],
  fills: [0, 0, 0, 0, 0, 0],
  fillsActive: false,
});

/**
 * band: journey ≥ 0 → entries[journey]; work ≥ 0 → projects[work]; değilse projects[0]. null → NO_BAND.
 * rotYEvent: work ≥ 0 ve alanı varsa wrap180(ψ(alan) − W₀), değilse 0. fills: work ≥ 0 → alanında 0.6, diğer
 * i < N 0.12; work = −1 → i < N 0.12; i ≥ N daima 0 (§5.9.5). Derin preset'ler M7'dedir.
 */
export function resolveEvents(
  preset: PresetName,
  ix: EventIndices,
  d: StageData,
  ctx: StageContentCtx,
  out: EventTargets,
): EventTargets {
  out.rotYEvent = 0;
  out.fillsActive = false;
  out.bandStart = NO_BAND[0];
  out.bandEnd = NO_BAND[1];
  if (preset !== 'home') return out;
  const project = ix.work >= 0 ? d.projects[ix.work] : undefined;
  const band =
    ix.journey >= 0
      ? (d.entries[ix.journey]?.band ?? null)
      : ((project ?? d.projects[0])?.band ?? null);
  if (band) {
    out.bandStart = band[0];
    out.bandEnd = band[1];
  }
  const area = project?.area ?? null;
  if (area !== null && ctx.N > 0) out.rotYEvent = wrap180(psiDeg(area, ctx.N) - ctx.W0);
  if (ix.fillWindow) {
    out.fillsActive = true;
    for (let i = 0; i < 6; i++) out.fills[i] = i >= ctx.N ? 0 : i === area ? 0.6 : 0.12;
  }
  return out;
}

/* ───────────── uygulama (runtime gerekir) ───────────── */

const FILL_KEYS = FILL_PROPS.join(',');
const applied = createEventTargets();
let appliedValid = false;
let lastInstant = false;

/** Director yeniden kurulunca (refresh zinciri başı) önceki uygulanmış hedefler unutulur. */
export function resetEventState(): void {
  appliedValid = false;
}

const invalidate = () => stageStore.getState().invalidate();

/**
 * Değişim varsa stageTarget alanlarını tween'ler ve DOM olaylarını yayar. instant (kesme, geri/ileri, ilk kare):
 * tween öldürülür, değer doğrudan yazılır; anlık dizinin ilk çağrısında bu, hedef değişmemiş olsa da yapılır
 * (§5.9.5 ZORUNLU: süren tween kalmaz; dizi içinde tween başlamadığından sonraki kareler yalnız değişimi yazar).
 * work: 600 ms power3.inOut; journey bandı: 500 ms power2.out (§5.9.5). Pencereden çıkışta dolgu tween'leri ölür.
 */
export function applyEvents(
  rt: MotionRuntime,
  preset: PresetName,
  t: EventTargets,
  ix: EventIndices,
  prev: EventIndices | null,
  o: { instant: boolean },
): void {
  const { gsap } = rt;
  const instant = o.instant || prev === null;

  // 1) DOM olayları (yalnız indeks değişince)
  if (preset === 'home') {
    if (!prev || prev.areas !== ix.areas)
      emit({ type: 'areas:step', index: ix.areas, prev: prev?.areas ?? -1, instant });
    if (!prev || prev.work !== ix.work)
      emit({
        type: 'work:active',
        index: ix.work,
        prev: prev?.work ?? -1,
        direction: prev && ix.work < prev.work ? -1 : 1,
        instant,
      });
    if (!prev || prev.journey !== ix.journey)
      emit({ type: 'journey:active', index: ix.journey, prev: prev?.journey ?? -1, instant });
  }
  if (prev && prev.cv !== ix.cv) emit({ type: 'cv:active', index: ix.cv, prev: prev.cv, instant });

  // 2) sahne hedefleri
  const force = !appliedValid || (instant && !lastInstant);
  lastInstant = instant;
  const journeyBand = ix.journey >= 0;
  const bandDur = journeyBand ? 0.5 : 0.6;
  const bandEase = journeyBand ? 'power2.out' : 'power3.inOut';
  if (force || applied.bandStart !== t.bandStart || applied.bandEnd !== t.bandEnd) {
    tweenOrSet(gsap, instant, { bandStart: t.bandStart, bandEnd: t.bandEnd }, bandDur, bandEase);
    applied.bandStart = t.bandStart;
    applied.bandEnd = t.bandEnd;
  }
  if (force || applied.rotYEvent !== t.rotYEvent) {
    tweenOrSet(gsap, instant, { rotYEvent: t.rotYEvent }, 0.6, 'power3.inOut');
    applied.rotYEvent = t.rotYEvent;
  }
  if (t.fillsActive) {
    let changed = force || !applied.fillsActive;
    for (let i = 0; i < 6 && !changed; i++) changed = applied.fills[i] !== t.fills[i];
    if (changed) {
      const [fill0, fill1, fill2, fill3, fill4, fill5] = t.fills;
      tweenOrSet(
        gsap,
        instant || !applied.fillsActive,
        { fill0, fill1, fill2, fill3, fill4, fill5 },
        0.6,
        'power3.inOut',
      );
      for (let i = 0; i < 6; i++) applied.fills[i] = t.fills[i] ?? 0;
    }
  } else if (applied.fillsActive) {
    gsap.killTweensOf(stageTarget, FILL_KEYS); // pencereden çıkış: track'ler devralır (§5.9.5 ZORUNLU)
  }
  applied.fillsActive = t.fillsActive;
  appliedValid = true;
}

function tweenOrSet(
  gsap: MotionRuntime['gsap'],
  instant: boolean,
  vars: Partial<Record<keyof typeof stageTarget, number>>,
  duration: number,
  ease: string,
): void {
  const keys = Object.keys(vars).join(',');
  if (instant) {
    gsap.killTweensOf(stageTarget, keys);
    Object.assign(stageTarget, vars);
    invalidate();
    return;
  }
  gsap.to(stageTarget, { ...vars, duration, ease, onUpdate: invalidate });
}
