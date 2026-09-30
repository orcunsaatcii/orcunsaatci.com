// src/stage/store.ts — sahne durumu tipleri (§5.9.1).
// M1'de yalnız tipler vardır: lab verisi (StageData) ve preset adları. zustand `stageStore`,
// `stageTarget`, `live` ve `directorApi` M4'te (three-free motor) bu dosyaya eklenir.
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
}
