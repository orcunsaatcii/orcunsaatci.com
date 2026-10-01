// src/stage/store.ts — sahne durumu (§5.9.1–§5.9.2). Three-free; ilk pakete girebilir.
// stageStore: nadir değişen React durumu (zustand vanilla). stageTarget / live / directorApi / nav: kaydırma
// döngüsünde yazılan, React dışı değiştirilebilir nesneler (kaydırma hiçbir render'a yol açmaz, §5.1.1).
// Faz geçişleri §5.9.1 tablosundadır; kaydırma sırasında setState çağrılmaz (istisna setLoop, eşik geçişinde).
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import type { Intensity } from '@/experience/profile';
import { NO_BAND } from '@/lib/section-geometry';
import type { MeasuredAnchor } from './anchors';
import type { ProbeSignals } from './capabilities';
import type { QualityState, Tier } from './quality';
import type { Layout } from './tracks';

export type { ProbeSignals } from './capabilities';

export type { Tier } from './quality';

export type StagePhase = 'poster' | 'probing' | 'loading' | 'ready' | 'fallback';
export type TierReason =
  'probe' | 'query' | 'reduced-motion' | 'context-loss' | 'perf' | 'error' | 'timeout';
export type PresetName =
  'home' | 'folio' | 'plan-small' | 'cv-core' | 'about-page' | 'contact-page' | 'none';

export interface StageData {
  // sunucuda içerikten üretilir, StagePreset prop'u (JSON)
  rings: number; // section-geometry.ringGeometry(...).rings (build yılı)
  sectors: number; // N (3–6); N ≥ 7 → 0
  ringEdges?: readonly number[]; // yalnız cap.pattern 'growth'
  projects: ReadonlyArray<{
    slug: string;
    area: number | null;
    band: readonly [number, number] | null;
  }>; // home: öne çıkanlar (sıralı); folio: [mevcut, sonraki]; plan-small: liste
  entries: ReadonlyArray<{ band: readonly [number, number] | null }>; // home: journey; cv-core: CV kayıtları
  activeArea?: number | null; // plan-small: /calisma-alanlari/[area]
  /** SPEC-SAPMA: §5.9.1 — persona yoğunluğu (areas dönüş easing'i, §5.9.4); içerik yalnız sunucuda okunur */
  intensity?: Intensity;
}

export interface StageState {
  phase: StagePhase;
  tier: Tier;
  tierReason: TierReason | null;
  signals: ProbeSignals | null; // §5.11.2 (debug paneli için)
  preset: PresetName;
  data: StageData | null;
  paused: boolean; // "Animasyonu durdur" (kalıcı değil, §4.14 #12)
  loop: 'demand' | 'never';
  canvasKey: number;
  contextLost: boolean;
  contextLosses: number;
  quality: QualityState | null; // §5.11.4
  debug: boolean; // ?debug
  invalidate: () => void; // Canvas mount olunca R3F invalidate ile değiştirilir
  setPhase: (p: StagePhase) => void;
  startLoading: (tier: Exclude<Tier, 'static'>, signals: ProbeSignals, reason: TierReason) => void;
  toFallback: (reason: TierReason) => void; // tier 'static', phase 'fallback'
  setPreset: (name: PresetName, data: StageData | null) => void;
  setPaused: (v: boolean) => void;
  setLoop: (l: 'demand' | 'never') => void;
  setQuality: (q: QualityState) => void;
  onContextLost: () => void;
  onContextRestored: () => void;
}

const noop = () => {};

