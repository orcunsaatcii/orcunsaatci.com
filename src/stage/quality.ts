// src/stage/quality.ts — kademe tablosu ve çalışma zamanı kalite merdiveni (§5.11.1, §5.11.4). Three-free ve saf.

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

/** Çalışma zamanı kalite durumu (§5.11.4) */
export interface QualityState {
  dpr: number;
  ghost: boolean;
  octaves: 1 | 2;
  segments: SegmentTier;
}

const DPR_STEP = 0.25;
/** Segment kademeleri yüksekten düşüğe (step-down sırası) */
const SEGMENT_ORDER: readonly SegmentTier[] = ['high', 'medium', 'low'];
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Kademenin başlangıç kalitesi; dpr = clamp(devicePixelRatio, 1, dprMax) (§5.11.1) */
export function initialQuality(
  t: Exclude<Tier, 'static'>,
  deviceDpr: number = typeof window === 'undefined' ? 1 : window.devicePixelRatio,
): QualityState {
  const spec = TIERS[t];
  return {
    dpr: round2(Math.min(Math.max(deviceDpr || 1, 1), spec.dprMax)),
    ghost: spec.ghost,
    octaves: spec.octaves,
    segments: spec.segments,
  };
}

/**
 * Tek adım aşağı (§5.11.4): 1) dpr −0.25 (1'e kadar) 2) ghost kapalı 3) oktav 1 4) bir alt segment kademesi.
 * null = merdiven tükendi (çağıran toFallback('perf') yapar).
 */
export function stepDown(q: QualityState): QualityState | null {
  if (q.dpr > 1) return { ...q, dpr: Math.max(1, round2(q.dpr - DPR_STEP)) };
  if (q.ghost) return { ...q, ghost: false };
  if (q.octaves === 2) return { ...q, octaves: 1 };
  const i = SEGMENT_ORDER.indexOf(q.segments);
  const next = SEGMENT_ORDER[i + 1];
  return next ? { ...q, segments: next } : null;
}

/** stepDown'ın tersi; başlangıç kalitesi (base) aşılmaz. null = zaten base'te. */
export function stepUp(q: QualityState, base: QualityState): QualityState | null {
  const i = SEGMENT_ORDER.indexOf(q.segments);
  if (i > SEGMENT_ORDER.indexOf(base.segments)) {
    const up = SEGMENT_ORDER[i - 1];
    if (up) return { ...q, segments: up };
  }
  if (q.octaves < base.octaves) return { ...q, octaves: base.octaves };
  if (!q.ghost && base.ghost) return { ...q, ghost: true };
  if (q.dpr < base.dpr) return { ...q, dpr: Math.min(base.dpr, round2(q.dpr + DPR_STEP)) };
  return null;
}
