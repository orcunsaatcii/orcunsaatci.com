// src/stage/events.ts — olay yayıcı ve areas adım indeksi (§5.9.5). Three-free. İlk pakettedir: bölüm bileşenleri
// (AreasPin, DialRotor, SectionWipe, CutLine …) dinler. İndeksler, sahiplik pencereleri, hedef çözümleyici ve uygulama
// event-targets.ts'tedir: onu yalnız director (director.ts) kullanır, motion runtime ile gelir (PB-1).
// Kaydırma döngüsünde bellek ayırma YASAK (§5.13.5): sık olaylar yeniden kullanılan nesnelere yazılır.
// Hover/önizleme yardımcıları (previewSector, pulseArc, sendWave …) M5/M7'de sahne bağlanınca eklenir.
import type { ChapterId } from './store';
import type { Layout } from './tracks';

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

/* ───────────── areas adımı (saf) ───────────── */

/** Masaüstü areas adımı (svh); mobil pin 40 (§4.8.8) */
export const AREAS_STEP = { desktop: 50, mobile: 40 } as const;

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