export const stageStore = createStore<StageState>()((set) => ({
  phase: 'poster',
  tier: 'static',
  tierReason: null,
  signals: null,
  preset: 'none',
  data: null,
  paused: false,
  loop: 'demand',
  canvasKey: 0,
  contextLost: false,
  contextLosses: 0,
  quality: null,
  debug: false,
  invalidate: noop,
  setPhase: (phase) => set({ phase }),
  startLoading: (tier, signals, tierReason) => set({ tier, signals, tierReason, phase: 'loading' }),
  toFallback: (tierReason) => set({ tier: 'static', tierReason, phase: 'fallback' }),
  setPreset: (preset, data) => set({ preset, data }),
  setPaused: (paused) => set({ paused }),
  setLoop: (loop) => set({ loop }),
  setQuality: (quality) => set({ quality }),
  onContextLost: () =>
    set((s) =>
      s.contextLosses === 0
        ? { contextLost: true, contextLosses: 1, phase: 'poster' }
        : // §5.17: aynı ziyarette ikinci kayıp → canvas unmount, oturumun geri kalanında static
          {
            contextLost: false,
            contextLosses: s.contextLosses + 1,
            tier: 'static',
            tierReason: 'context-loss',
            phase: 'fallback',
          },
    ),
  onContextRestored: () =>
    set((s) => ({ contextLost: false, canvasKey: s.canvasKey + 1, phase: 'loading' })),
}));

export const useStage = <T>(sel: (s: StageState) => T): T => useStore(stageStore, sel);

/* ───────────── kaydırma döngüsünün nesneleri (§5.9.2) ───────────── */

export interface StageTarget {
  // kamera (derece; camR dünya birimi)
  camR: number;
  camAz: number;
  camEl: number;
  camFov: number;
  // nesne (derece)
  rotYScroll: number;
  rotYEvent: number;
  rotX: number;
  // anchor: ölçülmüş anchor listesindeki indeks; -1 = sanal (route glide anlık görüntüsü)
  anchorFrom: number;
  anchorTo: number;
  anchorMix: number;
  // kesit ve desen
  cut: number;
  ringContrast: number;
  sectorMix: number;
  fill0: number;
  fill1: number;
  fill2: number;
  fill3: number;
  fill4: number;
  fill5: number;
  bandStart: number;
  bandEnd: number;
  bandVisible: number;
  ghost: number;
  arcGlow: number;
  rim: number;
  tone: number;
  // ışık (derece)
  lightAz: number;
  lightEl: number;
  // zaman tabanlı katkılar (tween; damping'e girmez)
  sweepAz: number;
  sweepEl: number;
  sectorPreviewIndex: number;
  sectorPreviewAlpha: number;
  bandPreviewStart: number;
  bandPreviewEnd: number;
  bandPreviewAlpha: number;
  arcPulse: number;
  wave: number;
  // katman opaklığı çarpanları → --scene-opacity = opacityTrack × opacityCut × opacityReading
  opacityTrack: number;
  opacityCut: number;
  opacityReading: number;
}

/** K0 değerleri; wave −1; opacity* 1; önizleme alfaları 0 (§5.9.2). */
export const stageTarget: StageTarget = {
  camR: 5.2,
  camAz: -25,
  camEl: 12,
  camFov: 30,
  rotYScroll: 0,
  rotYEvent: 0,
  rotX: 0,
  anchorFrom: 0,
  anchorTo: 0,
  anchorMix: 0,
  cut: 1.1,
  ringContrast: 0,
  sectorMix: 0,
  fill0: 0,
  fill1: 0,
  fill2: 0,
  fill3: 0,
  fill4: 0,
  fill5: 0,
  bandStart: NO_BAND[0],
  bandEnd: NO_BAND[1],
  bandVisible: 0,
  ghost: 0,
  arcGlow: 0,
  rim: 0.25,
  tone: 1,
  lightAz: -60,
  lightEl: 38,
  sweepAz: 0,
  sweepEl: 0,
  sectorPreviewIndex: -1,
  sectorPreviewAlpha: 0,
  bandPreviewStart: NO_BAND[0],
  bandPreviewEnd: NO_BAND[1],
  bandPreviewAlpha: 0,
  arcPulse: 0,
  wave: -1,
  opacityTrack: 1,
  opacityCut: 1,
  opacityReading: 1,
};

/** Rig'in kare başına damped kopyası (§5.9.8); debug paneli ve testler okur, yalnız rig yazar. */
export const rendered: StageTarget = { ...stageTarget };

