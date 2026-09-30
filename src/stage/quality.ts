// src/stage/quality.ts — kademe tablosu (§5.11.1). Three-free ve saf.
// initialQuality / stepDown / stepUp M5'te eklenir (§5.11.4); QualityState tipi store.ts için M4'te burada.

export type Tier = 'static' | 'low' | 'medium' | 'high'; // store.ts'ten yeniden dışa aktarılır
export type SegmentTier = 'high' | 'medium' | 'low';

export const SEGMENTS: Record<SegmentTier, readonly [number, number]> = {
  high: [128, 96],
  medium: [96, 72],
  low: [72, 54],
};

export interface TierSpec {
  segments: SegmentTier;
  octaves: 1 | 2;
  ghost: boolean;
  dprMax: number; // dpr = clamp(devicePixelRatio, 1, dprMax)
  antialias: boolean;
  idle: boolean; // idle drift (süre girdi türüne göre: ince 20 s, kaba 8 s)
  pointer: boolean; // işaretçi ışığı + yakınlık (ince) / wobble + dokunmatik tarama (kaba)
}

// §5.11.1 tablosu: satır başına bir kademe.
// prettier-ignore
export const TIERS: Record<Exclude<Tier, 'static'>, TierSpec> = {
  high:   { segments: 'high',   octaves: 2, ghost: true,  dprMax: 2,   antialias: true,  idle: true,  pointer: true },
  medium: { segments: 'medium', octaves: 1, ghost: false, dprMax: 1.5, antialias: false, idle: true,  pointer: true },
  low:    { segments: 'low',    octaves: 1, ghost: false, dprMax: 1,   antialias: false, idle: false, pointer: false },
};

/** Çalışma zamanı kalite durumu (§5.11.4); değerleri M5'te initialQuality / stepDown / stepUp üretir. */
export interface QualityState {
  dpr: number;
  ghost: boolean;
  octaves: 1 | 2;
  segments: SegmentTier;
}
