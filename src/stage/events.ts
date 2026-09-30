// src/stage/events.ts — event indeksleri, hedef çözümleyici, sahiplik pencereleri ve olay yayıcı (§5.9.5).
// Three-free. İndeksler ve hedefler y'nin saf fonksiyonudur; ScrollTrigger yalnız refresh'te çizgileri ölçer.
// Kaydırma döngüsünde bellek ayırma YASAK (§5.13.5): hedefler ve sık olaylar yeniden kullanılan nesnelere yazılır.
// Hover/önizleme yardımcıları (previewSector, pulseArc, sendWave …) M5/M7'de sahne bağlanınca eklenir.
import type { MotionRuntime } from '@/lib/gsap';
import { NO_BAND, psiDeg, wrap180 } from '@/lib/section-geometry';
import type { StageContentCtx } from './keyframes';
import { stageStore, stageTarget, type ChapterId, type PresetName, type StageData } from './store';
import { FILL_PROPS, type Layout, type TrackProp } from './tracks';

export type CutReason = 'far-jump' | 'restore' | 'route' | 'instant-scroll';
export type StageEvent =
  | { type: 'areas:step'; index: number; prev: number; instant: boolean } // metin değişimi, iğne, sayaç
  | { type: 'work:active'; index: number; prev: number; direction: 1 | -1; instant: boolean } // SectionWipe, altyazı
  | { type: 'journey:active'; index: number; prev: number; instant: boolean } // aktif yıl etiketi
  | { type: 'cv:active'; index: number; prev: number; instant: boolean }
  | { type: 'about:cut'; cutProgress: number } // CutLine + lede (§5.14.4)
  | { type: 'folio:next'; active: boolean }
  | { type: 'cut'; stage: 'start' | 'snap' | 'end'; reason: CutReason }
  | { type: 'refresh'; chapters: ReadonlyArray<{ id: ChapterId; y: number }> }; // HalkaIndicator tikleri

type EventOf<T extends StageEvent['type']> = Extract<StageEvent, { type: T }>;

/* ───────────── olay yayıcı ───────────── */

const listeners = new Map<StageEvent['type'], Set<(e: StageEvent) => void>>();
const lastEvents = new Map<StageEvent['type'], StageEvent>();

export function onStageEvent<T extends StageEvent['type']>(
  type: T,
  cb: (e: EventOf<T>) => void,
): () => void {
  let set = listeners.get(type);
  if (!set) listeners.set(type, (set = new Set()));
  const fn = cb as (e: StageEvent) => void;
  set.add(fn);
  return () => {
    set.delete(fn);
  };
}

export function emit(e: StageEvent): void {
  lastEvents.set(e.type, e);
  listeners.get(e.type)?.forEach((cb) => cb(e));
}

/** Son yayılan olay (sonradan mount olan bileşen durumunu bununla eşitler). about:cut nesnesi yeniden kullanılır. */
export function lastStageEvent<T extends StageEvent['type']>(type: T): EventOf<T> | undefined {
  return lastEvents.get(type) as EventOf<T> | undefined;
}

const updateListeners = new Set<() => void>();
/** Director'ün her güncellemesinden sonra çağrılır (statik kademe DialFigure dönüşü, §5.13.5). */
export function onStageUpdate(cb: () => void): () => void {
  updateListeners.add(cb);
  return () => {
    updateListeners.delete(cb);
  };
}
export function notifyStageUpdate(): void {
  updateListeners.forEach((cb) => cb());
}

/* ───────────── indeksler (saf) ───────────── */

export interface EventIndices {
  areas: number;
  work: number;
  journey: number;
  cv: number;
  /** y, dolguların work event penceresinde mi (§5.9.5 sahiplik tablosu) */
  fillWindow: boolean;
}

/** Areas BODY'de ofs (svh, L = 20 + S·N ölçeğinde) → adım: ofs ≥ 10 + S·k + 0.15·S olan en büyük k ≥ 1, yoksa 0. */
export function areasStepAt(ofs: number, S: number, N: number): number {
  let k = 0;
  for (let i = 1; i < N; i++) if (ofs >= 10 + S * i + 0.15 * S) k = i;
  return k;
}

/** Belge y'si → areas adımı (BODY öncesi 0; sonrası N − 1). Pin yoksa 0. */
export function areasIndexAt(areas: Layout['areas'], y: number): number {
  if (!areas || y < areas.bodyY0) return 0;
  const L = 20 + areas.S * areas.N;
  const ofs = areas.bodyLen > 0 ? ((y - areas.bodyY0) / areas.bodyLen) * L : L;
  return areasStepAt(ofs, areas.S, areas.N);
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