export const live = {
  scrollY: 0,
  velocity: 0, // px/s (ScrollTrigger.getVelocity)
  velocityAt: 0, // performance.now() zaman damgası
  lastInput: 0, // performance.now(): son kaydırma/işaretçi girişi
  pointer: { x: 0, y: 0, px: -1, py: -1, active: false }, // x,y ∈ [-1,1] (y yukarı +); px,py CSS px
  stone: { cx: 0, cy: 0, r: 0, visible: false }, // rig'in son karesindeki ekran dairesi
  inHero: true, // idle drift kapısı (home, y < layout.heroExit; §4.6.4)
  snapNextFrame: true, // true → rig bir sonraki karede rendered = target yapar
  virtualAnchor: { cx: 0, cy: 0, D: 0 }, // anchorFrom === -1 iken kullanılır
  /** director'ün son refresh'te ölçtüğü anchor'lar (§5.7.4); rig kare başına yalnız okur */
  anchors: [] as readonly MeasuredAnchor[],
  frames: 0, // rig'in çizdiği kare sayısı (§5.19: opaklık < 0.01 ve gizli sekmede 2 s kare yok; ?debug testleri okur)
  idleAngle: 0, // idle drift açısı, derece (K-HERO-9 testleri okur)
  /** yakınlık eğimi (§5.9.6): derece ve cut nefesi; rig yazar, ?debug okur */
  tilt: { x: 0, y: 0, breath: 0 },
  /** director'ün son refresh'te ölçtüğü düzen (fazlar, aktivasyon çizgileri); ?debug testleri okur (§13.3.4) */
  layout: null as Layout | null,
  /** /projeler filtre çipi (alan indeksi; null = filtre yok); setPlanFilter yazar (§5.9.10) */
  planFilter: null as number | null,
};

/** Anchor indeksi: −1 sanal (route glide anlık görüntüsü), −2 ölçülmemiş/eksik (§5.7.4) */
export const ANCHOR_VIRTUAL = -1;
export const ANCHOR_MISSING = -2;

/** Ana sayfa bölüm kimlikleri; derin sayfalarda tek sentetik 'page' fazı vardır (§5.9.3). */
export type ChapterId =
  'hero' | 'about' | 'areas' | 'work' | 'journey' | 'testimonials' | 'contact' | 'page';

export interface DirectorApi {
  /** adım k'nın dwell ortası (belge y) */
  areasStepY: (k: number) => number;
  /** bölüm başlangıcı (belge y) */
  chapterY: (id: ChapterId) => number;
  /** uzak sıçrama kararı için (§5.13.4) */
  chapterIndexAt: (y: number) => number;
  /** kesme kuralı (§5.9.7): sönmeyi başlatır; kaydırma bitince endCut oturtur ve geri getirir */
  startCut: (reason: 'far-jump' | 'restore' | 'route' | 'instant-scroll') => void;
  endCut: () => void;
  /** event hedeflerini geçerli konumda yeniden değerlendirir (filtre çipi gibi kaydırma dışı durum değişince) */
  update: () => void;
}

/** Aktif ScrollDirector'ün üzerine yazdığı yardımcılar; director yokken NaN / −1 / no-op. */
export const directorApi: DirectorApi = {
  areasStepY: () => Number.NaN,
  chapterY: () => Number.NaN,
  chapterIndexAt: () => -1,
  startCut: () => {},
  endCut: () => {},
  update: () => {},
};

export const nav = {
  // route geçişi köprüsü (§5.15.3)
  pending: null as 'push' | 'restore' | null, // RouteScrollSync yazar
  snapshot: { cx: 0, cy: 0, r: 0, visible: false, opacity: 0 }, // StagePreset, eski sayfanın son karesinden yazar
  consume(): 'push' | 'restore' | null {
    const p = this.pending;
    this.pending = null;
    return p;
  },
};

/** opacityTrack × opacityCut × opacityReading (son yazılan --scene-opacity). */
export function currentSceneOpacity(): number {
  return stageTarget.opacityTrack * stageTarget.opacityCut * stageTarget.opacityReading;
}
